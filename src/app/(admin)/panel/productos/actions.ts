"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { slugify } from "@/lib/slug";

export const productSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto"),
  slug: z.string().trim().optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  price: z.coerce.number().min(0, "Precio inválido"),
  compare_at_price: z.coerce
    .number()
    .min(0)
    .nullable()
    .optional(),
  currency: z.string().default("USD"),
  category_id: z.string().uuid().nullable().optional(),
  stock: z.coerce.number().int().min(0).default(0),
  track_stock: z.boolean().default(true),
  low_stock_threshold: z.coerce.number().int().min(0).default(5),
  status: z.enum(["active", "draft", "archived"]).default("active"),
  featured: z.boolean().default(false),
  sku: z.string().trim().max(120).nullable().optional(),
  images: z.array(z.string()).default([]),
});

export type ProductInput = z.input<typeof productSchema>;

export interface ActionResult {
  ok: boolean;
  error?: string;
  productId?: string;
}

async function requireStoreId(): Promise<string> {
  const ctx = await getSessionContext();
  if (!ctx?.store) throw new Error("No autorizado");
  return ctx.store.id;
}

function normalize(data: z.infer<typeof productSchema>, storeId: string) {
  return {
    store_id: storeId,
    name: data.name,
    description: data.description?.trim() ? data.description.trim() : null,
    price: data.price,
    compare_at_price: data.compare_at_price ?? null,
    currency: data.currency || "USD",
    category_id: data.category_id ?? null,
    stock: data.stock,
    track_stock: data.track_stock,
    low_stock_threshold: data.low_stock_threshold,
    status: data.status,
    featured: data.featured,
    sku: data.sku?.trim() ? data.sku.trim() : null,
    images: data.images,
  };
}

export async function createProduct(input: ProductInput): Promise<ActionResult> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createClient();
  const base = normalize(parsed.data, storeId);
  const baseSlug = slugify(parsed.data.slug || parsed.data.name) || "producto";

  // Insert, retrying once with a suffix on slug collision.
  for (let attempt = 0; attempt < 2; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
    const { data, error } = await supabase
      .from("products")
      .insert({ ...base, slug })
      .select("id")
      .single();

    if (!error && data) {
      revalidatePath("/panel/productos");
      return { ok: true, productId: data.id };
    }
    if (error && error.code !== "23505") {
      return { ok: false, error: "No se pudo crear el producto" };
    }
  }
  return { ok: false, error: "Ya existe un producto con ese nombre" };
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<ActionResult> {
  try {
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    const ctx = await getSessionContext();
    if (!ctx?.store) return { ok: false, error: "No autorizado" };
    const storeId = ctx.store.id;

    const supabase = createClient();
    const base = normalize(parsed.data, storeId);
    const slug = slugify(parsed.data.slug || parsed.data.name) || "producto";

    const { error } = await supabase
      .from("products")
      .update({ ...base, slug })
      .eq("id", id)
      .eq("store_id", storeId);

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "Ya existe un producto con ese enlace (slug)" };
      }
      return { ok: false, error: `DB: ${error.message}` };
    }

    revalidatePath("/panel/productos");
    revalidatePath(`/panel/productos/${id}`);
    return { ok: true, productId: id };
  } catch (e) {
    console.error("updateProduct failed:", e);
    return {
      ok: false,
      error: e instanceof Error ? `ERR: ${e.message}` : "Error inesperado",
    };
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("store_id", storeId);

  if (error) return { ok: false, error: "No se pudo eliminar el producto" };

  revalidatePath("/panel/productos");
  return { ok: true };
}

export async function setProductStatus(
  id: string,
  status: "active" | "draft" | "archived",
): Promise<ActionResult> {
  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ status })
    .eq("id", id)
    .eq("store_id", storeId);

  if (error) return { ok: false, error: "No se pudo actualizar el estado" };

  revalidatePath("/panel/productos");
  return { ok: true };
}
