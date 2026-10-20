import { daysUntilExpiry, isPaused, isPro } from "@/lib/plans";
import type {
  PlanSource,
  StorePlan,
  SubscriptionState,
  SubscriptionStatus,
} from "@/types/database";

/**
 * En qué grupo cae cada tienda para el super admin. Vive en un archivo sin
 * "server-only" porque lo usan el servidor (Inicio) y la tabla de tiendas, que
 * filtra en el navegador.
 */

/** Pro que vence dentro de estos días y no se renueva solo. */
export const EXPIRING_DAYS = 7;
/** Días sin actividad para considerar que una tienda se durmió. */
export const DORMANT_DAYS = 14;

/** Una tienda con sus números, como la devuelve `super_store_stats()`. */
export interface StoreStat {
  id: string;
  slug: string;
  name: string;
  whatsapp: string | null;
  active: boolean;
  subscription_status: SubscriptionStatus;
  plan: StorePlan;
  plan_source: PlanSource;
  plan_expires_at: string | null;
  plan_note: string | null;
  /** Fundadora: si no paga queda en Gratis; las nuevas quedan en pausa. */
  founder: boolean;
  /** De prueba o página ejemplo (migración 0038): no es un comerciante. */
  demo?: boolean;
  /** Página ejemplo de /super/ejemplos (migración 0038). */
  example?: boolean;
  stripe_subscription_status: SubscriptionState | null;
  paypal_subscription_status: SubscriptionState | null;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
  last_sign_in_at: string | null;
  /** Lo más reciente entre último ingreso, último pedido y último producto. */
  last_activity_at: string | null;
  products: number;
  sales: number;
  gmv: number;
  first_sale_at: string | null;
  last_order_at: string | null;
  /** Lo que le pagó a Tiendify en planes, en toda su vida. */
  paid_total: number;
  /** Ventas con tarjeta que todavía se le deben. */
  owed: number;
  promo_code: string | null;
  referred_by: string | null;
}

export type StoreSegment =
  | "paying"
  | "comp"
  | "free"
  | "expiring"
  | "failed"
  | "dormant"
  | "offline";

export const SEGMENT_LABEL: Record<StoreSegment, string> = {
  paying: "Pagando",
  comp: "Cortesía",
  free: "Gratis",
  expiring: "Vencen pronto",
  failed: "Cobro fallido",
  dormant: "Dormidas",
  offline: "Fuera de línea",
};

/** El orden en que se ofrecen como filtro. */
export const SEGMENT_ORDER: StoreSegment[] = [
  "paying",
  "comp",
  "free",
  "expiring",
  "failed",
  "dormant",
  "offline",
];

export function isStoreSegment(v: string | undefined): v is StoreSegment {
  return v !== undefined && (SEGMENT_ORDER as string[]).includes(v);
}

const DAY_MS = 86_400_000;

/**
 * Los grupos de una tienda. Puede caer en varios: una que paga y vence el
 * jueves es "paying" y "expiring" a la vez.
 */
export function segmentsOf(s: StoreStat, now = Date.now()): StoreSegment[] {
  const out: StoreSegment[] = [];
  const pro = isPro(s);
  const paused = isPaused(s);

  if (!pro && !paused) out.push("free");
  else if (s.plan_source === "comp") out.push("comp");
  else out.push("paying");

  // Con cobro automático activo el vencimiento se corre solo: avisar de esas
  // sería ruido. Las de cortesía sí entran, porque al vencer caen a Gratis y
  // es el momento de escribirles.
  const autoRenew =
    s.stripe_subscription_status === "active" ||
    s.paypal_subscription_status === "active";
  const days = daysUntilExpiry(s);
  if (pro && !autoRenew && days !== null && days <= EXPIRING_DAYS) {
    out.push("expiring");
  }

  if (
    pro &&
    (s.stripe_subscription_status === "suspended" ||
      s.paypal_subscription_status === "suspended")
  ) {
    out.push("failed");
  }

  // Una tienda recién creada no está dormida, está arrancando: sin actividad
  // registrada el reloj corre desde que se creó.
  const lastSeen = new Date(s.last_activity_at ?? s.created_at).getTime();
  if (s.active && now - lastSeen > DORMANT_DAYS * DAY_MS) out.push("dormant");

  // Una tienda nueva que no pagó después de la gracia tampoco vende.
  if (!s.active || paused) out.push("offline");

  return out;
}

/** De dónde vino la tienda, para mostrar en una línea. */
export function originLabel(s: StoreStat): string | null {
  if (s.promo_code) return `código ${s.promo_code}`;
  if (s.referred_by) return `referida por ${s.referred_by}`;
  return null;
}
