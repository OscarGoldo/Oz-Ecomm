import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { StoreStat } from "@/lib/super-segments";
import type {
  OrderStatus,
  PlanSource,
  StorePlan,
  SubscriptionState,
  SubscriptionStatus,
} from "@/types/database";

/**
 * Los números del super admin. Los calcula Postgres (migración 0030), no Node:
 * ver ese archivo para el porqué. Todo acá se lee con service role, así que
 * quien llame tiene que haber pasado antes por `requireSuperAdmin()`.
 */

/** numeric llega como string o number según el driver. */
function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

export interface SuperOverview {
  stores: number;
  activeStores: number;
  newStores: number;
  newStoresPrev: number;
  paying: number;
  comped: number;
  storesWithProducts: number;
  storesWithSale: number;
  productsTotal: number;
  mrr: number;
  /** Planes cobrados en toda la historia, antes de comisiones. */
  collectedTotal: number;
  feesTotal: number;
  /** Planes cobrados en el período, antes de comisiones. */
  collected: number;
  fees: number;
  collectedPrev: number;
  feesPrev: number;
  pendingSubs: number;
  pendingSubsUsd: number;
  gmvTotal: number;
  salesTotal: number;
  gmv: number;
  gmvPrev: number;
  /** Ventas con tarjeta cobradas por Tiendify y todavía no pagadas. */
  owed: number;
  owedStores: number;
}

/**
 * Totales de la plataforma para los últimos `days` días contra los `days`
 * anteriores. null si la migración 0030 todavía no se corrió.
 */
export async function getSuperOverview(days = 30): Promise<SuperOverview | null> {
  const { data, error } = await createAdminClient().rpc("super_overview", {
    p_days: days,
  });
  if (error || !data) return null;
  const r = data as Record<string, unknown>;

  return {
    stores: num(r.stores),
    activeStores: num(r.active_stores),
    newStores: num(r.new_stores),
    newStoresPrev: num(r.new_stores_prev),
    paying: num(r.paying),
    comped: num(r.comped),
    storesWithProducts: num(r.stores_with_products),
    storesWithSale: num(r.stores_with_sale),
    productsTotal: num(r.products_total),
    mrr: num(r.mrr),
    collectedTotal: num(r.collected_total),
    feesTotal: num(r.fees_total),
    collected: num(r.collected),
    fees: num(r.fees),
    collectedPrev: num(r.collected_prev),
    feesPrev: num(r.fees_prev),
    pendingSubs: num(r.pending_subs),
    pendingSubsUsd: num(r.pending_subs_usd),
    gmvTotal: num(r.gmv_total),
    salesTotal: num(r.sales_total),
    gmv: num(r.gmv),
    gmvPrev: num(r.gmv_prev),
    owed: num(r.owed),
    owedStores: num(r.owed_stores),
  };
}

export interface StoreStatsResult {
  stores: StoreStat[];
  /**
   * false cuando la migración 0030 no está: la lista sale igual, pero sin
   * ventas, GMV, actividad ni origen. Quien la muestre tiene que decirlo.
   */
  complete: boolean;
}

/** Todas las tiendas con sus números, de la más nueva a la más vieja. */
export async function getStoreStats(): Promise<StoreStatsResult> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("super_store_stats");

  if (!error && Array.isArray(data)) {
    const stores = (data as Record<string, unknown>[]).map(
      (r): StoreStat => ({
        id: String(r.id),
        slug: String(r.slug),
        name: String(r.name),
        whatsapp: str(r.whatsapp),
        active: r.active === true,
        subscription_status: (str(r.subscription_status) ??
          "active") as SubscriptionStatus,
        plan: (str(r.plan) ?? "free") as StorePlan,
        plan_source: (str(r.plan_source) ?? "free") as PlanSource,
        plan_expires_at: str(r.plan_expires_at),
        plan_note: str(r.plan_note),
        // La función de la base no la trae; se completa abajo.
        founder: true,
        stripe_subscription_status: str(
          r.stripe_subscription_status,
        ) as SubscriptionState | null,
        paypal_subscription_status: str(
          r.paypal_subscription_status,
        ) as SubscriptionState | null,
        created_at: String(r.created_at),
        owner_name: str(r.owner_name),
        owner_email: str(r.owner_email),
        last_sign_in_at: str(r.last_sign_in_at),
        last_activity_at: str(r.last_activity_at),
        products: num(r.products),
        sales: num(r.sales),
        gmv: num(r.gmv),
        first_sale_at: str(r.first_sale_at),
        last_order_at: str(r.last_order_at),
        paid_total: num(r.paid_total),
        owed: num(r.owed),
        promo_code: str(r.promo_code),
        referred_by: str(r.referred_by),
      }),
    );
    // `super_store_stats` es anterior al precio de fundador (0037). En vez de
    // rehacer la función, se lee la columna aparte: son pocas filas.
    const { data: founders } = await db.from("stores").select("id, founder");
    const founderById = new Map((founders ?? []).map((f) => [f.id, f.founder]));
    for (const s of stores) s.founder = founderById.get(s.id) ?? true;
    return { stores, complete: true };
  }

  // Sin la migración no hay agregados, pero perder la lista de tiendas por eso
  // sería peor que mostrarla con los números en cero.
  const [{ data: stores }, { data: owners }] = await Promise.all([
    db.from("stores").select("*").order("created_at", { ascending: false }),
    db
      .from("users")
      .select("store_id, full_name, email")
      .eq("role", "store_owner")
      .order("created_at"),
  ]);
  const ownerByStore = new Map<string, { full_name: string; email: string }>();
  for (const o of owners ?? []) {
    if (o.store_id && !ownerByStore.has(o.store_id)) ownerByStore.set(o.store_id, o);
  }

  return {
    complete: false,
    stores: (stores ?? []).map((s) => {
      const owner = ownerByStore.get(s.id);
      return {
        id: s.id,
        slug: s.slug,
        name: s.name,
        whatsapp: s.whatsapp,
        active: s.active,
        subscription_status: s.subscription_status,
        plan: s.plan,
        plan_source: s.plan_source,
        plan_expires_at: s.plan_expires_at,
        plan_note: s.plan_note,
        founder: s.founder ?? true,
        stripe_subscription_status: s.stripe_subscription_status,
        paypal_subscription_status: s.paypal_subscription_status,
        created_at: s.created_at,
        owner_name: owner?.full_name ?? null,
        owner_email: owner?.email ?? null,
        last_sign_in_at: null,
        last_activity_at: null,
        products: 0,
        sales: 0,
        gmv: 0,
        first_sale_at: null,
        last_order_at: null,
        paid_total: 0,
        owed: 0,
        promo_code: null,
        referred_by: null,
      };
    }),
  };
}

/* --- Gráficos de Inicio ---------------------------------------------------- */

/** Etiquetas de los métodos con que una tienda le paga el plan a Tiendify. */
const PLAN_METHOD_LABEL: Record<string, string> = {
  stripe: "Tarjeta",
  paypal: "PayPal",
  pago_movil: "Pago Móvil",
  binance: "Binance",
  zelle: "Zelle",
};

/** Etiquetas de los métodos con que el cliente le paga a la tienda. */
const ORDER_METHOD_LABEL: Record<string, string> = {
  pago_movil: "Pago Móvil",
  zelle: "Zelle",
  binance: "Binance",
  cash: "Efectivo",
  transfer: "Transferencia",
  stripe: "Tarjeta",
  paypal: "PayPal",
  other: "Otro",
};

const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Las mismas que sales_statuses() en la base: lo que cuenta como venta. */
const SALES: OrderStatus[] = ["confirmed", "preparing", "in_delivery", "completed"];

/** Más de esto no se trae para un gráfico: es un tope de seguridad. */
const MAX_ROWS = 20000;

/**
 * PostgREST corta cada respuesta en 1000 filas, así que las tablas que pueden
 * pasar de eso se traen de a páginas.
 */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

export interface SuperCharts {
  /**
   * El MRR al cierre de cada uno de los últimos 12 meses, con el mismo
   * criterio que super_overview: por tienda, el último pago aprobado que
   * todavía la cubre, llevado a un mes. El último punto es hoy.
   */
  mrrByMonth: { key: string; label: string; mrr: number }[];
  /** Planes cobrados en el período, por método. Mayor a menor. */
  collectedByMethod: { method: string; label: string; usd: number }[];
  /** Ventas de todas las tiendas en el período, por método del cliente. */
  gmvByMethod: { method: string; label: string; usd: number; count: number }[];
  /** Las tiendas que más vendieron en el período. */
  topStores: { storeId: string; usd: number; orders: number }[];
  /** Ventas (pedidos que cuentan como venta) en el período. */
  salesCount: number;
}

/**
 * Lo que necesitan los gráficos de Inicio y que super_overview no trae.
 * Se arma con consultas directas (service role) en vez de una migración nueva:
 * son pocas tablas y los volúmenes de hoy entran holgados en memoria.
 */
export async function getSuperCharts(days: number): Promise<SuperCharts> {
  const db = createAdminClient();
  const now = new Date();
  const periodFrom = new Date(now.getTime() - days * 86_400_000).toISOString();
  // Un anual pagado hace 23 meses todavía cubre el primer mes del gráfico.
  const paymentsFrom = addMonths(now, -24).toISOString();

  const [payments, orders] = await Promise.all([
    fetchAll<{
      store_id: string;
      amount: number | string;
      period_months: number;
      method: string;
      created_at: string;
    }>((from, to) =>
      db
        .from("subscription_payments")
        .select("store_id, amount, period_months, method, created_at")
        .eq("status", "approved")
        .gte("created_at", paymentsFrom)
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
    fetchAll<{ store_id: string; total: number | string; payment_method_type: string | null }>(
      (from, to) =>
        db
          .from("orders")
          .select("store_id, total, payment_method_type")
          .in("status", SALES)
          .gte("created_at", periodFrom)
          .order("created_at", { ascending: true })
          .range(from, to),
    ),
  ]);

  // MRR al cierre de cada mes. Los pagos vienen del más viejo al más nuevo,
  // así que el último que se ve de cada tienda antes del cierre es su vigente.
  // Once cierres de mes y hoy; el punto de hoy lo reemplaza quien llama por el
  // MRR exacto de super_overview, cuando lo tiene.
  const ends: Date[] = [];
  for (let i = 11; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    ends.push(new Date(d.getTime() - 1));
  }
  ends.push(now);
  const mrrByMonth = ends.map((end) => {
    const latest = new Map<string, { amount: number; months: number; at: Date }>();
    for (const p of payments) {
      const at = new Date(p.created_at);
      if (at > end) break;
      latest.set(p.store_id, { amount: num(p.amount), months: p.period_months || 1, at });
    }
    let mrr = 0;
    for (const l of latest.values()) {
      if (addMonths(l.at, l.months) > end) mrr += l.amount / l.months;
    }
    return {
      key: `${end.getFullYear()}-${end.getMonth() + 1}`,
      label: MONTH_SHORT[end.getMonth()],
      mrr: Math.round(mrr * 100) / 100,
    };
  });

  const byMethod = new Map<string, number>();
  for (const p of payments) {
    if (p.created_at < periodFrom) continue;
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + num(p.amount));
  }
  const collectedByMethod = [...byMethod.entries()]
    .map(([method, usd]) => ({ method, label: PLAN_METHOD_LABEL[method] ?? method, usd }))
    .sort((a, b) => b.usd - a.usd);

  const gmvMethods = new Map<string, { usd: number; count: number }>();
  const gmvStores = new Map<string, { usd: number; orders: number }>();
  for (const o of orders) {
    const total = num(o.total);
    const method = o.payment_method_type ?? "other";
    const m = gmvMethods.get(method) ?? { usd: 0, count: 0 };
    m.usd += total;
    m.count += 1;
    gmvMethods.set(method, m);
    const s = gmvStores.get(o.store_id) ?? { usd: 0, orders: 0 };
    s.usd += total;
    s.orders += 1;
    gmvStores.set(o.store_id, s);
  }

  return {
    mrrByMonth,
    collectedByMethod,
    gmvByMethod: [...gmvMethods.entries()]
      .map(([method, v]) => ({ method, label: ORDER_METHOD_LABEL[method] ?? method, ...v }))
      .sort((a, b) => b.usd - a.usd),
    topStores: [...gmvStores.entries()]
      .map(([storeId, v]) => ({ storeId, ...v }))
      .sort((a, b) => b.usd - a.usd)
      .slice(0, 6),
    salesCount: orders.length,
  };
}
