"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { normalizeCode } from "@/lib/coupons";
import { isPro } from "@/lib/plans";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function requireStoreId(): Promise<string> {
  const ctx = await getSessionContext();
  if (!ctx?.store) throw new Error("No autorizado");
  return ctx.store.id;
}

/** Los cupones son del plan Pro: sin Pro vigente no se crean ni se editan. */
async function requireProStoreId(): Promise<string> {
  const ctx = await getSessionContext();
  if (!ctx?.store) throw new Error("No autorizado");
  if (!isPro(ctx.store)) throw new Error("Los cupones son del plan Pro");
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

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Las fechas del formulario son días de Caracas: "empieza el 27" es desde las
 * 00:00 del 27 y "vence el 31" es hasta las 23:59 del 31. Antes el día se
 * guardaba como medianoche UTC, que en Caracas son las 8 de la noche del día
 * anterior: un cupón que vencía "el 31" dejaba de servir el 30 en la noche.
 */
function dayStart(day: string | null | undefined): string | null {
  if (!day) return null;
  return DAY.test(day) ? new Date(`${day}T00:00:00-04:00`).toISOString() : new Date(day).toISOString();
}

function dayEnd(day: string | null | undefined): string | null {
  if (!day) return null;
  return DAY.test(day) ? new Date(`${day}T23:59:59.999-04:00`).toISOString() : new Date(day).toISOString();
}

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
    starts_at: dayStart(d.starts_at),
    expires_at: dayEnd(d.expires_at),
    active: d.active,
  };
}

/** Lo que el esquema no puede ver solo: valores que no tienen sentido juntos. */
function checkCoupon(d: z.infer<typeof couponSchema>): string | null {
  if (d.type === "percentage" && d.value > 100) return "El porcentaje no puede superar 100%";
  if (d.type !== "free_shipping" && !(d.value > 0)) return "Pon cuánto descuenta";
  if (d.starts_at && d.expires_at && d.expires_at < d.starts_at) {
    return "La fecha de vencimiento es antes de la de inicio";
  }
  return null;
}

export async function createCoupon(input: CouponInput): Promise<ActionResult> {
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const problem = checkCoupon(parsed.data);
  if (problem) return { ok: false, error: problem };

  let storeId: string;
  try {
    storeId = await requireProStoreId();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No autorizado" };
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
  const problem = checkCoupon(parsed.data);
  if (problem) return { ok: false, error: problem };

  let storeId: string;
  try {
    storeId = await requireProStoreId();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No autorizado" };
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
    storeId = await requireProStoreId();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No autorizado" };
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
