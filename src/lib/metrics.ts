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
import { phoneKey } from "@/lib/customer-identity";
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

export async function getFinanceSummary(
  storeId: string,
): Promise<FinanceSummary> {
  const supabase = createClient();
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const prevMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
  const monthStartDate = monthStart.slice(0, 10);

  const [{ data: sales }, { data: pending }, { data: recentSales }, { data: expenses }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, total, total_bs, payment_method_type, created_at")
        .eq("store_id", storeId)
        .in("status", SALES_STATUSES),
      supabase
        .from("orders")
        .select("total")
        .eq("store_id", storeId)
        .eq("status", "pending_confirmation"),
      supabase
        .from("orders")
        .select("*")
        .eq("store_id", storeId)
        .in("status", SALES_STATUSES)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("expenses")
        .select("amount, spent_at")
        .eq("store_id", storeId),
    ]);

  const list = sales ?? [];
  const saleIds = list.map((o) => o.id);

  // Order items for COGS + top products + units.
  let items: {
    order_id: string;
    product_name: string;
    quantity: number;
    subtotal: number;
    unit_cost: number;
  }[] = [];
  if (saleIds.length > 0) {
    const { data } = await supabase
      .from("order_items")
      .select("order_id, product_name, quantity, subtotal, unit_cost")
      .in("order_id", saleIds);
    items = (data ?? []) as typeof items;
  }

  const cogsByOrder = new Map<string, number>();
  const productMap = new Map<string, { qty: number; revenue: number; profit: number }>();
  let unitsSold = 0;
  for (const it of items) {
    const cost = Number(it.unit_cost) * it.quantity;
    cogsByOrder.set(it.order_id, (cogsByOrder.get(it.order_id) ?? 0) + cost);
    unitsSold += it.quantity;
    const p = productMap.get(it.product_name) ?? { qty: 0, revenue: 0, profit: 0 };
    p.qty += it.quantity;
    p.revenue += Number(it.subtotal);
    p.profit += Number(it.subtotal) - cost;
    productMap.set(it.product_name, p);
  }

  const totalUsd = list.reduce((s, o) => s + Number(o.total), 0);
  const totalBs = list.reduce((s, o) => s + Number(o.total_bs ?? 0), 0);
  const cogsUsd = [...cogsByOrder.values()].reduce((s, v) => s + v, 0);
  const grossProfitUsd = totalUsd - cogsUsd;
  const expensesTotalUsd = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  const monthOrders = list.filter((o) => o.created_at >= monthStart);
  const monthUsd = monthOrders.reduce((s, o) => s + Number(o.total), 0);
  const monthCogs = monthOrders.reduce((s, o) => s + (cogsByOrder.get(o.id) ?? 0), 0);
  const monthExpensesUsd = (expenses ?? [])
    .filter((e) => e.spent_at >= monthStartDate)
    .reduce((s, e) => s + Number(e.amount), 0);
  const prevMonthUsd = list
    .filter((o) => o.created_at >= prevMonthStart && o.created_at < monthStart)
    .reduce((s, o) => s + Number(o.total), 0);

  const methodMap = new Map<string, { count: number; usd: number }>();
  for (const o of list) {
    const key = o.payment_method_type ?? "other";
    const cur = methodMap.get(key) ?? { count: 0, usd: 0 };
    cur.count += 1;
    cur.usd += Number(o.total);
    methodMap.set(key, cur);
  }

  const topProducts = [...productMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const pendingUsd = (pending ?? []).reduce((s, o) => s + Number(o.total), 0);

  return {
    totalUsd,
    totalBs,
    salesCount: list.length,
    unitsSold,
    avgTicketUsd: list.length ? totalUsd / list.length : 0,
    cogsUsd,
    grossProfitUsd,
    marginPct: totalUsd > 0 ? (grossProfitUsd / totalUsd) * 100 : 0,
    expensesTotalUsd,
    netProfitUsd: grossProfitUsd - expensesTotalUsd,
    monthUsd,
    monthCount: monthOrders.length,
    monthGrossUsd: monthUsd - monthCogs,
    monthExpensesUsd,
    monthNetUsd: monthUsd - monthCogs - monthExpensesUsd,
    prevMonthUsd,
    momGrowthPct:
      prevMonthUsd > 0 ? ((monthUsd - prevMonthUsd) / prevMonthUsd) * 100 : null,
    pendingUsd,
    pendingCount: (pending ?? []).length,
    byMethod: [...methodMap.entries()]
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.usd - a.usd),
    topProducts,
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

async function computeRange(
  supabase: SupabaseServer,
  storeId: string,
  startISO: string,
  endISO: string,
  startDate: string,
  endDate: string,
): Promise<RangeAgg> {
  const [{ data: orders }, { data: exp }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total, total_bs, payment_method_type, customer_phone")
      .eq("store_id", storeId)
      .in("status", SALES_STATUSES)
      .gte("created_at", startISO)
      .lt("created_at", endISO),
    supabase
      .from("expenses")
      .select("amount, category, spent_at")
      .eq("store_id", storeId)
      .gte("spent_at", startDate)
      .lt("spent_at", endDate),
  ]);

  const list = orders ?? [];
  const ids = list.map((o) => o.id);
  let items: {
    order_id: string;
    product_name: string;
    quantity: number;
    subtotal: number;
    unit_cost: number;
  }[] = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from("order_items")
      .select("order_id, product_name, quantity, subtotal, unit_cost")
      .in("order_id", ids);
    items = (data ?? []) as typeof items;
  }

  const productMap = new Map<string, { qty: number; revenue: number; profit: number }>();
  let cogsUsd = 0;
  let unitsSold = 0;
  for (const it of items) {
    const cost = Number(it.unit_cost) * it.quantity;
    cogsUsd += cost;
    unitsSold += it.quantity;
    const p = productMap.get(it.product_name) ?? { qty: 0, revenue: 0, profit: 0 };
    p.qty += it.quantity;
    p.revenue += Number(it.subtotal);
    p.profit += Number(it.subtotal) - cost;
    productMap.set(it.product_name, p);
  }

  const methodMap = new Map<string, { count: number; usd: number }>();
  // Por identidad, no por el texto del teléfono: el mismo cliente escrito de
  // dos formas contaba como dos clientes distintos.
  const phones = new Set<string>();
  let incomeUsd = 0;
  let incomeBs = 0;
  for (const o of list) {
    incomeUsd += Number(o.total);
    incomeBs += Number(o.total_bs ?? 0);
    const pk = phoneKey(o.customer_phone);
    if (pk) phones.add(pk);
    const key = o.payment_method_type ?? "other";
    const cur = methodMap.get(key) ?? { count: 0, usd: 0 };
    cur.count += 1;
    cur.usd += Number(o.total);
    methodMap.set(key, cur);
  }

  const catMap = new Map<string, number>();
  let expensesUsd = 0;
  for (const e of exp ?? []) {
    const amt = Number(e.amount);
    expensesUsd += amt;
    const key = e.category || "Otros";
    catMap.set(key, (catMap.get(key) ?? 0) + amt);
  }

  return {
    incomeUsd,
    incomeBs,
    cogsUsd,
    expensesUsd,
    salesCount: list.length,
    unitsSold,
    customers: phones.size,
    expensesByCategory: [...catMap.entries()]
      .map(([category, usd]) => ({ category, usd }))
      .sort((a, b) => b.usd - a.usd),
    byMethod: [...methodMap.entries()]
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.usd - a.usd),
    topProducts: [...productMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
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

  const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");

  const [cur, prev] = await Promise.all([
    computeRange(
      supabase,
      storeId,
      monthStart.toISOString(),
      nextStart.toISOString(),
      fmtDate(monthStart),
      fmtDate(nextStart),
    ),
    computeRange(
      supabase,
      storeId,
      prevStart.toISOString(),
      monthStart.toISOString(),
      fmtDate(prevStart),
      fmtDate(monthStart),
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
