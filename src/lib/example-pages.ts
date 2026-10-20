import "server-only";

import { initialExchangeRate } from "@/lib/bcv";
import { applyPatch, baseDesign, getBase, RUBROS, type DesignPatch, type RubroId } from "@/lib/design/bases";
import { parseDesign } from "@/lib/design/design";
import type { AnySection, StoreDesign } from "@/lib/design/types";
import { heroPhotoUrl, RUBRO_HERO_PHOTO } from "@/lib/example-photos";
import { reportError } from "@/lib/report-error";
import { STORE_IMAGES_BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, Store } from "@/types/database";

/**
 * Páginas ejemplo: la tienda que los socios arman en /super/ejemplos para
 * mostrársela a un negocio antes de venderle ("mira, tu tienda se puede ver
 * así"). Es una fila de `stores` como cualquier otra, para que la vitrina sea
 * exactamente la que tendría el negocio, pero:
 *
 *   · no tiene dueño: no se crea usuario, ni correo, ni contraseña;
 *   · `demo` la saca de los números de /super, del crédito y de Google;
 *   · `example` le pone la franja de ejemplo, le prende el diseño por
 *     secciones y hace que el checkout no cree pedidos;
 *   · se edita y se borra desde el super admin, con service role.
 *
 * Todo lo de acá supone que quien llama ya pasó por requireSuperAdmin().
 */

/** El diseño base con el que arranca cada rubro (ver lib/design/bases.ts). */
const BASE_FOR_RUBRO: Record<RubroId, string> = {
  general: "barquisimeto",
  moda: "merida",
  tecnologia: "maracaibo",
  belleza: "caracas",
  hogar: "barquisimeto",
  comida: "valencia",
};

/** Lo que dice la portada hasta que alguien lo cambie o lo escriba la IA. */
const STARTER_TEXTS: Record<RubroId, { headline: string; subtext: string }> = {
  general: { headline: "Todo lo que buscas, en un solo lugar", subtext: "Pide en línea y paga como prefieras." },
  moda: { headline: "La nueva colección ya llegó", subtext: "Prendas que vas a querer usar todos los días." },
  tecnologia: { headline: "Tecnología original, con garantía", subtext: "Teléfonos, accesorios y más, con entrega rápida." },
  belleza: { headline: "Tu rutina, más fácil", subtext: "Cuidado de la piel y maquillaje que sí funciona." },
  hogar: { headline: "Todo para tu casa", subtext: "Cocina, decoración y organización a buen precio." },
  comida: { headline: "Antojo resuelto", subtext: "Pide por aquí y te lo llevamos calientico." },
};

export function isRubro(v: unknown): v is RubroId {
  return RUBROS.some((r) => r.id === v);
}

export function exampleBaseFor(rubro: RubroId): string {
  return BASE_FOR_RUBRO[rubro];
}

/** El diseño completo de una página nueva: el diseño base del rubro con sus textos. */
export function starterDesign(rubro: RubroId): StoreDesign {
  const base = getBase(BASE_FOR_RUBRO[rubro]) ?? getBase("barquisimeto")!;
  return applyPatch(baseDesign(base, rubro), { texts: { ...STARTER_TEXTS[rubro], ctaText: "Ver productos" } });
}

/** El diseño guardado de una página ejemplo, o el de arranque si no tiene. */
export function exampleDesign(store: Pick<Store, "design">, rubro: RubroId): StoreDesign {
  return parseDesign(store.design ?? null) ?? starterDesign(rubro);
}

/** El rubro con el que se armó la página: sale de los colores del diseño base. */
export function exampleRubro(design: StoreDesign): RubroId {
  const base = getBase(design.tokens.base);
  if (!base) return "general";
  const found = (Object.entries(base.palettes) as [RubroId, StoreDesign["tokens"]["colors"]][]).find(
    ([, c]) => c.primary === design.tokens.colors.primary && c.accent === design.tokens.colors.accent,
  );
  return found?.[0] ?? "general";
}

/** Cambia las preguntas frecuentes del diseño (la IA las escribe). */
export function withFaq(design: StoreDesign, items: { q: string; a: string }[]): StoreDesign {
  if (items.length === 0) return design;
  let done = false;
  const home = design.home.map((sec): AnySection => {
    if (sec.type !== "faq" || done) return sec;
    done = true;
    return { ...sec, hidden: undefined, settings: { ...sec.settings, items } };
  });
  return { ...design, home };
}

export async function saveExampleDesign(storeId: string, design: StoreDesign): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("stores")
    .update({
      design: design as unknown as Json,
      design_published_at: new Date().toISOString(),
      primary_color: design.tokens.colors.primary,
    })
    .eq("id", storeId)
    .eq("example", true);
  if (error) reportError("saveExampleDesign", new Error(error.message), { storeId });
  return !error;
}

export function applyDesignPatch(design: StoreDesign, patch: DesignPatch): StoreDesign {
  return applyPatch(design, patch);
}

/** La tienda, solo si es una página ejemplo. Lo demás no se toca desde acá. */
export async function getExampleStore(id: string): Promise<Store | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAdminClient()
    .from("stores")
    .select("*")
    .eq("id", id)
    .eq("example", true)
    .maybeSingle();
  return data ?? null;
}

export interface CreateExampleInput {
  name: string;
  slug: string;
  rubro: RubroId;
  whatsapp: string | null;
  instagram: string | null;
  description: string | null;
}

/**
 * Crea la página: la tienda con su diseño y formas de pago de muestra. No crea
 * usuario: nadie entra a su panel, se edita desde /super/ejemplos.
 */
export async function createExampleStore(
  input: CreateExampleInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = createAdminClient();
  const design = starterDesign(input.rubro);
  const rate = await initialExchangeRate();

  const { data: store, error } = await db
    .from("stores")
    .insert({
      slug: input.slug,
      name: input.name,
      description: input.description,
      whatsapp: input.whatsapp,
      instagram: input.instagram,
      primary_color: design.tokens.colors.primary,
      banner_url: heroPhotoUrl(RUBRO_HERO_PHOTO[input.rubro]),
      active: true,
      demo: true,
      example: true,
      ...rate,
      show_bs_prices: true,
      offers_delivery: true,
      delivery_fee: 2,
      offers_pickup: true,
      // Pro sin vencimiento: la página muestra todo lo que tendría el negocio.
      plan: "pro",
      plan_source: "comp",
      plan_expires_at: null,
      plan_note: "Página ejemplo",
      design: design as unknown as Json,
      design_published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !store) {
    reportError("createExampleStore", new Error(error?.message ?? "sin fila"), { slug: input.slug });
    return { ok: false, error: "No se pudo crear la página" };
  }

  // Las formas de pago se ven en el checkout. Los datos son de muestra y se
  // dicen como tal: el pedido igual no se crea (ver checkout/actions.ts).
  await db.from("payment_methods").insert([
    {
      store_id: store.id,
      type: "pago_movil",
      label: "Pago Móvil",
      details: { banco: "Banco de ejemplo", telefono: "0414-000-0000", cedula: "V-00.000.000", titular: input.name },
      requires_proof: true,
      display_order: 0,
    },
    {
      store_id: store.id,
      type: "zelle",
      label: "Zelle",
      details: { email: "pagos@example.com", titular: input.name },
      requires_proof: true,
      display_order: 1,
    },
    {
      store_id: store.id,
      // Sin instrucciones: el checkout ya explica el efectivo solo.
      type: "cash",
      label: "Efectivo",
      details: {},
      requires_proof: false,
      display_order: 2,
    },
  ]);

  return { ok: true, id: store.id };
}

/** Carpetas donde se suben fotos de una página ejemplo (ver uploadTicket). */
export const EXAMPLE_UPLOAD_FOLDERS = ["products", "branding"] as const;
export type ExampleUploadFolder = (typeof EXAMPLE_UPLOAD_FOLDERS)[number];

/**
 * Borra la página y todo lo suyo. Las filas hijas (productos, categorías,
 * formas de pago, visitas, carritos) se van solas con la tienda por las
 * claves foráneas en cascada; las fotos subidas se borran a mano.
 */
export async function deleteExampleStore(id: string): Promise<boolean> {
  const store = await getExampleStore(id);
  if (!store) return false;
  const db = createAdminClient();

  for (const folder of EXAMPLE_UPLOAD_FOLDERS) {
    const prefix = `${store.id}/${folder}`;
    const { data: files } = await db.storage.from(STORE_IMAGES_BUCKET).list(prefix, { limit: 1000 });
    if (files?.length) {
      await db.storage.from(STORE_IMAGES_BUCKET).remove(files.map((f) => `${prefix}/${f.name}`));
    }
  }

  const { error } = await db.from("stores").delete().eq("id", store.id).eq("example", true);
  if (error) {
    reportError("deleteExampleStore", new Error(error.message), { storeId: store.id });
    return false;
  }
  return true;
}
