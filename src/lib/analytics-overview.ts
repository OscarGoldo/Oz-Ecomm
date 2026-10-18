import "server-only";

import { abandonedCartCutoff } from "@/lib/constants";
import { formatUSD } from "@/lib/format";
import { SALES_STATUSES } from "@/lib/metrics";
import { caracasToday, resolvePeriod, type ReportPeriod } from "@/lib/report-period";
import { createClient } from "@/lib/supabase/server";
import { VISIT_SOURCES, isVisitSource, type VisitSource } from "@/lib/visit-source";

/**
 * La analítica del panel: quién entra, dónde se va, qué productos atraen y
 * cuáles convencen, cuándo le compran, quién vuelve y de dónde llegan.
 *
 * Las visitas salen de `store_events` (una fila por evento, con la sesión
 * anónima del navegador); la plata, siempre de `orders`. Antes se leían los
 * eventos de una sola consulta y PostgREST cortaba en mil filas sin avisar:
 * una tienda con movimiento veía menos visitas de las que tuvo. Ahora se leen
 * de a mil hasta el final.
 */

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

/** La franja del mapa de horas: de a tres horas, hora de Venezuela. */
export const HEAT_SLOTS = ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"];
const SLOT_TEXT = [
  "de 12 a 3 de la madrugada",
  "de 3 a 6 de la mañana",
  "de 6 a 9 de la mañana",
  "de 9 a 12 del mediodía",
  "de 12 a 3 de la tarde",
  "de 3 a 6 de la tarde",
  "de 6 a 9 de la noche",
  "de 9 a 12 de la noche",
];
export const HEAT_DAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const DAY_PLURAL = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Días del mapa de horas: tres meses, para que haya pedidos suficientes. */
const HEAT_DAYS_BACK = 90;
/** Freno para no leer para siempre en una tienda enorme. */
const MAX_ROWS = 100_000;

export type Quadrant = "star" | "gem" | "leak" | "cold";

export interface AnalyticsInsight {
  tone: "warn" | "good" | "info" | "gem";
  title: string;
  body: string;
  href?: string;
  cta?: string;
}

export interface AnalyticsOverview {
  days: AnalyticsRange;
  period: Pick<ReportPeriod, "from" | "to" | "label"> & { previousLabel: string };
  hasEvents: boolean;
  visitors: number;
  prevVisitors: number;
  /** Visitantes que abrieron al menos un producto: la base de la conversión. */
  viewers: number;
  conversionPct: number | null;
  prevConversionPct: number | null;
  orders: number;
  prevOrders: number;
  salesUsd: number;
  funnel: { key: string; label: string; sessions: number }[];
  /** El paso del embudo donde más gente se va, entre los que se recuperan. */
  leak: { index: number; lost: number; pct: number } | null;
  daily: { label: string; visitors: number; prevVisitors: number; orders: number }[];
  bestDay: { label: string; visitors: number } | null;
  sources: {
    rows: { id: VisitSource; label: string; color: string; visitors: number; buyers: number; convPct: number | null }[];
    /** Visitantes con origen registrado (los de antes de medirlo no lo tienen). */
    tracked: number;
    /** Desde qué día se mide, si fue dentro del período. */
    since: string | null;
    /** "WhatsApp compra 2,5 veces más que Instagram", si hay datos para decirlo. */
    highlight: string | null;
  };
  heat: { cells: number[][]; peak: { day: number; slot: number; orders: number } | null; total: number };
  customers: {
    total: number;
    returning: number;
    returningUsdPct: number | null;
    top: { name: string; orders: number; usd: number }[];
  };
  products: {
    rows: { productId: string; name: string; views: number; carts: number; ratePct: number; quadrant: Quadrant }[];
    medianViews: number;
    avgRatePct: number;
  };
  carts: { count: number; usd: number };
  insights: AnalyticsInsight[];
}

// ── Utilidades ──────────────────────────────────────────────────────────────

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** De a mil filas hasta el final (o hasta `MAX_ROWS`). Un error corta todo. */
async function fetchAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const from = rows.length;
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000 || rows.length >= MAX_ROWS) return rows;
  }
}

/** El mismo criterio que `phone_key` en la base: los últimos 9 dígitos. */
function phoneKey(phone: string | null, name: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length >= 6) return digits.slice(-9);
  return `nombre:${(name ?? "").trim().toLowerCase()}`;
}

/** Día de Caracas ("2026-10-18") de un instante. */
function caracasDay(iso: string): string {
  return caracasToday(new Date(iso));
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function dayIndex(from: string, day: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [y, m, d] = day.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

function shortLabel(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  // 0 = lunes … 6 = domingo
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function pct(n: number, base: number): number | null {
  return base > 0 ? (n / base) * 100 : null;
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString("es-VE", { maximumFractionDigits: 1 });
}

// ── Lectura ─────────────────────────────────────────────────────────────────

type EventRow = {
  session_id: string;
  event_type: string;
  product_id: string | null;
  created_at: string;
  source?: string | null;
};

async function readEvents(storeId: string, fromISO: string, toISO: string): Promise<EventRow[]> {
  const supabase = createClient();
  const page = (columns: string) => (from: number, to: number) =>
    supabase
      .from("store_events")
      .select(columns)
      .eq("store_id", storeId)
      .gte("created_at", fromISO)
      .lt("created_at", toISO)
      .order("created_at")
      .order("id")
      .range(from, to) as unknown as Page<EventRow>;
  try {
    return await fetchAll(page("session_id, event_type, product_id, created_at, source"));
  } catch {
    // Sin la migración 0035 no existe `source`: se lee lo demás.
    return fetchAll(page("session_id, event_type, product_id, created_at"));
  }
}

// ── Todo junto ──────────────────────────────────────────────────────────────

export async function getAnalyticsOverview(
  storeId: string,
  days: AnalyticsRange,
): Promise<AnalyticsOverview> {
  const today = caracasToday();
  const period = resolvePeriod({ desde: addDays(today, -(days - 1)), hasta: today });
  const heatFrom = resolvePeriod({ desde: addDays(today, -(HEAT_DAYS_BACK - 1)), hasta: today });
  const ordersFrom =
    period.previous.fromISO < heatFrom.fromISO ? period.previous.fromISO : heatFrom.fromISO;
  const supabase = createClient();

  const [events, orders, priorRows, { data: cartRows }] = await Promise.all([
    readEvents(storeId, period.previous.fromISO, period.toISO),
    fetchAll((from, to) =>
      supabase
        .from("orders")
        .select("created_at, total, customer_phone, customer_name")
        .eq("store_id", storeId)
        .in("status", SALES_STATUSES)
        .gte("created_at", ordersFrom)
        .lt("created_at", period.toISO)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    // Quién ya había comprado antes del período, para saber quién volvió.
    fetchAll((from, to) =>
      supabase
        .from("orders")
        .select("customer_phone, customer_name")
        .eq("store_id", storeId)
        .in("status", SALES_STATUSES)
        .lt("created_at", period.fromISO)
        .order("id")
        .range(from, to),
    ),
    // Los mismos carritos que la pantalla Carritos: pasados de la ventana de
    // gracia, sin recuperar ni descartar. Solo los que se movieron en el período.
    supabase
      .from("abandoned_carts")
      .select("subtotal")
      .eq("store_id", storeId)
      .is("recovered_at", null)
      .is("dismissed_at", null)
      .lt("updated_at", abandonedCartCutoff())
      .gte("updated_at", period.fromISO),
  ]);

  // ── Sesiones ──
  const cur = {
    all: new Set<string>(),
    product_view: new Set<string>(),
    add_to_cart: new Set<string>(),
    checkout_start: new Set<string>(),
    purchase: new Set<string>(),
  };
  const prev = { all: new Set<string>(), product_view: new Set<string>(), purchase: new Set<string>() };
  const firstSource = new Map<string, VisitSource>();
  let sourceSince: string | null = null;
  const dailyCur = Array.from({ length: days }, () => new Set<string>());
  const dailyPrev = Array.from({ length: days }, () => new Set<string>());
  const views = new Map<string, number>();
  const carts = new Map<string, number>();

  for (const e of events) {
    const inCur = e.created_at >= period.fromISO;
    const day = caracasDay(e.created_at);
    if (inCur) {
      cur.all.add(e.session_id);
      if (e.event_type in cur) cur[e.event_type as keyof typeof cur].add(e.session_id);
      const i = dayIndex(period.from, day);
      if (i >= 0 && i < days) dailyCur[i].add(e.session_id);
      if (e.source && isVisitSource(e.source)) {
        if (!firstSource.has(e.session_id)) firstSource.set(e.session_id, e.source);
        if (!sourceSince) sourceSince = day;
      }
      if (e.product_id && e.event_type === "product_view") {
        views.set(e.product_id, (views.get(e.product_id) ?? 0) + 1);
      } else if (e.product_id && e.event_type === "add_to_cart") {
        carts.set(e.product_id, (carts.get(e.product_id) ?? 0) + 1);
      }
    } else {
      prev.all.add(e.session_id);
      if (e.event_type === "product_view") prev.product_view.add(e.session_id);
      if (e.event_type === "purchase") prev.purchase.add(e.session_id);
      const i = dayIndex(period.previous.from, day);
      if (i >= 0 && i < days) dailyPrev[i].add(e.session_id);
    }
  }

  // Cada paso, como mucho, lo que tuvo el anterior: alguien puede llegar al
  // pago sin un "agregar al carrito" registrado (un carrito de otra visita),
  // y un embudo que se ensancha no se entiende.
  const funnel = [
    { key: "product_view", label: "Vieron un producto", sessions: cur.product_view.size },
    { key: "add_to_cart", label: "Agregaron al carrito", sessions: cur.add_to_cart.size },
    { key: "checkout_start", label: "Empezaron a pagar", sessions: cur.checkout_start.size },
    { key: "purchase", label: "Compraron", sessions: cur.purchase.size },
  ];
  for (let i = 1; i < funnel.length; i++) {
    funnel[i].sessions = Math.min(funnel[i].sessions, funnel[i - 1].sessions);
  }
  // La fuga que se puede recuperar: del carrito al pago o del pago a la
  // compra. Que la mayoría mire y no agregue nada pasa en toda tienda.
  let leak: AnalyticsOverview["leak"] = null;
  for (const i of [2, 3]) {
    const before = funnel[i - 1].sessions;
    if (before < 5) continue;
    const lost = Math.max(0, before - funnel[i].sessions);
    const p = (lost / before) * 100;
    if (lost > 0 && (!leak || p > leak.pct)) leak = { index: i, lost, pct: p };
  }

  // ── Pedidos ──
  const curOrders = orders.filter((o) => o.created_at >= period.fromISO);
  const prevOrders = orders.filter(
    (o) => o.created_at >= period.previous.fromISO && o.created_at < period.fromISO,
  );
  const dailyOrders = Array.from({ length: days }, () => 0);
  for (const o of curOrders) {
    const i = dayIndex(period.from, caracasDay(o.created_at));
    if (i >= 0 && i < days) dailyOrders[i] += 1;
  }

  const daily = dailyCur.map((s, i) => ({
    label: shortLabel(addDays(period.from, i)),
    visitors: s.size,
    prevVisitors: dailyPrev[i].size,
    orders: dailyOrders[i],
  }));
  const best = daily.reduce<{ i: number; v: number } | null>(
    (b, d, i) => (d.visitors > 0 && (!b || d.visitors > b.v) ? { i, v: d.visitors } : b),
    null,
  );

  // ── Mapa de horas: los últimos 90 días ──
  const cells = HEAT_DAYS.map(() => HEAT_SLOTS.map(() => 0));
  let heatTotal = 0;
  for (const o of orders) {
    if (o.created_at < heatFrom.fromISO) continue;
    const day = caracasDay(o.created_at);
    const hour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Caracas", hour: "numeric", hourCycle: "h23" })
        .format(new Date(o.created_at)),
    );
    cells[weekdayOf(day)][Math.floor((hour % 24) / 3)] += 1;
    heatTotal += 1;
  }
  let peak: AnalyticsOverview["heat"]["peak"] = null;
  cells.forEach((row, d) =>
    row.forEach((n, s) => {
      if (n > 0 && (!peak || n > peak.orders)) peak = { day: d, slot: s, orders: n };
    }),
  );

  // ── Clientes ──
  const prior = new Set(priorRows.map((o) => phoneKey(o.customer_phone, o.customer_name)));
  const byCustomer = new Map<string, { name: string; orders: number; usd: number }>();
  for (const o of curOrders) {
    const key = phoneKey(o.customer_phone, o.customer_name);
    const c = byCustomer.get(key) ?? { name: o.customer_name, orders: 0, usd: 0 };
    c.name = o.customer_name || c.name;
    c.orders += 1;
    c.usd += Number(o.total);
    byCustomer.set(key, c);
  }
  let returning = 0;
  let returningUsd = 0;
  let totalUsd = 0;
  for (const [key, c] of byCustomer) {
    totalUsd += c.usd;
    if (c.orders > 1 || prior.has(key)) {
      returning += 1;
      returningUsd += c.usd;
    }
  }

  // ── Productos: cuántos los miran y cuántos los agregan ──
  const listed = [...views.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const names = new Map<string, string>();
  if (listed.length > 0) {
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .eq("store_id", storeId)
      .in("id", listed.map(([id]) => id));
    for (const p of data ?? []) names.set(p.id, p.name);
  }
  const sortedViews = listed.map(([, v]) => v).sort((a, b) => a - b);
  const medianViews = sortedViews.length
    ? sortedViews.length % 2
      ? sortedViews[(sortedViews.length - 1) / 2]
      : (sortedViews[sortedViews.length / 2 - 1] + sortedViews[sortedViews.length / 2]) / 2
    : 0;
  const totalViews = listed.reduce((s, [, v]) => s + v, 0);
  const totalCarts = listed.reduce((s, [id]) => s + Math.min(carts.get(id) ?? 0, views.get(id) ?? 0), 0);
  const avgRatePct = totalViews > 0 ? (totalCarts / totalViews) * 100 : 0;
  const productRows = listed.map(([id, v]) => {
    const c = Math.min(carts.get(id) ?? 0, v);
    const ratePct = (c / v) * 100;
    const quadrant: Quadrant =
      v >= medianViews ? (ratePct >= avgRatePct ? "star" : "leak") : ratePct >= avgRatePct ? "gem" : "cold";
    return { productId: id, name: names.get(id) ?? "Producto eliminado", views: v, carts: c, ratePct, quadrant };
  });

  // ── De dónde llegan ──
  const bySource = new Map<VisitSource, { visitors: number; buyers: number }>();
  for (const [session, source] of firstSource) {
    const s = bySource.get(source) ?? { visitors: 0, buyers: 0 };
    s.visitors += 1;
    if (cur.purchase.has(session)) s.buyers += 1;
    bySource.set(source, s);
  }
  const sourceRows = VISIT_SOURCES.filter((s) => bySource.has(s.id))
    .map((s) => {
      const v = bySource.get(s.id)!;
      return {
        id: s.id,
        label: s.label,
        color: s.color,
        visitors: v.visitors,
        buyers: v.buyers,
        convPct: pct(v.buyers, v.visitors),
      };
    })
    .sort((a, b) => b.visitors - a.visitors);
  // Solo se compara entre orígenes con gente suficiente para que no sea azar.
  const solid = sourceRows.filter((s) => s.visitors >= 20 && s.convPct !== null);
  const bestSrc = [...solid].sort((a, b) => b.convPct! - a.convPct!)[0];
  const biggest = solid[0];
  const highlight =
    bestSrc && biggest && bestSrc.id !== biggest.id && biggest.convPct! > 0 && bestSrc.convPct! / biggest.convPct! >= 1.5
      ? `Quien llega por ${bestSrc.label} compra ${round1(bestSrc.convPct! / biggest.convPct!)} veces más que quien llega por ${biggest.label}.`
      : null;

  const cartsUsd = (cartRows ?? []).reduce((s, c) => s + Number(c.subtotal), 0);
  const cartsCount = (cartRows ?? []).length;

  const overview: AnalyticsOverview = {
    days,
    period: {
      from: period.from,
      to: period.to,
      label: `${shortLabel(period.from)} – ${shortLabel(period.to)}`,
      previousLabel: `los ${days} días anteriores`,
    },
    hasEvents: events.length > 0,
    visitors: cur.all.size,
    prevVisitors: prev.all.size,
    viewers: cur.product_view.size,
    conversionPct: pct(funnel[3].sessions, funnel[0].sessions),
    prevConversionPct: pct(Math.min(prev.purchase.size, prev.product_view.size), prev.product_view.size),
    orders: curOrders.length,
    prevOrders: prevOrders.length,
    salesUsd: curOrders.reduce((s, o) => s + Number(o.total), 0),
    funnel,
    leak,
    daily,
    bestDay: best ? { label: daily[best.i].label, visitors: best.v } : null,
    sources: {
      rows: sourceRows,
      tracked: firstSource.size,
      since: sourceSince && sourceSince > period.from ? shortLabel(sourceSince) : null,
      highlight,
    },
    heat: { cells, peak, total: heatTotal },
    customers: {
      total: byCustomer.size,
      returning,
      returningUsdPct: pct(returningUsd, totalUsd),
      top: [...byCustomer.values()].sort((a, b) => b.usd - a.usd).slice(0, 3),
    },
    products: { rows: productRows, medianViews, avgRatePct },
    carts: { count: cartsCount, usd: cartsUsd },
    insights: [],
  };
  overview.insights = buildInsights(overview);
  return overview;
}

/**
 * Hasta tres avisos, del más útil al menos. Cada uno sale de una regla con
 * los datos de la tienda; si no hay de qué avisar, no se inventa.
 */
export function buildInsights(o: AnalyticsOverview): AnalyticsInsight[] {
  const out: AnalyticsInsight[] = [];

  if (o.visitors === 0) {
    return [
      {
        tone: "info",
        title: "Todavía no hay visitas en estos días",
        body: "Comparte el enlace de tu tienda en Instagram o por WhatsApp: cada visita aparece aquí.",
      },
    ];
  }

  if (o.leak) {
    const pctText = `${Math.round(o.leak.pct)}%`;
    if (o.leak.index === 2) {
      out.push({
        tone: "warn",
        title: `${o.leak.lost} ${o.leak.lost === 1 ? "persona dejó" : "personas dejaron"} el carrito sin empezar a pagar`,
        body:
          o.carts.count > 0
            ? `Es el paso donde más gente se te va (${pctText}). Tienes ${o.carts.count} ${o.carts.count === 1 ? "carrito" : "carritos"} con WhatsApp: ${formatUSD(o.carts.usd)} que todavía puedes recuperar.`
            : `Es el paso donde más gente se te va (${pctText}).`,
        href: "/panel/carritos",
        cta: "Ver carritos",
      });
    } else {
      out.push({
        tone: "warn",
        title: `${o.leak.lost} ${o.leak.lost === 1 ? "persona empezó" : "personas empezaron"} a pagar y no terminaron`,
        body: `Es el paso donde más gente se te va (${pctText}). Revisa que tus métodos de pago estén completos y se entiendan.`,
        href: "/panel/configuracion",
        cta: "Revisar métodos de pago",
      });
    }
  }

  const avg = o.products.avgRatePct;
  const gem = o.products.rows
    .filter((p) => p.quadrant === "gem" && p.views >= 5 && p.carts >= 2 && p.ratePct >= Math.max(avg * 1.3, avg + 5))
    .sort((a, b) => b.ratePct - a.ratePct)[0];
  if (gem) {
    out.push({
      tone: "gem",
      title: `${gem.name} se vende solo cuando lo ven`,
      body: `El ${Math.round(gem.ratePct)}% de quienes lo miran lo agrega al carrito, pero solo lo vieron ${gem.views} veces. Ponlo en la portada o en tus historias.`,
      href: `/panel/productos/${gem.productId}`,
      cta: "Ver producto",
    });
  }

  const leaky = o.products.rows
    .filter((p) => p.views >= Math.max(o.products.medianViews, 15) && p.ratePct < avg * 0.5)
    .sort((a, b) => b.views - a.views)[0];
  if (leaky) {
    out.push({
      tone: "warn",
      title: `${leaky.name} se mira mucho y se compra poco`,
      body: `${leaky.views} visitas, pero solo el ${Math.round(leaky.ratePct)}% lo agrega al carrito (tu promedio es ${Math.round(avg)}%). Revisa el precio, las fotos o la descripción.`,
      href: `/panel/productos/${leaky.productId}`,
      cta: "Ver producto",
    });
  }

  const peak = o.heat.peak;
  if (peak && peak.orders >= 5) {
    out.push({
      tone: "info",
      title: `Te compran más los ${DAY_PLURAL[peak.day]} ${SLOT_TEXT[peak.slot]}`,
      body: `Es tu mejor franja de los últimos 90 días: ${peak.orders} pedidos. Publica un rato antes para llegar con más gente mirando.`,
    });
  }

  if (o.prevVisitors >= 20) {
    const change = Math.round(((o.visitors - o.prevVisitors) / o.prevVisitors) * 100);
    if (Math.abs(change) >= 10) {
      out.push({
        tone: change > 0 ? "good" : "info",
        title:
          change > 0
            ? `Entraron ${change}% más personas que en los ${o.days} días anteriores`
            : `Entraron ${Math.abs(change)}% menos personas que en los ${o.days} días anteriores`,
        body:
          change > 0
            ? `${o.visitors} visitantes contra ${o.prevVisitors}.`
            : `${o.visitors} visitantes contra ${o.prevVisitors}. Compartir tu tienda seguido es lo que más trae gente.`,
      });
    }
  }

  return out.slice(0, 3);
}

/**
 * Datos de ejemplo para el plan Gratis, que ve el panel borroso. Nunca tocan
 * la base y son siempre los mismos, para que no parpadee.
 */
export function sampleAnalyticsOverview(days: AnalyticsRange): AnalyticsOverview {
  const today = caracasToday();
  const from = addDays(today, -(days - 1));
  const week = [1.35, 1.2, 0.85, 0.9, 0.95, 1.1, 1.15];
  const daily = Array.from({ length: days }, (_, i) => {
    const v = Math.round(week[i % 7] * (34 + i * 0.5));
    return { label: shortLabel(addDays(from, i)), visitors: v, prevVisitors: Math.round(v * 0.8), orders: (i * 7) % 4 };
  });
  const o: AnalyticsOverview = {
    days,
    period: { from, to: today, label: `${shortLabel(from)} – ${shortLabel(today)}`, previousLabel: `los ${days} días anteriores` },
    hasEvents: true,
    visitors: 1284,
    prevVisitors: 1035,
    viewers: 1236,
    conversionPct: 4.9,
    prevConversionPct: 4.3,
    orders: 64,
    prevOrders: 55,
    salesUsd: 3412.8,
    funnel: [
      { key: "product_view", label: "Vieron un producto", sessions: 1236 },
      { key: "add_to_cart", label: "Agregaron al carrito", sessions: 298 },
      { key: "checkout_start", label: "Empezaron a pagar", sessions: 112 },
      { key: "purchase", label: "Compraron", sessions: 61 },
    ],
    leak: { index: 2, lost: 186, pct: 62.4 },
    daily,
    bestDay: { label: daily[Math.min(22, days - 1)].label, visitors: 69 },
    sources: {
      rows: [
        { id: "instagram", label: "Instagram", color: "#e87ba4", visitors: 745, buyers: 29, convPct: 3.9 },
        { id: "whatsapp", label: "WhatsApp", color: "#1baf7a", visitors: 283, buyers: 28, convPct: 9.8 },
        { id: "directo", label: "Directo", color: "#0284C7", visitors: 154, buyers: 9, convPct: 6.1 },
        { id: "buscadores", label: "Google y buscadores", color: "#eb6834", visitors: 64, buyers: 1, convPct: 2.2 },
        { id: "otros", label: "Otros sitios", color: "#BFCEDD", visitors: 38, buyers: 1, convPct: 2.6 },
      ],
      tracked: 1284,
      since: null,
      highlight: "Quien llega por WhatsApp compra 2,5 veces más que quien llega por Instagram.",
    },
    heat: {
      cells: [
        [0, 0, 1, 3, 4, 3, 6, 2],
        [0, 0, 1, 2, 5, 4, 7, 3],
        [0, 0, 0, 3, 4, 3, 8, 2],
        [1, 0, 1, 2, 6, 5, 14, 4],
        [0, 0, 1, 3, 5, 6, 11, 5],
        [1, 0, 0, 4, 7, 8, 9, 6],
        [1, 0, 0, 2, 6, 7, 8, 3],
      ],
      peak: { day: 3, slot: 6, orders: 14 },
      total: 187,
    },
    customers: {
      total: 48,
      returning: 13,
      returningUsdPct: 38,
      top: [
        { name: "Cliente frecuente", orders: 4, usd: 286 },
        { name: "Segundo cliente", orders: 3, usd: 241 },
        { name: "Tercer cliente", orders: 3, usd: 198 },
      ],
    },
    products: {
      rows: [
        { productId: "s1", name: "Producto más visto", views: 241, carts: 17, ratePct: 7, quadrant: "leak" },
        { productId: "s2", name: "Segundo más visto", views: 214, carts: 66, ratePct: 31, quadrant: "star" },
        { productId: "s3", name: "Tercero más visto", views: 187, carts: 52, ratePct: 28, quadrant: "star" },
        { productId: "s4", name: "Cuarto más visto", views: 152, carts: 18, ratePct: 12, quadrant: "leak" },
        { productId: "s5", name: "Quinto más visto", views: 121, carts: 31, ratePct: 26, quadrant: "gem" },
        { productId: "s6", name: "Sexto más visto", views: 58, carts: 19, ratePct: 33, quadrant: "gem" },
        { productId: "s7", name: "Séptimo más visto", views: 46, carts: 17, ratePct: 37, quadrant: "gem" },
        { productId: "s8", name: "Octavo más visto", views: 39, carts: 3, ratePct: 8, quadrant: "cold" },
      ],
      medianViews: 136,
      avgRatePct: 24,
    },
    carts: { count: 23, usd: 1180 },
    insights: [],
  };
  o.insights = buildInsights(o);
  return o;
}
