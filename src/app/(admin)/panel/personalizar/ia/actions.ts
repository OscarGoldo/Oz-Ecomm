"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  updateStoreTheme,
  type ActionResult,
  type ThemeInput,
} from "@/app/(admin)/panel/personalizar/actions";
import {
  aiDesignAvailable,
  aiDesignQuota,
  AI_DESIGN_DAILY_LIMIT,
  generateDesignProposals,
  seenSchema,
  type AiDesignQuota,
  type DesignProposal,
} from "@/lib/ai-design";
import { applyDesignPatch } from "@/app/(admin)/panel/personalizar/design-actions";
import { getSessionContext } from "@/lib/auth";
import { isPro } from "@/lib/plans";
import { getImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { isFreeLayout, resolveTheme } from "@/lib/theme";
import { mergeAiProposal } from "@/lib/design/design";
import { designV2Enabled } from "@/lib/design/flag";
import { designTablesReady, loadDraft, saveDraft } from "@/lib/design/store";
import type { Json } from "@/types/database";

export type GenerateAiDesignResult =
  | { ok: true; proposals: DesignProposal[]; quota: AiDesignQuota }
  | { ok: false; error: string; quota?: AiDesignQuota };

const briefSchema = z
  .string()
  .trim()
  .min(15, "Cuéntanos un poco más de tu negocio (al menos una frase).")
  .max(1500, "Es demasiado largo. Resúmelo en unas pocas frases.");

export async function generateAiDesign(input: {
  brief: string;
  /** Lo que ya le mostró antes (lo guarda su navegador), para no repetirlo. */
  seen?: unknown;
}): Promise<GenerateAiDesignResult> {
  const brief = briefSchema.safeParse(input.brief);
  if (!brief.success) {
    return { ok: false, error: brief.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const seen = seenSchema.safeParse(input.seen ?? []);

  const ctx = await getSessionContext();
  const store = ctx?.store;
  if (!store) return { ok: false, error: "No autorizado" };
  const v2 = designV2Enabled(store) && (await designTablesReady());

  const quota = aiDesignAvailable() ? await aiDesignQuota(store) : null;
  if (!quota) {
    return { ok: false, error: "El diseñador con IA no está disponible en este momento." };
  }
  if (quota.remaining <= 0) {
    return {
      ok: false,
      quota,
      error: quota.freeUsed
        ? "Ya usaste tu diseño gratis con IA. Con Pro pides nuevos diseños cuando quieras."
        : `Ya pediste ${AI_DESIGN_DAILY_LIMIT} diseños hoy. Mañana puedes pedir más, o ajusta este a mano en Personalizar.`,
    };
  }

  // Lo que la tienda ya tiene cargado le da contexto real a la IA: qué vende,
  // cómo cobra. Con la sesión del dueño, así RLS solo deja ver lo suyo.
  const supabase = createClient();
  const [{ data: categories }, { data: products }, { data: methods }] = await Promise.all([
    supabase.from("categories").select("name").eq("store_id", store.id).limit(20),
    supabase
      .from("products")
      .select("name, images")
      .eq("store_id", store.id)
      .eq("status", "active")
      .order("featured", { ascending: false })
      .limit(20),
    supabase
      .from("payment_methods")
      .select("label")
      .eq("store_id", store.id)
      .eq("active", true),
  ]);

  const productImages = (products ?? [])
    .map((p) => getImageUrl(p.images?.[0]))
    .filter((u): u is string => Boolean(u))
    .slice(0, 3);
  const logo = getImageUrl(store.logo_url);

  const result = await generateDesignProposals(
    store.id,
    {
      brief: brief.data,
      storeName: store.name,
      pro: isPro(store),
      description: store.description,
      address: store.address,
      instagram: store.instagram,
      offersDelivery: store.offers_delivery,
      deliveryNote: store.delivery_note,
      offersPickup: store.offers_pickup,
      freeDeliveryMin: store.free_delivery_min,
      showBsPrices: store.show_bs_prices,
      paymentMethods: (methods ?? []).map((m) => m.label),
      categories: (categories ?? []).map((c) => c.name),
      products: (products ?? []).map((p) => p.name),
      images: [
        ...(logo ? [{ url: logo, kind: "logo" as const }] : []),
        ...productImages.map((url) => ({ url, kind: "product" as const })),
      ],
    },
    resolveTheme(store),
    { mode: v2 ? "v2" : "legacy", seen: seen.success ? seen.data : [] },
  );

  // Se vuelve a contar en vez de restar uno: en Gratis un intento fallido no
  // gasta la prueba, y eso lo sabe la tabla, no esta cuenta.
  const after = (await aiDesignQuota(store)) ?? { ...quota, remaining: 0 };
  return result.ok
    ? { ok: true, proposals: result.proposals, quota: after }
    : { ok: false, error: result.error, quota: after };
}

/**
 * Guarda la propuesta elegida. El diseño pasa por `updateStoreTheme`, la misma
 * acción del editor: mismas validaciones y mismo candado de plantillas Pro.
 *
 * En las tiendas con el editor por secciones no se publica directo: queda
 * como borrador encima de sus secciones, para revisarlo y publicarlo.
 */
export async function applyAiDesign(input: {
  /** Editor viejo: el tema completo. */
  theme?: ThemeInput;
  /** Editor por secciones: el cambio sobre un diseño base. */
  patch?: unknown;
  description: string | null;
}): Promise<ActionResult & { draft?: boolean }> {
  const session = await getSessionContext();
  const v2Store = session?.store && designV2Enabled(session.store) && (await designTablesReady()) ? session.store : null;

  if (v2Store && input.patch) {
    // Mismo camino que la vitrina: el cambio se aplica al borrador.
    const res = await applyDesignPatch(input.patch);
    if (!res.ok) return res;
  } else if (v2Store && input.theme) {
    // resolveTheme normaliza lo que mandó el cliente igual que lo guardado.
    const theme = resolveTheme({ ...v2Store, plan: "pro", plan_expires_at: null, customization: input.theme as unknown as Json });
    if (!isPro(v2Store) && !isFreeLayout(theme.layout)) {
      return { ok: false, error: "Esa plantilla es del plan Pro. Activa Pro para usarla." };
    }
    const { design } = await loadDraft(v2Store);
    if (!(await saveDraft(v2Store.id, mergeAiProposal(design, theme)))) {
      return { ok: false, error: "No se pudo guardar el diseño" };
    }
  } else if (input.theme) {
    const saved = await updateStoreTheme(input.theme);
    if (!saved.ok) return saved;
  } else {
    return { ok: false, error: "No hay diseño para guardar" };
  }

  const description = z.string().trim().max(300).nullable().safeParse(input.description);
  if (description.success && description.data) {
    const ctx = await getSessionContext();
    if (ctx?.store) {
      const supabase = createClient();
      const { error } = await supabase
        .from("stores")
        .update({ description: description.data })
        .eq("id", ctx.store.id);
      // El diseño ya quedó guardado: una descripción que no entra no lo
      // deshace, solo se avisa.
      if (error) return { ok: false, error: "Se guardó el diseño, pero no la descripción." };
    }
  }

  revalidatePath("/panel");
  revalidatePath("/panel/configuracion");
  return { ok: true, draft: Boolean(v2Store) };
}
