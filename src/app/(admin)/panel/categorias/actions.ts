"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { slugify } from "@/lib/slug";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const nameSchema = z.string().trim().min(2, "Nombre muy corto").max(60);

async function requireStoreId(): Promise<string> {
  const ctx = await getSessionContext();
  if (!ctx?.store) throw new Error("No autorizado");
  return ctx.store.id;
}

export async function createCategory(name: string): Promise<ActionResult> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createClient();
  const { data: last } = await supabase
    .from("categories")
    .select("display_order")
    .eq("store_id", storeId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (last?.display_order ?? -1) + 1;

  const baseSlug = slugify(parsed.data) || "categoria";
  for (let attempt = 0; attempt < 2; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
    const { error } = await supabase.from("categories").insert({
      store_id: storeId,
      name: parsed.data,
      slug,
      display_order: nextOrder,
    });
    if (!error) {
      revalidatePath("/panel/categorias");
      return { ok: true };
    }
    if (error.code !== "23505") {
      return { ok: false, error: "No se pudo crear la categoría" };
    }
  }
  return { ok: false, error: "Ya existe una categoría con ese nombre" };
}

export async function renameCategory(
  id: string,
  name: string,
): Promise<ActionResult> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("categories")
    .update({ name: parsed.data, slug: slugify(parsed.data) || "categoria" })
    .eq("id", id)
    .eq("store_id", storeId);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe una categoría con ese nombre" };
    }
    return { ok: false, error: "No se pudo renombrar" };
  }
  revalidatePath("/panel/categorias");
  return { ok: true };
}

export async function setCategoryActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("categories")
    .update({ active })
    .eq("id", id)
    .eq("store_id", storeId);

  if (error) return { ok: false, error: "No se pudo actualizar" };
  revalidatePath("/panel/categorias");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createClient();
  // Products keep existing (category_id is set to NULL by the FK on delete).
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("store_id", storeId);

  if (error) return { ok: false, error: "No se pudo eliminar" };
  revalidatePath("/panel/categorias");
  return { ok: true };
}

export async function reorderCategories(
  orderedIds: string[],
): Promise<ActionResult> {
  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createClient();
  // Apply new display_order index by index (scoped to the store).
  const updates = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("categories")
        .update({ display_order: index })
        .eq("id", id)
        .eq("store_id", storeId),
    ),
  );
  if (updates.some((u) => u.error)) {
    return { ok: false, error: "No se pudo reordenar" };
  }
  revalidatePath("/panel/categorias");
  return { ok: true };
}
