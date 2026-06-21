"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth";
import { isReservedSlug, slugify } from "@/lib/slug";

export interface ActionResult {
  ok: boolean;
  error?: string;
  storeId?: string;
  slug?: string;
}

async function requireSuperAdmin(): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx || ctx.user.role !== "super_admin") {
    throw new Error("No autorizado");
  }
}

const createStoreSchema = z.object({
  store_name: z.string().trim().min(2, "Nombre de tienda muy corto"),
  slug: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? slugify(v) : "")),
  owner_name: z.string().trim().min(2, "Nombre del dueño muy corto"),
  owner_email: z.string().trim().email("Email inválido"),
  primary_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#2563EB"),
  whatsapp: z.string().trim().optional(),
});

export type CreateStoreInput = z.input<typeof createStoreSchema>;

export async function createStore(
  input: CreateStoreInput,
): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const parsed = createStoreSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  const slug = d.slug || slugify(d.store_name);
  if (!slug) return { ok: false, error: "No se pudo generar el enlace (slug)" };
  if (isReservedSlug(slug)) {
    return { ok: false, error: `El enlace "${slug}" está reservado, elegí otro` };
  }

  const db = createAdminClient();

  // Slug must be free.
  const { data: existingStore } = await db
    .from("stores")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existingStore) {
    return { ok: false, error: `El enlace "${slug}" ya está en uso` };
  }

  // Owner email must be free.
  const { data: existingUser } = await db
    .from("users")
    .select("id")
    .eq("email", d.owner_email)
    .maybeSingle();
  if (existingUser) {
    return { ok: false, error: "Ese email ya tiene una cuenta" };
  }

  // Create the store.
  const { data: store, error: storeErr } = await db
    .from("stores")
    .insert({
      slug,
      name: d.store_name,
      primary_color: d.primary_color,
      whatsapp: d.whatsapp?.trim() || null,
      active: true,
    })
    .select("id")
    .single();
  if (storeErr || !store) {
    return { ok: false, error: "No se pudo crear la tienda" };
  }

  // Create the owner auth user + profile row.
  const created = await db.auth.admin.createUser({
    email: d.owner_email,
    email_confirm: true,
  });
  const userId = created.data.user?.id;
  if (!userId) {
    await db.from("stores").delete().eq("id", store.id);
    return { ok: false, error: "No se pudo crear el usuario dueño" };
  }

  const { error: userErr } = await db.from("users").insert({
    id: userId,
    store_id: store.id,
    full_name: d.owner_name,
    email: d.owner_email,
    role: "store_owner",
    active: true,
  });
  if (userErr) {
    await db.auth.admin.deleteUser(userId);
    await db.from("stores").delete().eq("id", store.id);
    return { ok: false, error: "No se pudo crear el dueño" };
  }

  // Seed a default cash payment method so checkout works out of the box.
  await db.from("payment_methods").insert({
    store_id: store.id,
    type: "cash",
    label: "Efectivo",
    details: {},
    requires_proof: false,
    instructions: "Pagás al recibir o retirar el pedido.",
    display_order: 0,
  });

  revalidatePath("/super");
  return { ok: true, storeId: store.id, slug };
}

export async function setStoreActive(
  storeId: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("stores")
    .update({
      active,
      subscription_status: active ? "active" : "paused",
    })
    .eq("id", storeId);
  if (error) return { ok: false, error: "No se pudo actualizar la tienda" };

  revalidatePath("/super");
  return { ok: true };
}
