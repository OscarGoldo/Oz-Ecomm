import {
  addMonths,
  eachDayOfInterval,
  format,
  getDay,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";

import { createClient } from "@/lib/supabase/server";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import { formatUSD } from "@/lib/format";
import type {
  Order,
  OrderStatus,
  PaymentMethodType,
  Product,
} from "@/types/database";

/** Lunes a domingo, en ese orden (getDay() de date-fns arranca en domingo). */
const WEEKDAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

/**
 * Variación porcentual entre dos períodos. Devuelve null cuando el anterior
 * fue cero: no existe "subió un X%" desde cero, y mostrar "+100%" o "+∞"
 * ahí es peor que no mostrar nada.
 */
function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

type SupabaseServer = ReturnType<typeof createClient>;

/**
 * Los agregados vienen de Postgres como jsonb: numeric llega como string o
 * number según el driver, así que todo pasa por acá antes de sumarse.
 */
function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function list(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

/** Statuses that count as a real sale (revenue). */
export const SALES_STATUSES: OrderStatus[] = [
  "confirmed",
  "preparing",
  "in_delivery",
  "completed",
];

/**
 * Un número con su comparación contra el período anterior. `pct` es null
 * cuando el período anterior fue cero: ahí no hay porcentaje que calcular
 * (dividir por cero) y la tarjeta muestra solo el valor previo.
 */
export interface Delta {
  /** Valor del período anterior, ya formateado para mostrar. */
  previousLabel: string;
  /** Cómo se llama ese período anterior ("ayer", "mes anterior"). */
  periodLabel: string;
  /** Variación porcentual, o null si no se puede calcular. */
  pct: number | null;
}

export interface DashboardMetrics {
  todayOrders: number;
  pendingConfirmation: number;
  lowStock: Pick<Product, "id" | "name" | "stock" | "low_stock_threshold">[];
  monthSalesUsd: number;
  monthSalesBs: number;
  monthOrders: number;
  recentOrders: Order[];
  /** Pedidos de hoy contra los de ayer a esta misma altura del día. */
  todayOrdersDelta: Delta;
  /** Ventas del mes contra el mes anterior completo. */
  monthSalesDelta: Delta;
  /** Ventas del mes en curso, un punto por día (para el gráfico de Resumen). */
  salesByDay: { key: string; label: string; usd: number }[];
  /** Cuántos pedidos entraron cada día de la semana, en lo que va del mes. */
  ordersByWeekday: { label: string; count: number }[];
  /** Con qué método pagó cada venta del mes, de mayor a menor monto. */
  salesByMethod: { type: string; label: string; usd: number; count: number }[];
  /**
   * % de pedidos de este mes, entre los que ya llegaron a un estado final,
   * que terminaron entregados (vs. cancelados). `null` si todavía ninguno
   * llegó a un estado final.
   */
  deliveryRatePct: number | null;
}

export async function getDashboardMetrics(
  storeId: string,
): Promise<DashboardMetrics> {
  const supabase = createClient();
  const now = new Date();
  const dayStart = startOfDay(now).toISOString();
  const monthStart = startOfMonth(now).toISOString();
  // Se compara contra el mes anterior completo, así que las ventas se piden
  // desde ahí y se parten en memoria: un viaje en vez de dos.
  const prevMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
  const yesterdayStart = startOfDay(subDays(now, 1)).toISOString();

  const [
    { count: todayOrders },
    { count: pendingConfirmation },
    { data: lowStockRaw },
    { data: monthSales },
    { data: recentOrders },
    { count: completedThisMonth },
    { count: cancelledThisMonth },
    { count: yesterdayOrders },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .gte("created_at", dayStart),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", "pending_confirmation"),
    supabase
      .from("products")
      .select("id, name, stock, low_stock_threshold")
      .eq("store_id", storeId)
      .eq("status", "active")
      .eq("track_stock", true),
    supabase
      .from("orders")
      .select("total, total_bs, created_at, payment_method_type")
      .eq("store_id", storeId)
      .in("status", SALES_STATUSES)
      .gte("created_at", prevMonthStart),
    supabase
      .from("orders")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(5),
    // Tasa de entrega: de los pedidos de este mes que ya llegaron a un
    // estado final (entregado o cancelado), cuántos se entregaron. Los que
    // todavía están en curso (pendientes, confirmados, en camino) no cuentan
    // ni a favor ni en contra porque su desenlace no se conoce todavía.
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", "completed")
      .gte("created_at", monthStart),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", "cancelled")
      .gte("created_at", monthStart),
    // Ayer completo, para comparar contra los pedidos de hoy.
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .gte("created_at", yesterdayStart)
      .lt("created_at", dayStart),
  ]);

  const lowStock = (lowStockRaw ?? [])
    .filter((p) => p.stock <= p.low_stock_threshold)
    .sort((a, b) => a.stock - b.stock);

  // La consulta trae dos meses; los gráficos y los totales del mes usan solo
  // el actual, y el anterior queda para las comparaciones.
  const allSales = monthSales ?? [];
  const sales = allSales.filter((o) => o.created_at >= monthStart);
  const prevSales = allSales.filter((o) => o.created_at < monthStart);
  const monthSalesUsd = sales.reduce((s, o) => s + Number(o.total), 0);
  const monthSalesBs = sales.reduce((s, o) => s + Number(o.total_bs ?? 0), 0);
  const prevMonthSalesUsd = prevSales.reduce((s, o) => s + Number(o.total), 0);

  // Un punto por día del mes en curso, para que el gráfico de ventas no tenga
  // huecos donde no hubo ventas ese día. La label se arma acá, de una vez,
  // para no tener que volver a parsear "yyyy-MM-dd" como fecha más abajo:
  // eso lo interpreta como UTC y en Venezuela (UTC-4) corre el día mostrado.
  const dayBuckets = new Map<string, number>();
  const dayLabels = new Map<string, string>();
  for (const d of eachDayOfInterval({ start: new Date(monthStart), end: new Date() })) {
    const key = format(d, "yyyy-MM-dd");
    dayBuckets.set(key, 0);
    dayLabels.set(key, format(d, "d MMM", { locale: es }));
  }
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0]; // lunes..domingo
  const methodBuckets = new Map<string, { usd: number; count: number }>();
  for (const o of sales) {
    const created = new Date(o.created_at);
    const dayKey = format(created, "yyyy-MM-dd");
    dayBuckets.set(dayKey, (dayBuckets.get(dayKey) ?? 0) + Number(o.total));
    // getDay(): 0 = domingo..6 = sábado. Se corre para que la semana arranque
    // en lunes, como en el resto del panel.
    weekdayCounts[(getDay(created) + 6) % 7] += 1;
    const methodKey = o.payment_method_type ?? "other";
    const cur = methodBuckets.get(methodKey) ?? { usd: 0, count: 0 };
    cur.usd += Number(o.total);
    cur.count += 1;
    methodBuckets.set(methodKey, cur);
  }

  const salesByDay = [...dayBuckets.entries()].map(([key, usd]) => ({
    key,
    label: dayLabels.get(key) ?? key,
    usd,
  }));
  const ordersByWeekday = WEEKDAY_LABELS.map((label, i) => ({
    label,
    count: weekdayCounts[i],
  }));
  const salesByMethod = [...methodBuckets.entries()]
    .map(([type, v]) => ({
      type,
      label:
        PAYMENT_METHOD_META[type as PaymentMethodType]?.label ??
        (type === "other" ? "Otro" : type),
      usd: v.usd,
      count: v.count,
    }))
    .sort((a, b) => b.usd - a.usd);

  const resolved = (completedThisMonth ?? 0) + (cancelledThisMonth ?? 0);
  const deliveryRatePct =
    resolved > 0 ? ((completedThisMonth ?? 0) / resolved) * 100 : null;

  const todayOrdersDelta: Delta = {
    previousLabel: String(yesterdayOrders ?? 0),
    periodLabel: "ayer",
    pct: pctChange(todayOrders ?? 0, yesterdayOrders ?? 0),
  };
  const monthSalesDelta: Delta = {
    previousLabel: formatUSD(prevMonthSalesUsd),
    periodLabel: "mes anterior",
    pct: pctChange(monthSalesUsd, prevMonthSalesUsd),
  };

  return {
    todayOrders: todayOrders ?? 0,
    pendingConfirmation: pendingConfirmation ?? 0,
    lowStock,
    monthSalesUsd,
    monthSalesBs,
    monthOrders: sales.length,
    recentOrders: (recentOrders ?? []) as Order[],
    salesByDay,
    ordersByWeekday,
    salesByMethod,
    deliveryRatePct,
    todayOrdersDelta,
    monthSalesDelta,
  };
}

export interface FinanceSummary {
  // Revenue
  totalUsd: number;
  totalBs: number;
  salesCount: number;
  unitsSold: number;
  avgTicketUsd: number;
  // Profitability (all time)
  cogsUsd: number;
  grossProfitUsd: number;
  marginPct: number;
  expensesTotalUsd: number;
  netProfitUsd: number;
  // This month
  monthUsd: number;
  monthCount: number;
  monthGrossUsd: number;
  monthExpensesUsd: number;
  monthNetUsd: number;
  prevMonthUsd: number;
  momGrowthPct: number | null;
  // Pending / breakdowns
  pendingUsd: number;
  pendingCount: number;
  byMethod: { type: string; count: number; usd: number }[];
  topProducts: { name: string; qty: number; revenue: number; profit: number }[];
  recentSales: Order[];
}

/**
 * Resumen de Finanzas. Los totales los calcula Postgres (`finance_summary`).
 *
 * Antes esto traía todos los pedidos históricos y todos sus ítems a memoria
 * para sumarlos acá. Pasado el pedido 1.000 el corte silencioso de PostgREST
 * hacía que el ingreso total dejara de crecer: el panel mostraba números que
 * no eran los de la tienda.
 */
export async function getFinanceSummary(
  storeId: string,
): Promise<FinanceSummary> {
  const supabase = createClient();

  const [{ data: agg }, { data: recentSales }] = await Promise.all([
    supabase.rpc("finance_summary", { p_store_id: storeId }),
    // Las últimas ventas siguen siendo una consulta normal: ya venía acotada.
    supabase
      .from("orders")
      .select("*")
      .eq("store_id", storeId)
      .in("status", SALES_STATUSES)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const r = (agg ?? {}) as Record<string, unknown>;

  const totalUsd = num(r.total_usd);
  const cogsUsd = num(r.cogs_usd);
  const grossProfitUsd = totalUsd - cogsUsd;
  const expensesTotalUsd = num(r.expenses_total_usd);
  const salesCount = num(r.sales_count);

  const monthUsd = num(r.month_usd);
  const monthCogs = num(r.month_cogs_usd);
  const monthExpensesUsd = num(r.month_expenses_usd);
  const prevMonthUsd = num(r.prev_month_usd);

  return {
    totalUsd,
    totalBs: num(r.total_bs),
    salesCount,
    unitsSold: num(r.units_sold),
    avgTicketUsd: salesCount ? totalUsd / salesCount : 0,
    cogsUsd,
    grossProfitUsd,
    marginPct: totalUsd > 0 ? (grossProfitUsd / totalUsd) * 100 : 0,
    expensesTotalUsd,
    netProfitUsd: grossProfitUsd - expensesTotalUsd,
    monthUsd,
    monthCount: num(r.month_count),
    monthGrossUsd: monthUsd - monthCogs,
    monthExpensesUsd,
    monthNetUsd: monthUsd - monthCogs - monthExpensesUsd,
    prevMonthUsd,
    momGrowthPct:
      prevMonthUsd > 0 ? ((monthUsd - prevMonthUsd) / prevMonthUsd) * 100 : null,
    pendingUsd: num(r.pending_usd),
    pendingCount: num(r.pending_count),
    byMethod: list(r.by_method).map((m) => ({
      type: String(m.type ?? "other"),
      count: num(m.count),
      usd: num(m.usd),
    })),
    topProducts: list(r.top_products).map((t) => ({
      name: String(t.name ?? ""),
      qty: num(t.qty),
      revenue: num(t.revenue),
      profit: num(t.profit),
    })),
    recentSales: (recentSales ?? []) as Order[],
  };
}

/** Income/cost/expense aggregates for a single date range (one month). */
interface RangeAgg {
  incomeUsd: number;
  incomeBs: number;
  cogsUsd: number;
  expensesUsd: number;
  salesCount: number;
  unitsSold: number;
  customers: number;
  expensesByCategory: { category: string; usd: number }[];
  byMethod: { type: string; count: number; usd: number }[];
  topProducts: { name: string; qty: number; revenue: number; profit: number }[];
}

/**
 * Agregados de un rango. Los calcula Postgres (`finance_range`), no Node.
 *
 * Antes esto traía todos los pedidos del mes y todos sus ítems para sumarlos
 * en memoria; con el techo de 1.000 filas de PostgREST, un mes bueno se
 * reportaba incompleto.
 */
async function computeRange(
  supabase: SupabaseServer,
  storeId: string,
  startISO: string,
  endISO: string,
): Promise<RangeAgg> {
  const { data } = await supabase.rpc("finance_range", {
    p_store_id: storeId,
    p_from: startISO,
    p_to: endISO,
  });
  const r = (data ?? {}) as Record<string, unknown>;

  return {
    incomeUsd: num(r.income_usd),
    incomeBs: num(r.income_bs),
    cogsUsd: num(r.cogs_usd),
    expensesUsd: num(r.expenses_usd),
    salesCount: num(r.sales_count),
    unitsSold: num(r.units_sold),
    customers: num(r.customers),
    expensesByCategory: list(r.expenses_by_category).map((e) => ({
      category: String(e.category ?? "Otros"),
      usd: num(e.usd),
    })),
    byMethod: list(r.by_method).map((m) => ({
      type: String(m.type ?? "other"),
      count: num(m.count),
      usd: num(m.usd),
    })),
    topProducts: list(r.top_products).map((t) => ({
      name: String(t.name ?? ""),
      qty: num(t.qty),
      revenue: num(t.revenue),
      profit: num(t.profit),
    })),
  };
}

export interface MonthlyReport {
  ym: string; // "2026-05"
  label: string; // "Mayo 2026"
  // Balance / P&L
  incomeUsd: number;
  incomeBs: number;
  cogsUsd: number;
  grossUsd: number;
  expensesUsd: number;
  netUsd: number;
  marginPct: number;
  expensesByCategory: { category: string; usd: number }[];
  // Metrics
  salesCount: number;
  unitsSold: number;
  avgTicketUsd: number;
  customers: number;
  topProducts: { name: string; qty: number; revenue: number; profit: number }[];
  byMethod: { type: string; count: number; usd: number }[];
  // vs previous month
  prevIncomeUsd: number;
  prevNetUsd: number;
  incomeGrowthPct: number | null;
  netGrowthPct: number | null;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Full report for a single month ("YYYY-MM"), with vs-previous-month deltas. */
export async function getMonthlyReport(
  storeId: string,
  ym: string,
): Promise<MonthlyReport> {
  const supabase = createClient();
  const [yStr, mStr] = ym.split("-");
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;
  const monthStart = new Date(year, monthIdx, 1);
  const nextStart = addMonths(monthStart, 1);
  const prevStart = subMonths(monthStart, 1);


  const [cur, prev] = await Promise.all([
    computeRange(
      supabase,
      storeId,
      monthStart.toISOString(),
      nextStart.toISOString(),
    ),
    computeRange(
      supabase,
      storeId,
      prevStart.toISOString(),
      monthStart.toISOString(),
    ),
  ]);

  const grossUsd = cur.incomeUsd - cur.cogsUsd;
  const netUsd = grossUsd - cur.expensesUsd;
  const prevNetUsd = prev.incomeUsd - prev.cogsUsd - prev.expensesUsd;

  return {
    ym,
    label: cap(format(monthStart, "MMMM yyyy", { locale: es })),
    incomeUsd: cur.incomeUsd,
    incomeBs: cur.incomeBs,
    cogsUsd: cur.cogsUsd,
    grossUsd,
    expensesUsd: cur.expensesUsd,
    netUsd,
    marginPct: cur.incomeUsd > 0 ? (grossUsd / cur.incomeUsd) * 100 : 0,
    expensesByCategory: cur.expensesByCategory,
    salesCount: cur.salesCount,
    unitsSold: cur.unitsSold,
    avgTicketUsd: cur.salesCount ? cur.incomeUsd / cur.salesCount : 0,
    customers: cur.customers,
    topProducts: cur.topProducts,
    byMethod: cur.byMethod,
    prevIncomeUsd: prev.incomeUsd,
    prevNetUsd,
    incomeGrowthPct:
      prev.incomeUsd > 0
        ? ((cur.incomeUsd - prev.incomeUsd) / prev.incomeUsd) * 100
        : null,
    netGrowthPct:
      prevNetUsd > 0 ? ((netUsd - prevNetUsd) / prevNetUsd) * 100 : null,
  };
}

/** Months (newest first) that have any activity, for the report picker. */
export async function getAvailableReportMonths(
  storeId: string,
): Promise<{ ym: string; label: string }[]> {
  const supabase = createClient();
  const [{ data: firstOrder }, { data: firstExpense }] = await Promise.all([
    supabase
      .from("orders")
      .select("created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("expenses")
      .select("spent_at")
      .eq("store_id", storeId)
      .order("spent_at", { ascending: true })
      .limit(1),
  ]);

  const dates: Date[] = [];
  if (firstOrder?.[0]?.created_at) dates.push(new Date(firstOrder[0].created_at));
  if (firstExpense?.[0]?.spent_at) dates.push(new Date(firstExpense[0].spent_at));

  const now = new Date();
  const earliest =
    dates.length > 0
      ? startOfMonth(new Date(Math.min(...dates.map((d) => d.getTime()))))
      : startOfMonth(subMonths(now, 1));

  const months: { ym: string; label: string }[] = [];
  let cursor = startOfMonth(now);
  // Cap at 36 months to keep the list sane.
  for (let i = 0; i < 36 && cursor >= earliest; i++) {
    months.push({
      ym: format(cursor, "yyyy-MM"),
      label: cap(format(cursor, "MMMM yyyy", { locale: es })),
    });
    cursor = subMonths(cursor, 1);
  }
  return months;
}

/** Recent expenses for the Finanzas page. */
export async function getRecentExpenses(storeId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .eq("store_id", storeId)
    .order("spent_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}
