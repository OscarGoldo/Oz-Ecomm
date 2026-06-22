"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { isReservedSlug, slugify } from "@/lib/slug";

export interface SignupResult {
  ok: boolean;
  error?: string;
  slug?: string;
}

const schema = z.object({
  store_name: z.string().trim().min(2, "El nombre de la tienda es muy corto"),
  owner_name: z.string().trim().min(2, "Ingresá tu nombre"),
  owner_email: z.string().trim().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  primary_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  whatsapp: z.string().trim().optional(),
});

export type SignupInput = z.input<typeof schema>;

/** Public self-service store creation (Shopify/Tiendanube style). */
export async function signUpStore(input: SignupInput): Promise<SignupResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  const db = createAdminClient();

  // Email must be free.
  const { data: existingUser } = await db
    .from("users")
    .select("id")
    .eq("email", d.owner_email)
    .maybeSingle();
  if (existingUser) {
    return {
      ok: false,
      error: "Ese email ya tiene una cuenta. Iniciá sesión.",
    };
  }

  // Find a free slug (append a short suffix on collision).
  const base = slugify(d.store_name) || "tienda";
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (isReservedSlug(candidate)) continue;
    const { data: taken } = await db
      .from("stores")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!taken) {
      slug = candidate;
      break;
    }
    if (attempt === 4) {
      return { ok: false, error: "No se pudo generar un enlace único. Probá otro nombre." };
    }
  }

  // Create the store.
  const { data: store, error: storeErr } = await db
    .from("stores")
    .insert({
      slug,
      name: d.store_name,
      primary_color: d.primary_color ?? "#2563EB",
      whatsapp: d.whatsapp?.trim() || null,
      active: true,
    })
    .select("id")
    .single();
  if (storeErr || !store) {
    return { ok: false, error: "No se pudo crear la tienda. Intentá de nuevo." };
  }

  // Create the owner auth user with their password.
  const created = await db.auth.admin.createUser({
    email: d.owner_email,
    password: d.password,
    email_confirm: true,
  });
  const userId = created.data.user?.id;
  if (!userId) {
    await db.from("stores").delete().eq("id", store.id);
    return { ok: false, error: "No se pudo crear tu cuenta. ¿Ya estás registrado?" };
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
    return { ok: false, error: "No se pudo crear tu cuenta. Intentá de nuevo." };
  }

  // Default cash payment method so checkout works immediately.
  await db.from("payment_methods").insert({
    store_id: store.id,
    type: "cash",
    label: "Efectivo",
    details: {},
    requires_proof: false,
    instructions: "Pagás al recibir o retirar el pedido.",
    display_order: 0,
  });

  return { ok: true, slug };
}
