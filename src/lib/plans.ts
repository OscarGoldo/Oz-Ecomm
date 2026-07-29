import type { Store } from "@/types/database";

/**
 * Planes de Tiendify. Fuente única de verdad de qué incluye cada uno.
 *
 * Regla de oro: los candados se aplican SIEMPRE en el server action / server
 * component. La UI solo los comunica — ocultar un botón no es seguridad.
 *
 * Nunca se bloquea la operación (pedidos, confirmar pagos, WhatsApp, finanzas):
 * si le tocas la caja al comerciante, se va. El límite muerde en crecimiento y
 * presentación (diseño, analítica, volumen).
 *
 * Nota: este archivo NO es "use server" — exporta constantes y funciones puras.
 */

export type PlanId = "free" | "pro";

/** Cuánto puede subir el plan gratis antes de pedir upgrade. */
export const FREE_MAX_PRODUCTS = 30;

/** Meses que puede comprar el comerciante de una vez. */
export const PLAN_PERIODS = [1, 12] as const;
export type PlanPeriod = (typeof PLAN_PERIODS)[number];

/** Precios por defecto, si `platform_settings` todavía no existe. */
export const DEFAULT_PRO_PRICE_USD = 5;
export const DEFAULT_PRO_PRICE_YEARLY_USD = 50;

export interface PlanLimits {
  /** Infinity en Pro. */
  maxProducts: number;
  /** Puede usar todas las plantillas (no solo las estándar). */
  allTemplates: boolean;
  /** Ve el panel de analítica con datos reales. */
  analytics: boolean;
  /** Puede crear y aplicar cupones. */
  coupons: boolean;
  /** El badge "Hecho con Tiendify" desaparece del footer. */
  hideBadge: boolean;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    maxProducts: FREE_MAX_PRODUCTS,
    allTemplates: false,
    analytics: false,
    coupons: false,
    hideBadge: false,
  },
  pro: {
    maxProducts: Infinity,
    allTemplates: true,
    analytics: true,
    coupons: true,
    hideBadge: true,
  },
};

export const PLAN_META: Record<PlanId, { label: string }> = {
  free: { label: "Gratis" },
  pro: { label: "Pro" },
};

/** Los campos de plan que necesita cualquier chequeo. */
export type PlanFields = Pick<Store, "plan" | "plan_expires_at" | "plan_source">;

/**
 * ¿Esta tienda tiene Pro vigente ahora mismo?
 *
 * El vencimiento se evalúa aquí, en lectura, no con un cron que marque tiendas
 * como vencidas: si el job falla, nadie queda regalado ni cortado por error.
 * `plan_expires_at` NULL con plan 'pro' = cortesía de por vida.
 */
export function isPro(store: Partial<PlanFields> | null | undefined): boolean {
  if (!store || store.plan !== "pro") return false;
  if (!store.plan_expires_at) return true;
  return new Date(store.plan_expires_at).getTime() > Date.now();
}

/** El plan efectivo (ya considerando el vencimiento). */
export function effectivePlan(
  store: Partial<PlanFields> | null | undefined,
): PlanId {
  return isPro(store) ? "pro" : "free";
}

/** Los límites que aplican a esta tienda hoy. */
export function planLimits(
  store: Partial<PlanFields> | null | undefined,
): PlanLimits {
  return PLAN_LIMITS[effectivePlan(store)];
}

/** Días que faltan para el vencimiento. null = no vence o ya está en gratis. */
export function daysUntilExpiry(
  store: Partial<PlanFields> | null | undefined,
): number | null {
  if (!store?.plan_expires_at || store.plan !== "pro") return null;
  const ms = new Date(store.plan_expires_at).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** Pro vigente pero a punto de vencer: dispara el banner de renovación. */
export function isExpiringSoon(
  store: Partial<PlanFields> | null | undefined,
  withinDays = 7,
): boolean {
  const d = daysUntilExpiry(store);
  return d !== null && d >= 0 && d <= withinDays;
}

/**
 * Nueva fecha de vencimiento al aprobar un pago.
 * Se extiende desde el vencimiento actual si todavía está vigente, así renovar
 * antes de tiempo no le quema días al comerciante.
 */
export function extendExpiry(
  current: string | null | undefined,
  months: number,
): string {
  const now = Date.now();
  const from = current && new Date(current).getTime() > now
    ? new Date(current)
    : new Date(now);
  const next = new Date(from);
  next.setMonth(next.getMonth() + months);
  return next.toISOString();
}

/** Precio en USD de un período, según los precios configurados. */
export function priceFor(
  months: number,
  prices: { monthly: number; yearly: number },
): number {
  return months >= 12 ? prices.yearly * (months / 12) : prices.monthly * months;
}
