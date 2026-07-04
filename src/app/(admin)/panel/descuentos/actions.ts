"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { normalizeCode } from "@/lib/coupons";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function requireStoreId(): Promise<string> {
  const ctx = await getSessionContext();
  if (!ctx?.store) throw new Error("No autorizado");
  return ctx.store.id;
}

const nullableNumber = z.coerce.number().min(0).nullable().optional();

const couponSchema = z.object({
  code: z.string().trim().min(2, "Pon un código").max(40),
  type: z.enum(["percentage", "fixed", "free_shipping"]),
  value: z.coerce.number().min(0).default(0),
  min_cart: nullableNumber,
  max_discount: nullableNumber,
  usage_limit: z.coerce.number().int().min(1).nullable().optional(),
  starts_at: z.string().trim().nullable().optional(),
  expires_at: z.string().trim().nullable().optional(),
  active: z.boolean().default(true),
});

export type CouponInput = z.input<typeof couponSchema>;

function buildRow(d: z.infer<typeof couponSchema>, storeId: string) {
  const isPercentage = d.type === "percentage";
  return {
    store_id: storeId,
    code: normalizeCode(d.code),
    type: d.type,
    value: d.type === "free_shipping" ? 0 : d.value,
    min_cart: d.min_cart ?? null,
    max_discount: isPercentage ? (d.max_discount ?? null) : null,
    usage_limit: d.usage_limit ?? null,
    starts_at: d.starts_at ? new Date(d.starts_at).toISOString() : null,
    expires_at: d.expires_at ? new Date(d.expires_at).toISOString() : null,
    active: d.active,
  };
}

export async function createCoupon(input: CouponInput): Promise<ActionResult> {
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  if (parsed.data.type === "percentage" && parsed.data.value > 100) {
    return { ok: false, error: "El porcentaje no puede superar 100%" };
  }

  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("coupons")
    .insert(buildRow(parsed.data, storeId));
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un cupón con ese código" };
    }
    return { ok: false, error: "No se pudo crear el cupón" };
  }
  revalidatePath("/panel/descuentos");
  return { ok: true };
}

export async function updateCoupon(
  id: string,
  input: CouponInput,
): Promise<ActionResult> {
  const parsed = couponSchema.safeParse(input);
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
  const { error } = await supabase
    .from("coupons")
    .update(buildRow(parsed.data, storeId))
    .eq("id", id)
    .eq("store_id", storeId);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un cupón con ese código" };
    }
    return { ok: false, error: "No se pudo guardar el cupón" };
  }
  revalidatePath("/panel/descuentos");
  return { ok: true };
}

export async function setCouponActive(
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
    .from("coupons")
    .update({ active })
    .eq("id", id)
    .eq("store_id", storeId);
  if (error) return { ok: false, error: "No se pudo actualizar" };
  revalidatePath("/panel/descuentos");
  return { ok: true };
}

export async function deleteCoupon(id: string): Promise<ActionResult> {
  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("coupons")
    .delete()
    .eq("id", id)
    .eq("store_id", storeId);
  if (error) return { ok: false, error: "No se pudo eliminar" };
  revalidatePath("/panel/descuentos");
  return { ok: true };
}
