"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth";
import { initialExchangeRate } from "@/lib/bcv";
import { recordPlatformEvent } from "@/lib/platform-events";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";
import { isReservedSlug, slugify, STORE_SLUG_MAX } from "@/lib/slug";

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
    return { ok: false, error: `El enlace "${slug}" está reservado, elige otro` };
  }
  // El enlace es también el subdominio, que aguanta 63 caracteres.
  if (slug.length > STORE_SLUG_MAX) {
    return { ok: false, error: `El enlace puede tener hasta ${STORE_SLUG_MAX} caracteres` };
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

  // Create the store, ya con la tasa del BCV de hoy (ver initialExchangeRate).
  const rate = await initialExchangeRate();
  const { data: store, error: storeErr } = await db
    .from("stores")
    .insert({
      slug,
      name: d.store_name,
      primary_color: d.primary_color,
      whatsapp: d.whatsapp?.trim() || null,
      active: true,
      ...rate,
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
    instructions: "Pagas al recibir o retirar el pedido.",
    display_order: 0,
  });

  // La creó uno de los socios: el aviso es para que el otro se entere.
  await recordPlatformEvent({
    type: "store.created",
    storeId: store.id,
    title: `Tienda nueva: ${d.store_name}`,
    detail: `${d.owner_name} · ${d.owner_email} · creada desde el super admin`,
    url: `/super/tiendas/${store.id}`,
  });

  revalidatePath("/super", "layout");
  return { ok: true, storeId: store.id, slug };
}

export interface StoreSearchHit {
  id: string;
  name: string;
  slug: string;
  ownerName: string | null;
  ownerEmail: string | null;
}

/**
 * El buscador de arriba: una tienda por su nombre, su enlace, su WhatsApp, o
 * por el nombre o el correo de su dueño.
 *
 * Busca en la base y no sobre una lista precargada para que siga andando con
 * miles de tiendas, y devuelve pocas a propósito: es para llegar a una ficha,
 * no para listar. Para listar está /super/tiendas.
 */
export async function searchStores(query: string): Promise<StoreSearchHit[]> {
  try {
    await requireSuperAdmin();
  } catch {
    return [];
  }

  // Los filtros de PostgREST se arman como texto: una coma, un paréntesis o
  // una comilla del usuario romperían el `or()`. Los comodines se quitan para
  // que "%" no devuelva la base entera.
  const q = query
    .replace(/[,()"\\%*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  if (q.length < 2) return [];

  const db = createAdminClient();
  const like = `"%${q}%"`;

  const storeFilters = [`name.ilike.${like}`, `slug.ilike.${like}`, `whatsapp.ilike.${like}`];
  // "0424 123 45 67" tiene que encontrar a "584241234567".
  const digits = q.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length >= 4) storeFilters.push(`whatsapp.ilike."%${digits}%"`);

  const [{ data: byStore }, { data: byOwner }] = await Promise.all([
    db.from("stores").select("id").or(storeFilters.join(",")).limit(8),
    db
      .from("users")
      .select("store_id")
      .eq("role", "store_owner")
      .or(`full_name.ilike.${like},email.ilike.${like}`)
      .limit(8),
  ]);

  const ids = [
    ...new Set([
      ...(byStore ?? []).map((s) => s.id),
      ...(byOwner ?? []).flatMap((u) => (u.store_id ? [u.store_id] : [])),
    ]),
  ].slice(0, 8);
  if (ids.length === 0) return [];

  const [{ data: stores }, { data: owners }] = await Promise.all([
    db.from("stores").select("id, name, slug").in("id", ids),
    db
      .from("users")
      .select("store_id, full_name, email")
      .eq("role", "store_owner")
      .in("store_id", ids)
      .order("created_at"),
  ]);

  const ownerByStore = new Map<string, { full_name: string; email: string }>();
  for (const o of owners ?? []) {
    if (o.store_id && !ownerByStore.has(o.store_id)) ownerByStore.set(o.store_id, o);
  }

  return (stores ?? [])
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      ownerName: ownerByStore.get(s.id)?.full_name ?? null,
      ownerEmail: ownerByStore.get(s.id)?.email ?? null,
    }));
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

  revalidatePath("/super", "layout");
  return { ok: true };
}

/**
 * Manda un mensaje de prueba al grupo de Telegram. Es para saber, recién
 * cargadas las variables en Vercel, que el bot está en el grupo correcto, sin
 * esperar a que entre un pago de verdad.
 */
export async function sendTelegramTest(): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
  } catch {
    return { ok: false, error: "No autorizado" };
  }
  if (!telegramConfigured()) {
    return {
      ok: false,
      error: "Faltan TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en las variables de Vercel",
    };
  }
  const sent = await sendTelegram(
    "✅ <b>Tiendify conectado</b>\nDesde ahora los avisos del super admin llegan a este grupo.",
  );
  return sent
    ? { ok: true }
    : {
        ok: false,
        error: "Telegram no aceptó el mensaje. Revisa el token y el id del grupo.",
      };
}
