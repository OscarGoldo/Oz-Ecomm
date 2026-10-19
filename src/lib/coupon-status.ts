import type { Coupon, CouponType } from "@/types/database";

/**
 * En qué está un cupón y cómo se presenta. Archivo puro: lo usan la página
 * (servidor) y la lista (cliente), y el checkout decide con las mismas reglas
 * en `evaluateCoupon` (lib/coupons.ts).
 */

export type CouponStatus = "active" | "paused" | "scheduled" | "expired" | "used_up";

export const COUPON_STATUS: Record<CouponStatus, { label: string; className: string }> = {
  active: { label: "Activo", className: "bg-[#DCFCE7] text-[#166534]" },
  paused: { label: "Pausado", className: "bg-ink-100 text-ink-600" },
  scheduled: { label: "Programado", className: "bg-brand-100 text-brand-700" },
  expired: { label: "Vencido", className: "bg-[#F3F1EC] text-[#6B5E45]" },
  used_up: { label: "Agotado", className: "bg-[#FFEDE3] text-[#A8401A]" },
};

/**
 * Vencido y agotado van antes que pausado: dicen por qué el cupón ya no sirve
 * aunque lo reactive. Programado solo si está activo y todavía no empieza.
 */
export function couponStatus(c: Pick<Coupon, "active" | "starts_at" | "expires_at" | "usage_limit" | "times_used">, now = Date.now()): CouponStatus {
  if (c.expires_at && now > new Date(c.expires_at).getTime()) return "expired";
  if (c.usage_limit != null && c.times_used >= c.usage_limit) return "used_up";
  if (!c.active) return "paused";
  if (c.starts_at && now < new Date(c.starts_at).getTime()) return "scheduled";
  return "active";
}

/** El color de cada tipo: el mismo en el ticket, el botón y la vista previa. */
export const COUPON_TYPE_TONE: Record<CouponType, string> = {
  percentage: "bg-brand-100 text-brand-800",
  fixed: "bg-[#ECEAFB] text-[#3E2F9E]",
  free_shipping: "bg-[#DCF5EA] text-[#0E5A43]",
};

/** Lo que regala, dicho en una frase: "10% menos", "$5 menos", "envío gratis". */
export function couponBenefit(type: CouponType, value: number | string): string {
  const n = Number(value) || 0;
  if (type === "free_shipping") return "envío gratis";
  if (type === "fixed") return `$${Number.isInteger(n) ? n : n.toFixed(2)} menos`;
  return `${Number.isInteger(n) ? n : Math.round(n * 10) / 10}% menos`;
}

/** Lo que dice el talón del ticket: "15%", "$5" o "Envío / gratis". */
export function couponFace(type: CouponType, value: number | string): { big: string; small: string } {
  const n = Number(value) || 0;
  if (type === "free_shipping") return { big: "Envío", small: "gratis" };
  if (type === "fixed") return { big: `$${Number.isInteger(n) ? n : n.toFixed(2)}`, small: "de descuento" };
  return { big: `${Number.isInteger(n) ? n : Math.round(n * 10) / 10}%`, small: "de descuento" };
}
