"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  aiPhotoLimits,
  aiPhotoQuota,
  aiProductsAvailable,
  AI_PRODUCT_KIND,
  AI_PRODUCT_MODEL,
  describeProductPhoto,
  sameName,
  type AiPhotoQuota,
  type PhotoDraft,
} from "@/lib/ai-products";
import { reserveAiCall } from "@/lib/ai-budget";
import { getSessionContext } from "@/lib/auth";
import { isPro, planLimits } from "@/lib/plans";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

/**
 * Solo fotos de productos de la propia tienda, con el nombre que les pone el
 * uploader (<uuid>.<ext>). Sin esto, la acción serviría para hacerle leer a la
 * IA cualquier archivo del bucket.
 */
function ownsPhoto(storeId: string, path: string): boolean {
  return new RegExp(`^${storeId}/products/[A-Za-z0-9-]+\\.(jpe?g|png|webp)$`).test(path);
}

/** Por qué no puede leer otra foto ahora, según su cupo. */
function quotaMessage(quota: AiPhotoQuota): string {
  return quota.pro
    ? "Llegaste al tope de fotos con IA por ahora. Complétala a mano."
    : `Ya usaste las ${quota.limit} fotos con IA del mes. Complétala a mano o activa Pro.`;
}

export type ReadPhotoResult =
  | { ok: true; draft: PhotoDraft; quota: AiPhotoQuota }
  | { ok: false; error: string; quota?: AiPhotoQuota };

/** Lee una foto ya subida y devuelve la ficha que propone la IA. No guarda nada. */
export async function readProductPhoto(path: string): Promise<ReadPhotoResult> {
  const ctx = await getSessionContext();
  const store = ctx?.store;
  if (!store) return { ok: false, error: "No autorizado" };
  if (typeof path !== "string" || !ownsPhoto(store.id, path)) {
    return { ok: false, error: "Foto inválida" };
  }

  const quota = aiProductsAvailable() ? await aiPhotoQuota(store) : null;
  if (!quota) return { ok: false, error: "La carga con IA no está disponible en este momento." };
  if (quota.remaining <= 0) {
    return { ok: false, quota, error: quotaMessage(quota) };
  }

  // Con la sesión del dueño: RLS solo deja ver lo suyo.
  const supabase = createClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name")
      .eq("store_id", store.id)
      .order("display_order")
      .limit(40),
    supabase
      .from("products")
      .select("name")
      .eq("store_id", store.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  // El conteo de arriba es para el mensaje; el cupo de verdad se cumple acá,
  // anotando el intento antes de llamar (ver lib/ai-budget). El panel manda
  // varias fotos a la vez, así que sin esto un lote pasaba el cupo entero.
  const reservation = await reserveAiCall({
    storeId: store.id,
    kind: AI_PRODUCT_KIND,
    model: AI_PRODUCT_MODEL,
    limits: aiPhotoLimits(isPro(store)),
  });
  if (!reservation.ok) {
    const now = (await aiPhotoQuota(store)) ?? { ...quota, remaining: 0 };
    return {
      ok: false,
      quota: now,
      error:
        reservation.reason === "store"
          ? quotaMessage(now)
          : reservation.reason === "platform"
            ? "La carga con IA llegó a su tope por hoy. Complétala a mano o vuelve mañana."
            : reservation.reason === "platform_month"
              ? "La carga con IA no está disponible por ahora. Mientras tanto, completa el producto a mano."
              : "La carga con IA no está disponible en este momento.",
    };
  }

  const res = await describeProductPhoto(reservation.id, store.id, path, {
    storeName: store.name,
    storeDescription: store.description,
    categories: categories ?? [],
    productNames: (products ?? []).map((p) => p.name),
  });
  const after = (await aiPhotoQuota(store)) ?? quota;
  return res.ok ? { ok: true, draft: res.draft, quota: after } : { ok: false, error: res.error, quota: after };
}

const itemSchema = z.object({
  image: z.string(),
  name: z.string().trim().min(2, "Cada producto necesita un nombre").max(120),
  description: z.string().trim().max(4000).default(""),
  price: z.number().min(0).nullable(),
  stock: z.number().int().min(0).nullable(),
  categoryId: z.string().uuid().nullable(),
  newCategory: z.string().trim().max(60).nullable(),
});

const itemsSchema = z.array(itemSchema).min(1).max(20);

export type PhotoProductInput = z.input<typeof itemSchema>;

export type CreateFromPhotosResult =
  | { ok: true; published: number; drafts: number }
  /** `saved`: índices que sí se guardaron antes del error, para no repetirlos. */
  | { ok: false; error: string; saved?: number[] };

/**
 * Crea los productos que el comerciante revisó. Los que tienen precio salen
 * publicados; los que no, quedan como borrador para completarlos después.
 * Mismas reglas que el alta de a uno: cupo del plan, slug único por tienda.
 */
export async function createProductsFromPhotos(
  input: PhotoProductInput[],
): Promise<CreateFromPhotosResult> {
  const parsed = itemsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const items = parsed.data;

  const ctx = await getSessionContext();
  const store = ctx?.store;
  if (!store) return { ok: false, error: "No autorizado" };
  const storeId = store.id;
  if (items.some((i) => !ownsPhoto(storeId, i.image))) {
    return { ok: false, error: "Hay una foto inválida" };
  }

  const supabase = createClient();

  const { maxProducts } = planLimits(store);
  if (Number.isFinite(maxProducts)) {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .neq("status", "archived");
    const left = Math.max(0, maxProducts - (count ?? 0));
    if (items.length > left) {
      return {
        ok: false,
        error:
          left === 0
            ? `Llegaste a los ${maxProducts} productos del plan Gratis. Activa Pro para cargar más.`
            : `En el plan Gratis te quedan ${left} productos. Quita ${items.length - left} o activa Pro.`,
      };
    }
  }

  // Categorías: las existentes se validan contra la tienda; las nuevas se
  // crean una sola vez aunque varias fotos las pidan, y si ya existía una con
  // ese nombre se usa esa.
  const { data: existingCats } = await supabase
    .from("categories")
    .select("id, name, display_order")
    .eq("store_id", store.id);
  const cats = existingCats ?? [];
  const validIds = new Set(cats.map((c) => c.id));
  let nextOrder = cats.reduce((m, c) => Math.max(m, c.display_order), -1) + 1;
  const created = new Map<string, string>();

  async function categoryFor(name: string): Promise<string | null> {
    const found = cats.find((c) => sameName(c.name, name));
    if (found) return found.id;
    for (const [key, id] of created) if (sameName(key, name)) return id;

    const baseSlug = slugify(name) || "categoria";
    for (let attempt = 0; attempt < 2; attempt++) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
      const { data, error } = await supabase
        .from("categories")
        .insert({ store_id: storeId, name, slug, display_order: nextOrder })
        .select("id")
        .single();
      if (!error && data) {
        nextOrder++;
        created.set(name, data.id);
        return data.id;
      }
      if (error && error.code !== "23505") return null;
    }
    return null;
  }

  let published = 0;
  let drafts = 0;
  const saved: number[] = [];
  for (const [index, item] of items.entries()) {
    let categoryId = item.categoryId && validIds.has(item.categoryId) ? item.categoryId : null;
    if (!categoryId && item.newCategory) categoryId = await categoryFor(item.newCategory);

    const hasPrice = item.price !== null && item.price > 0;
    const row = {
      store_id: storeId,
      name: item.name,
      description: item.description || null,
      price: hasPrice ? item.price! : 0,
      currency: "USD",
      category_id: categoryId,
      // Sin cantidad = no lleva el stock: el producto se vende siempre. Con
      // stock 0 y control activo saldría "Agotado" apenas se publica.
      stock: item.stock ?? 0,
      track_stock: item.stock !== null,
      status: hasPrice ? ("active" as const) : ("draft" as const),
      images: [item.image],
    };

    const baseSlug = slugify(item.name) || "producto";
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      const slug =
        attempt === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await supabase.from("products").insert({ ...row, slug });
      if (!error) ok = true;
      else if (error.code !== "23505") break;
    }
    if (!ok) {
      revalidatePath("/panel/productos");
      return {
        ok: false,
        saved,
        error:
          saved.length > 0
            ? `Se guardaron ${saved.length} y "${item.name}" falló. Toca Publicar de nuevo para intentar con los que faltan.`
            : `No se pudo guardar "${item.name}". Intenta de nuevo.`,
      };
    }
    saved.push(index);
    if (hasPrice) published++;
    else drafts++;
  }

  revalidatePath("/panel/productos");
  if (created.size > 0) revalidatePath("/panel/categorias");
  return { ok: true, published, drafts };
}
