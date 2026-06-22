import { createAdminClient } from "@/lib/supabase/admin";
import type { Coupon } from "@/types/database";

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export interface CouponEvaluation {
  valid: boolean;
  reason?: string;
  /** Discount applied to the items subtotal (USD). */
  discount: number;
  /** Whether the coupon waives the shipping cost. */
  freeShipping: boolean;
}

/** Pure evaluation of a coupon against a cart subtotal. */
export function evaluateCoupon(
  coupon: Coupon,
  subtotalUsd: number,
): CouponEvaluation {
  const fail = (reason: string): CouponEvaluation => ({
    valid: false,
    reason,
    discount: 0,
    freeShipping: false,
  });

  if (!coupon.active) return fail("El cupón no está activo");

  const now = Date.now();
  if (coupon.starts_at && now < new Date(coupon.starts_at).getTime()) {
    return fail("El cupón todavía no está vigente");
  }
  if (coupon.expires_at && now > new Date(coupon.expires_at).getTime()) {
    return fail("El cupón está vencido");
  }
  if (coupon.usage_limit != null && coupon.times_used >= coupon.usage_limit) {
    return fail("El cupón alcanzó su límite de usos");
  }
  if (coupon.min_cart != null && subtotalUsd < Number(coupon.min_cart)) {
    return fail(`Requiere una compra mínima de $${Number(coupon.min_cart).toFixed(2)}`);
  }

  if (coupon.type === "free_shipping") {
    return { valid: true, discount: 0, freeShipping: true };
  }

  let discount = 0;
  if (coupon.type === "percentage") {
    discount = (subtotalUsd * Number(coupon.value)) / 100;
    if (coupon.max_discount != null) {
      discount = Math.min(discount, Number(coupon.max_discount));
    }
  } else if (coupon.type === "fixed") {
    discount = Number(coupon.value);
  }

  discount = Math.min(discount, subtotalUsd);
  discount = Math.round(discount * 100) / 100;
  return { valid: true, discount, freeShipping: false };
}

/** Look up a coupon by code (service role — codes aren't publicly readable). */
export async function findCouponByCode(
  storeId: string,
  code: string,
): Promise<Coupon | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("coupons")
    .select("*")
    .eq("store_id", storeId)
    .eq("code", normalizeCode(code))
    .maybeSingle();
  return (data as Coupon) ?? null;
}
