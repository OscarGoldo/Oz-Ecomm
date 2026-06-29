"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function requireStoreId(): Promise<string> {
  const ctx = await getSessionContext();
  if (!ctx?.store) throw new Error("No autorizado");
  return ctx.store.id;
}

const optStr = z.string().trim().optional().nullable();

const storeSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto"),
  description: optStr,
  primary_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido (#RRGGBB)")
    .default("#2563EB"),
  logo_url: optStr,
  banner_url: optStr,
  whatsapp: optStr,
  instagram: optStr,
  phone: optStr,
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  address: optStr,
  show_bs_prices: z.boolean().default(true),
  exchange_rate: z.coerce.number().positive("Tasa inválida").nullable().optional(),
  usdt_rate: z.coerce.number().positive("Tasa USDT inválida").nullable().optional(),
  rate_source: z.enum(["bcv", "usdt", "manual"]).default("manual"),
});

export type StoreSettingsInput = z.input<typeof storeSchema>;

export async function updateStoreSettings(
  input: StoreSettingsInput,
): Promise<ActionResult> {
  const parsed = storeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  // The effective exchange_rate (used everywhere for Bs conversion) depends on
  // which source the merchant picked. USDT/manual are set here; BCV keeps
  // auto-updating via the daily cron.
  const usdt = d.usdt_rate ?? null;
  const manualRate = d.exchange_rate ?? null;
  const effectiveRate =
    d.rate_source === "usdt"
      ? usdt
      : d.rate_source === "bcv"
        ? manualRate // current BCV value sent by the form; cron keeps it fresh
        : manualRate;

  const supabase = createClient();
  const { error } = await supabase
    .from("stores")
    .update({
      name: d.name,
      description: d.description?.trim() ? d.description.trim() : null,
      primary_color: d.primary_color,
      logo_url: d.logo_url || null,
      banner_url: d.banner_url || null,
      whatsapp: d.whatsapp?.trim() ? d.whatsapp.trim() : null,
      instagram: d.instagram?.trim() ? d.instagram.trim() : null,
      phone: d.phone?.trim() ? d.phone.trim() : null,
      email: d.email ? d.email : null,
      address: d.address?.trim() ? d.address.trim() : null,
      show_bs_prices: d.show_bs_prices,
      exchange_rate: effectiveRate,
      usdt_rate: usdt,
      rate_source: d.rate_source,
      auto_exchange_rate: d.rate_source === "bcv",
      exchange_rate_updated_at:
        effectiveRate != null ? new Date().toISOString() : null,
    })
    .eq("id", storeId);

  if (error) return { ok: false, error: "No se pudieron guardar los cambios" };

  revalidatePath("/panel/configuracion");
  revalidatePath("/panel");
  return { ok: true };
}

const deliverySchema = z.object({
  offers_delivery: z.boolean(),
  delivery_note: optStr,
  delivery_fee: z.coerce.number().min(0, "Monto inválido").default(0),
  free_delivery_min: z.coerce.number().min(0).nullable().optional(),
  offers_pickup: z.boolean(),
  pickup_address: optStr,
});

export type DeliverySettingsInput = z.input<typeof deliverySchema>;

export async function updateDeliverySettings(
  input: DeliverySettingsInput,
): Promise<ActionResult> {
  const parsed = deliverySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos" };
  }
  const d = parsed.data;

  if (!d.offers_delivery && !d.offers_pickup) {
    return { ok: false, error: "Activá al menos una opción de entrega" };
  }

  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("stores")
    .update({
      offers_delivery: d.offers_delivery,
      delivery_note: d.delivery_note?.trim() ? d.delivery_note.trim() : null,
      delivery_fee: d.delivery_fee,
      free_delivery_min: d.free_delivery_min ?? null,
      offers_pickup: d.offers_pickup,
      pickup_address: d.pickup_address?.trim() ? d.pickup_address.trim() : null,
    })
    .eq("id", storeId);

  if (error) return { ok: false, error: "No se pudieron guardar los cambios" };

  revalidatePath("/panel/configuracion/entrega");
  return { ok: true };
}
