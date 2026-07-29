import "server-only";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SALES_STATUSES } from "@/lib/metrics";

/** Anonymous per-browser session id. httpOnly so it can't be spoofed client-side. */
export const SESSION_COOKIE = "oz_sid";
const SESSION_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export type StoreEventType =
  | "product_view"
  | "add_to_cart"
  | "checkout_start"
  | "purchase";

/** Venezuela is UTC-4 year-round (no DST). Day/hour buckets use local time. */
const VE_OFFSET_MS = -4 * 60 * 60 * 1000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Shift a UTC instant into Venezuela local time (read via getUTC* afterwards). */
function toVe(iso: string): Date {
  return new Date(new Date(iso).getTime() + VE_OFFSET_MS);
}

function veYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Read the visitor's session id, creating (and persisting) one on first sight.
 * Safe to call from a Server Action or Route Handler. Setting the cookie during
 * a plain Server Component render throws, so we swallow that — the caller still
 * gets a usable id for this request.
 */
export function getOrCreateSessionId(): string {
  const jar = cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  if (existing) return existing;
  const id = randomUUID();
  try {
    jar.set(SESSION_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  } catch {
    // Read-only context (e.g. rendering) — the event just won't tie to a cookie.
  }
  return id;
}

/**
 * Record a storefront analytics event. Fire-and-forget: never throws, so a
 * tracking hiccup can never break add-to-cart or checkout.
 */
export async function recordEvent(
  storeId: string,
  eventType: StoreEventType,
  productId?: string | null,
): Promise<void> {
  try {
    const sessionId = getOrCreateSessionId();
    const db = createAdminClient();
    await db.from("store_events").insert({
      store_id: storeId,
      session_id: sessionId,
      event_type: eventType,
      product_id: productId ?? null,
    });
  } catch {
    // Analytics is best-effort; swallow everything.
  }
}

// ── Dashboard aggregation ────────────────────────────────────────────────────

export interface FunnelStage {
  key: StoreEventType;
  label: string;
  sessions: number;
  /** % of the previous stage that reached this one (null for the first). */
  fromPrevPct: number | null;
}

export interface DayPoint {
  ymd: string;
  label: string;
  orders: number;
  usd: number;
}

export interface HourPoint {
  hour: number;
  orders: number;
  usd: number;
}

export interface ViewedProduct {
  productId: string;
  name: string;
  views: number;
  addToCarts: number;
}

export interface StoreAnalytics {
  days: number;
  hasEvents: boolean;
  // Headline KPIs
  visitors: number;
  productViews: number;
  ordersCount: number;
  salesUsd: number;
  conversionPct: number; // purchases / viewers
  // Breakdowns
  funnel: FunnelStage[];
  topViewed: ViewedProduct[];
  byDay: DayPoint[];
  byHour: HourPoint[];
  peakHour: number | null;
}

const MONTH_LABELS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/**
 * Datos de ejemplo para el preview borroso del plan Gratis. Nunca tocan la DB.
 * Son deterministas a propósito: el mismo panel en cada render, sin parpadeo.
 *
 * Ojo: la tienda Gratis SÍ sigue registrando eventos reales en `store_events`.
 * Esto solo reemplaza lo que se dibuja; el día que activa Pro ve su historial
 * completo desde el primer día, y eso es justamente lo que empuja el pago.
 */
export function sampleAnalytics(days: number): StoreAnalytics {
  const shape = [3, 5, 4, 7, 6, 9, 8, 6, 10, 7, 12, 9, 8, 11];
  const now = new Date(Date.now() + VE_OFFSET_MS);

  const byDay: DayPoint[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    const orders = shape[i % shape.length]! % 5;
    return {
      ymd: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
      label: `${d.getUTCDate()} ${MONTH_LABELS[d.getUTCMonth()]}`,
      orders,
      usd: shape[i % shape.length]! * 12.5,
    };
  });

  // Curva típica de tienda venezolana: pico al mediodía y otro a las 8pm.
  const byHour: HourPoint[] = Array.from({ length: 24 }, (_, h) => {
    const w = h >= 10 && h <= 22 ? shape[h % shape.length]! : 1;
    return { hour: h, orders: w, usd: w * 14 };
  });

  const salesUsd = byDay.reduce((s, d) => s + d.usd, 0);
  const ordersCount = byDay.reduce((s, d) => s + d.orders, 0);

  return {
    days,
    hasEvents: true,
    visitors: 412,
    productViews: 1268,
    ordersCount,
    salesUsd,
    conversionPct: 3.4,
    funnel: [
      { key: "product_view", label: "Vieron un producto", sessions: 412, fromPrevPct: null },
      { key: "add_to_cart", label: "Agregaron al carrito", sessions: 138, fromPrevPct: 33.5 },
      { key: "checkout_start", label: "Empezaron el checkout", sessions: 47, fromPrevPct: 34.1 },
      { key: "purchase", label: "Compraron", sessions: 14, fromPrevPct: 29.8 },
    ],
    topViewed: [
      { productId: "s1", name: "Producto más visto", views: 214, addToCarts: 63 },
      { productId: "s2", name: "Segundo más visto", views: 187, addToCarts: 41 },
      { productId: "s3", name: "Tercero más visto", views: 152, addToCarts: 38 },
      { productId: "s4", name: "Cuarto más visto", views: 121, addToCarts: 22 },
      { productId: "s5", name: "Quinto más visto", views: 96, addToCarts: 19 },
    ],
    byDay,
    byHour,
    peakHour: 20,
  };
}

/**
 * Everything the analytics panel needs, over a rolling window of `days`.
 * Events come from `store_events`; revenue-by-time from `orders` (the money is
 * only ever counted from real sales, never inferred from events).
 */
export async function getStoreAnalytics(
  storeId: string,
  days = 30,
): Promise<StoreAnalytics> {
  const supabase = createClient();
  const now = new Date();
  const sinceIso = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: events }, { data: orders }] = await Promise.all([
    supabase
      .from("store_events")
      .select("session_id, event_type, product_id, created_at")
      .eq("store_id", storeId)
      .gte("created_at", sinceIso),
    supabase
      .from("orders")
      .select("total, created_at")
      .eq("store_id", storeId)
      .in("status", SALES_STATUSES)
      .gte("created_at", sinceIso),
  ]);

  const evs = events ?? [];

  // Distinct sessions per funnel stage.
  const sessionsBy: Record<StoreEventType, Set<string>> = {
    product_view: new Set(),
    add_to_cart: new Set(),
    checkout_start: new Set(),
    purchase: new Set(),
  };
  const allSessions = new Set<string>();
  const viewsByProduct = new Map<string, number>();
  const cartsByProduct = new Map<string, number>();
  let productViews = 0;

  for (const e of evs) {
    const type = e.event_type as StoreEventType;
    if (sessionsBy[type]) sessionsBy[type].add(e.session_id);
    allSessions.add(e.session_id);
    if (type === "product_view") {
      productViews += 1;
      if (e.product_id)
        viewsByProduct.set(e.product_id, (viewsByProduct.get(e.product_id) ?? 0) + 1);
    } else if (type === "add_to_cart" && e.product_id) {
      cartsByProduct.set(e.product_id, (cartsByProduct.get(e.product_id) ?? 0) + 1);
    }
  }

  const viewers = sessionsBy.product_view.size;
  const carts = sessionsBy.add_to_cart.size;
  const checkouts = sessionsBy.checkout_start.size;
  const purchasers = sessionsBy.purchase.size;

  const pctOf = (n: number, base: number) => (base > 0 ? (n / base) * 100 : null);
  const funnel: FunnelStage[] = [
    { key: "product_view", label: "Vieron un producto", sessions: viewers, fromPrevPct: null },
    { key: "add_to_cart", label: "Agregaron al carrito", sessions: carts, fromPrevPct: pctOf(carts, viewers) },
    { key: "checkout_start", label: "Iniciaron el checkout", sessions: checkouts, fromPrevPct: pctOf(checkouts, carts) },
    { key: "purchase", label: "Compraron", sessions: purchasers, fromPrevPct: pctOf(purchasers, checkouts) },
  ];

  // Most-viewed products — resolve current names.
  const topIds = [...viewsByProduct.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);
  const nameById = new Map<string, string>();
  if (topIds.length > 0) {
    const { data: prods } = await supabase
      .from("products")
      .select("id, name")
      .eq("store_id", storeId)
      .in("id", topIds);
    for (const p of prods ?? []) nameById.set(p.id, p.name);
  }
  const topViewed: ViewedProduct[] = topIds.map((id) => ({
    productId: id,
    name: nameById.get(id) ?? "Producto eliminado",
    views: viewsByProduct.get(id) ?? 0,
    addToCarts: cartsByProduct.get(id) ?? 0,
  }));

  // Sales by day (fill the whole window with zeros) — Venezuela local dates.
  const dayMap = new Map<string, DayPoint>();
  const veNow = toVe(now.toISOString());
  const cursorMs = Date.UTC(
    veNow.getUTCFullYear(),
    veNow.getUTCMonth(),
    veNow.getUTCDate(),
  );
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(cursorMs - i * 24 * 60 * 60 * 1000);
    const ymd = veYmd(d);
    dayMap.set(ymd, {
      ymd,
      label: `${d.getUTCDate()} ${MONTH_LABELS[d.getUTCMonth()]}`,
      orders: 0,
      usd: 0,
    });
  }

  const hours: HourPoint[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    orders: 0,
    usd: 0,
  }));

  let salesUsd = 0;
  for (const o of orders ?? []) {
    const usd = Number(o.total);
    salesUsd += usd;
    const ve = toVe(o.created_at);
    const bucket = dayMap.get(veYmd(ve));
    if (bucket) {
      bucket.orders += 1;
      bucket.usd += usd;
    }
    const h = hours[ve.getUTCHours()];
    h.orders += 1;
    h.usd += usd;
  }

  const peakHour = hours.reduce(
    (best, cur) => (cur.orders > (hours[best]?.orders ?? -1) ? cur.hour : best),
    -1,
  );

  return {
    days,
    hasEvents: evs.length > 0,
    visitors: allSessions.size,
    productViews,
    ordersCount: (orders ?? []).length,
    salesUsd,
    conversionPct: viewers > 0 ? (purchasers / viewers) * 100 : 0,
    funnel,
    topViewed,
    byDay: [...dayMap.values()],
    byHour: hours,
    peakHour: (orders ?? []).length > 0 && peakHour >= 0 ? peakHour : null,
  };
}
