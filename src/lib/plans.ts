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
 * Hay dos regímenes desde octubre de 2026 (migración 0037):
 *
 *  - Fundadoras (`founder`): las tiendas que ya existían. Si no pagan quedan
 *    en Gratis para siempre, y Pro les cuesta US$5 al mes o US$50 al año.
 *  - Las nuevas: no hay Gratis. Arrancan con Pro de prueba, después pagan el
 *    precio de lista, y si dejan vencer el plan tienen GRACE_DAYS de gracia
 *    con Pro completo antes de quedar en pausa (la vitrina no vende, el panel
 *    sigue abierto y los pedidos que ya estaban se atienden igual).
 *
 * Nota: este archivo NO es "use server" — exporta constantes y funciones puras.
 */

export type PlanId = "free" | "pro";

/** Cuánto puede subir el plan gratis antes de pedir upgrade. */
export const FREE_MAX_PRODUCTS = 30;

/**
 * Meses que puede comprar el comerciante de una vez: un mes o un año.
 *
 * Hubo un trimestre, pensado para quien paga por Pago Móvil o Zelle y no quiere
 * hacer el trámite doce veces. Se quitó porque con tarjeta era el único período
 * que no se renovaba solo, y esa excepción hacía que nadie entendiera qué estaba
 * contratando. Ahora la regla es una sola: con tarjeta se renueva, con
 * comprobante no, y los dos eligen entre mes y año.
 */
export const PLAN_PERIODS = [1, 12] as const;
export type PlanPeriod = (typeof PLAN_PERIODS)[number];

/**
 * Precio de lista de Pro. Es el que muestra la portada y el que se usa si
 * `platform_settings` todavía no existe; el que se cobra sale de ahí.
 */
export const DEFAULT_PRO_PRICE_USD = 15;
export const DEFAULT_PRO_PRICE_YEARLY_USD = 150;

/** Días que una tienda nueva sigue con Pro después de vencer, antes de pausarse. */
export const GRACE_DAYS = 7;

/** Prueba de Pro para quien crea su tienda sin código promocional. */
export const TRIAL_DAYS = 7;

const DAY_MS = 86_400_000;

/** Los dos precios configurables desde `platform_settings`. */
export interface PlanPrices {
  monthly: number;
  yearly: number;
}

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

/** Lo que pagan las fundadoras por Pro, para siempre. */
export const FOUNDER_PRICES: PlanPrices = { monthly: 5, yearly: 50 };

/**
 * Los campos de plan que necesita cualquier chequeo.
 *
 * `founder` es obligatorio a propósito (aunque valga undefined): sin él no se
 * sabe si a la tienda le toca Gratis o la pausa, y una consulta que se olvide
 * de pedirlo tiene que fallar al compilar, no tratar mal a la tienda.
 */
export type PlanFields = Partial<
  Pick<Store, "plan" | "plan_expires_at" | "plan_source">
> & { founder: boolean | undefined };

/**
 * ¿La tienda es de las que existían antes del plan único de US$15?
 *
 * Sin la columna (migración 0037 sin correr) cuenta como fundadora: es el
 * régimen de siempre, y así nadie queda en pausa por un deploy adelantado.
 */
export function isFounder(
  store: { founder?: boolean | null } | null | undefined,
): boolean {
  return store?.founder !== false;
}

/**
 * En qué está el plan de la tienda ahora mismo.
 *
 *  - `pro`: pagado, de regalo o en prueba, y vigente.
 *  - `grace`: una tienda nueva con el plan vencido hace menos de GRACE_DAYS.
 *    Sigue con todo lo de Pro; solo cambian los avisos.
 *  - `free`: una fundadora sin Pro vigente.
 *  - `paused`: una tienda nueva que pasó la gracia sin pagar.
 *
 * El vencimiento se evalúa aquí, en lectura, no con un cron que marque tiendas
 * como vencidas: si el job falla, nadie queda regalado ni cortado por error.
 * `plan_expires_at` NULL con plan 'pro' = cortesía de por vida.
 */
export type PlanState = "pro" | "grace" | "free" | "paused";

export function planState(store: PlanFields | null | undefined): PlanState {
  const founder = isFounder(store);
  if (store?.plan === "pro") {
    if (!store.plan_expires_at) return "pro";
    const end = new Date(store.plan_expires_at).getTime();
    const now = Date.now();
    if (end > now) return "pro";
    if (!founder && end + GRACE_DAYS * DAY_MS > now) return "grace";
  }
  return founder ? "free" : "paused";
}

/** ¿Esta tienda tiene Pro ahora mismo? La gracia cuenta como Pro. */
export function isPro(store: PlanFields | null | undefined): boolean {
  const state = planState(store);
  return state === "pro" || state === "grace";
}

/** Una tienda nueva que dejó vencer el plan y pasó la gracia: no vende. */
export function isPaused(store: PlanFields | null | undefined): boolean {
  return planState(store) === "paused";
}

/** Días que le quedan a una tienda en gracia antes de pausarse. */
export function daysUntilPause(store: PlanFields | null | undefined): number | null {
  if (planState(store) !== "grace" || !store?.plan_expires_at) return null;
  const pauseAt = new Date(store.plan_expires_at).getTime() + GRACE_DAYS * DAY_MS;
  return Math.max(0, Math.ceil((pauseAt - Date.now()) / DAY_MS));
}

/** Lo que le cuesta Pro a esta tienda: el de fundadora o el de lista. */
export function pricesFor(
  store: { founder?: boolean | null } | null | undefined,
  listPrices: PlanPrices,
): PlanPrices {
  return isFounder(store) ? FOUNDER_PRICES : listPrices;
}

/** Vencimiento de la prueba de quien se registra sin código. */
export function trialExpiry(): string {
  return new Date(Date.now() + TRIAL_DAYS * DAY_MS).toISOString();
}

/** El plan efectivo (ya considerando el vencimiento). */
export function effectivePlan(
  store: PlanFields | null | undefined,
): PlanId {
  return isPro(store) ? "pro" : "free";
}

/** Los límites que aplican a esta tienda hoy. */
export function planLimits(
  store: PlanFields | null | undefined,
): PlanLimits {
  return PLAN_LIMITS[effectivePlan(store)];
}

/** Días que faltan para el vencimiento. null = no vence o ya está en gratis. */
export function daysUntilExpiry(
  store: Partial<Pick<Store, "plan" | "plan_expires_at">> | null | undefined,
): number | null {
  if (!store?.plan_expires_at || store.plan !== "pro") return null;
  const ms = new Date(store.plan_expires_at).getTime() - Date.now();
  return Math.ceil(ms / DAY_MS);
}

/** Pro vigente pero a punto de vencer: dispara el banner de renovación. */
export function isExpiringSoon(
  store: Partial<Pick<Store, "plan" | "plan_expires_at">> | null | undefined,
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

/**
 * Precio en USD de un período, según los precios configurados.
 *
 * El mes y el año tienen cada uno su precio guardado en vez de salir de una
 * fórmula, para poder moverlos por separado sin redeploy. Solo el múltiplo de
 * años se calcula, porque hoy no se venden períodos de más de 12 meses.
 */
export function priceFor(months: number, prices: PlanPrices): number {
  if (months >= 12) return prices.yearly * (months / 12);
  return prices.monthly * months;
}

/**
 * ¿Cuántos meses compró? Se deduce del monto contra los precios de la tienda,
 * eligiendo el período más parecido. Lo usan los webhooks de Stripe y PayPal,
 * donde la renovación llega como un monto sin decir qué período era: si mañana
 * el anual cambia de precio, esto sigue acertando.
 */
export function periodForAmount(amount: number, prices: PlanPrices): number {
  let best: number = PLAN_PERIODS[0];
  let diff = Infinity;
  for (const m of PLAN_PERIODS) {
    const d = Math.abs(priceFor(m, prices) - amount);
    if (d < diff) {
      diff = d;
      best = m;
    }
  }
  return best;
}

/**
 * Cuánto se ahorra por mes contra pagar mes a mes, en porcentaje. 0 = sin
 * descuento. La UI lo usa para no anunciar un ahorro que no existe: si el año
 * está a 12× el mensual, no muestra nada.
 */
export function savingPct(months: number, prices: PlanPrices): number {
  if (months <= 1 || prices.monthly <= 0) return 0;
  const perMonth = priceFor(months, prices) / months;
  const pct = Math.round((1 - perMonth / prices.monthly) * 100);
  return pct > 0 ? pct : 0;
}

/** Meses regalados respecto de pagar mes a mes (para el copy del anual). */
export function freeMonths(months: number, prices: PlanPrices): number {
  if (months <= 1 || prices.monthly <= 0) return 0;
  const full = prices.monthly * months;
  const saved = full - priceFor(months, prices);
  return Math.round(saved / prices.monthly);
}
