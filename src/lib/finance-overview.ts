import { getCachedBcvRates } from "@/lib/bcv";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import { getProductReport, listSales, type ProductReportRow } from "@/lib/finance-reports";
import { formatUSD } from "@/lib/format";
import {
  getPeriodReport,
  getRangeAgg,
  getRecentExpenses,
  getRecurringExpenses,
  getRecurringSpentByCategory,
  SALES_STATUSES,
  type PeriodReport,
  type RangeAgg,
} from "@/lib/metrics";
import {
  caracasToday,
  resolvePeriod,
  shortDateTime,
  shortDay,
  type ReportPeriod,
} from "@/lib/report-period";
import { pendingBetween } from "@/lib/recurring-expenses";
import { PAYMENT_PROOFS_BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Employee, Expense, PaymentMethodType } from "@/types/database";

/**
 * El resumen de Finanzas: no solo cuánto se vendió, sino cuánto quedó, hacia
 * dónde va el mes y qué conviene mirar. Todo sale de lo que el comerciante ya
 * carga (ventas, costos de sus productos, gastos y nómina); lo nuevo son las
 * cuentas: el mes a mes, la proyección, el punto de equilibrio y los avisos.
 */

/**
 * Las categorías de gasto que se pagan igual venda o no venda. Son las que
 * entran en el punto de equilibrio. El resto (inventario, publicidad,
 * envíos…) se mueve con las ventas.
 *
 * Además es fijo todo gasto que se repite, sea de la categoría que sea (ver
 * lib/recurring-expenses.ts): si el comerciante lo cargó para que se registre
 * solo cada mes, es porque lo paga venda o no venda.
 */
export const FIXED_CATEGORIES = ["Alquiler", "Sueldos", "Servicios"];

/** Veces por mes de cada frecuencia de pago (52 semanas / 12 meses ≈ 4,33). */
const FREQ_PER_MONTH = { weekly: 52 / 12, biweekly: 2, monthly: 1 } as const;

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Ventas mínimas del mes para proyectar cómo cierra. */
export const MIN_SALES_TO_PROJECT = 5;

/** Las de cobro en bolívares: Pago Móvil y transferencia bancaria. */
const BS_METHODS = new Set(["pago_movil", "transfer"]);

/** Nombres cortos para las tarjetas; el de la tienda pública es más largo. */
const METHOD_LABEL: Partial<Record<string, string>> = {
  stripe: "Tarjeta",
  paypal: "PayPal",
  other: "Otro",
};

export function methodLabel(type: string): string {
  return METHOD_LABEL[type] ?? PAYMENT_METHOD_META[type as PaymentMethodType]?.label ?? type;
}

/** La nómina estimada al mes en dólares, con los sueldos en Bs a la tasa dada. */
export function payrollMonthlyUsd(employees: Employee[], rate: number | null): number {
  return employees.reduce((sum, e) => {
    if (!e.active) return sum;
    const usd =
      e.currency === "USD" ? Number(e.amount) : rate && rate > 0 ? Number(e.amount) / rate : 0;
    return sum + usd * FREQ_PER_MONTH[e.frequency];
  }, 0);
}

export interface MonthPoint {
  key: string;
  /** "oct" */
  label: string;
  /** "octubre" */
  name: string;
  incomeUsd: number;
  grossUsd: number;
  netUsd: number;
  salesCount: number;
  /** El mes todavía no terminó. */
  partial: boolean;
}

export type MarginTier = "good" | "mid" | "low" | "none";

export interface ProfitRow {
  productId: string | null;
  name: string;
  qty: number;
  revenueUsd: number;
  profitUsd: number;
  marginPct: number | null;
  /** Sin costo cargado en ninguna venta, o en algunas. */
  cost: "ok" | "none" | "partial";
  tier: MarginTier;
}

export interface Insight {
  tone: "warn" | "good" | "info";
  title: string;
  body: string;
  href?: string;
  cta?: string;
}

export interface Movement {
  id: string;
  kind: "in" | "out";
  title: string;
  sub: string;
  amountUsd: number;
  href?: string;
}

export interface FinanceOverview {
  period: ReportPeriod;
  report: PeriodReport;
  /** "los mismos días de septiembre", "agosto"… */
  previousLabel: string;
  /** "septiembre" o "antes": para las tarjetas, donde no entra la frase. */
  previousShort: string;
  /** "octubre", "septiembre" o el nombre del rango. */
  periodName: string;
  bcvUsd: number | null;
  /** Solo para el mes en curso. */
  monthProgress: { day: number; days: number } | null;
  projection: { incomeUsd: number; netUsd: number; bestMonth: boolean } | null;
  breakEven: {
    fixedUsd: number;
    salesNeededUsd: number;
    /** Qué día se pasó ("10 de octubre"), si se pasó. */
    reachedOn: string | null;
    /** Si no se pasó todavía: qué día se pasaría a este ritmo. */
    projectedOn: string | null;
  } | null;
  /** Lo vendido por día (períodos de hasta dos meses) o por mes. */
  trend: number[];
  months: MonthPoint[];
  products: { rows: ProfitRow[]; total: number; avgMarginPct: number | null };
  methods: { type: string; label: string; usd: number; count: number; pct: number }[];
  bsSharePct: number | null;
  expenses: { category: string; usd: number; pct: number; fixed: boolean }[];
  /** Sueldos de la nómina que faltan registrar este mes. */
  payrollDueUsd: number | null;
  collect: {
    pendingUsd: number;
    pendingCount: number;
    payoutDueUsd: number;
    payoutDueCount: number;
    lastPayout: { date: string; amountUsd: number; reference: string | null; proofUrl: string | null } | null;
  };
  payroll: { monthlyUsd: number; people: number; paidUsd: number | null };
  movements: Movement[];
  insights: Insight[];
  /** Margen bruto y ticket por mes, para las líneas de las tarjetas. */
  marginTrend: number[];
  ticketTrend: number[];
}

// ── Fechas ──────────────────────────────────────────────────────────────────

function ymd(day: string): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number);
  return [y, m, d];
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function dayIndex(from: string, day: string): number {
  const [fy, fm, fd] = ymd(from);
  const [y, m, d] = ymd(day);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

function addDays(day: string, n: number): string {
  const [y, m, d] = ymd(day);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** "10 de octubre" */
function longDay(day: string): string {
  const [, m, d] = ymd(day);
  return `${d} de ${MONTHS[m - 1]}`;
}

function monthName(day: string): string {
  return MONTHS[ymd(day)[1] - 1];
}

/** Contra qué se compara, dicho como lo diría una persona. */
function previousLabel(period: ReportPeriod): string {
  const prev = period.previous;
  switch (period.preset) {
    case "este-mes":
      return `los mismos días de ${monthName(prev.from)}`;
    case "mes-pasado":
      return monthName(prev.from);
    case "trimestre":
      return "los mismos días del trimestre anterior";
    case "este-ano":
      return `los mismos días de ${prev.from.slice(0, 4)}`;
    default:
      return prev.label;
  }
}

/** Los últimos `count` meses que terminan en el mes de `to`, cortados en hoy. */
function lastMonths(to: string, count: number, today: string) {
  const [ty, tm] = ymd(to);
  return Array.from({ length: count }, (_, i) => {
    const first = new Date(Date.UTC(ty, tm - 1 - (count - 1 - i), 1));
    const y = first.getUTCFullYear();
    const m = first.getUTCMonth() + 1;
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const end = `${y}-${String(m).padStart(2, "0")}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
    const partial = end > today;
    const range = resolvePeriod({ desde: from, hasta: partial ? today : end }, today);
    return { key: from.slice(0, 7), label: MONTHS_SHORT[m - 1], name: MONTHS[m - 1], partial, range };
  });
}

/** "hoy, 10:42", "ayer, 18:30" o "15 oct, 10:00". */
function whenLabel(iso: string, today: string): string {
  const day = caracasToday(new Date(iso));
  const time = shortDateTime(iso).split(", ")[1];
  if (day === today) return `hoy, ${time}`;
  if (day === addDays(today, -1)) return `ayer, ${time}`;
  return shortDateTime(iso);
}

// ── Piezas ──────────────────────────────────────────────────────────────────

function byCategory(rows: { category: string; usd: number }[]): Map<string, number> {
  return new Map(rows.map((r) => [r.category, r.usd]));
}

function fixedOf(rows: { category: string; usd: number }[]): number {
  return rows.filter((r) => FIXED_CATEGORIES.includes(r.category)).reduce((s, r) => s + r.usd, 0);
}

/**
 * Productos ordenados por lo que dejan. Los que se vendieron sin costo van
 * aparte, al final: su "ganancia" es todo lo cobrado y quedarían primeros
 * sin merecerlo.
 *
 * El color del margen es contra el promedio de la propia tienda y no contra
 * un número fijo: un 30% es bueno en comida y bajo en ropa.
 */
function rankProducts(rows: ProductReportRow[]): FinanceOverview["products"] {
  const withCost = rows.filter((r) => !r.missingCost && r.revenueUsd > 0);
  const revenue = withCost.reduce((s, r) => s + r.revenueUsd, 0);
  const profit = withCost.reduce((s, r) => s + r.profitUsd, 0);
  const avg = revenue > 0 ? (profit / revenue) * 100 : null;

  const tier = (m: number | null): MarginTier => {
    if (m === null || avg === null) return "none";
    if (m >= avg) return "good";
    return m < avg * 0.6 ? "low" : "mid";
  };

  const missing = rows.filter((r) => r.missingCost).sort((a, b) => b.revenueUsd - a.revenueUsd);
  const ranked = [...withCost].sort((a, b) => b.profitUsd - a.profitUsd).slice(0, missing.length ? 5 : 6);

  const out: ProfitRow[] = ranked.map((r) => ({
    productId: r.productId,
    name: r.name,
    qty: r.qty,
    revenueUsd: r.revenueUsd,
    profitUsd: r.profitUsd,
    marginPct: r.marginPct,
    cost: "ok",
    tier: tier(r.marginPct),
  }));
  if (missing[0]) {
    const r = missing[0];
    out.push({
      productId: r.productId,
      name: r.name,
      qty: r.qty,
      revenueUsd: r.revenueUsd,
      profitUsd: r.profitUsd,
      marginPct: null,
      cost: r.costUsd > 0 ? "partial" : "none",
      tier: "none",
    });
  }
  return { rows: out, total: rows.length, avgMarginPct: avg };
}

function productHref(id: string | null): string {
  return id ? `/panel/productos/${id}` : "/panel/productos";
}

/**
 * Hasta tres avisos, del más útil al menos. Cada uno sale de una regla con
 * datos de la tienda: si no hay de qué avisar, no se inventa.
 */
function buildInsights(o: {
  period: ReportPeriod;
  report: PeriodReport;
  previousLabel: string;
  products: ProductReportRow[];
  avgMarginPct: number | null;
  projection: FinanceOverview["projection"];
}): Insight[] {
  const { report: r, period } = o;
  const out: Insight[] = [];

  if (r.salesCount === 0) {
    out.push({
      tone: "info",
      title: `Todavía no hay ventas en ${period.label}`,
      body: "Cuando entren pedidos con el pago confirmado, aquí vas a ver cuánto te queda de cada venta.",
    });
    return out;
  }

  // Un producto que deja bastante menos que el resto.
  if (o.avgMarginPct !== null && o.avgMarginPct > 0) {
    const low = o.products
      .filter(
        (p) =>
          !p.missingCost &&
          p.qty >= 2 &&
          p.marginPct !== null &&
          p.marginPct < o.avgMarginPct! * 0.6,
      )
      .sort((a, b) => b.revenueUsd - a.revenueUsd)[0];
    if (low && low.marginPct !== null) {
      const m = Math.round(low.marginPct);
      const avg = Math.round(o.avgMarginPct);
      out.push({
        tone: "warn",
        title: `${low.name} te deja ${m}%`,
        body:
          low.marginPct < o.avgMarginPct / 2
            ? `Es menos de la mitad de lo que ganas con el resto (${avg}%). Revisa su precio o lo que te cuesta.`
            : `El resto de tus productos te deja ${avg}%. Revisa su precio o lo que te cuesta.`,
        href: productHref(low.productId),
        cta: "Ver producto",
      });
    }
  }

  // Cómo va contra el período anterior.
  if (r.prevIncomeUsd > 0) {
    const pct = Math.round(((r.incomeUsd - r.prevIncomeUsd) / r.prevIncomeUsd) * 100);
    const counts = `vendiste ${r.salesCount} ${r.salesCount === 1 ? "vez" : "veces"} contra ${r.prevSalesCount}`;
    const prevTicket = r.prevSalesCount ? r.prevIncomeUsd / r.prevSalesCount : 0;
    if (pct >= 0) {
      // Más plata con menos ventas: lo que creció fue cada venta, y eso es
      // lo que hay que contar, no "vendiste 1 vez contra 2" a secas.
      const how =
        r.salesCount < r.prevSalesCount && prevTicket > 0
          ? `Vendiste menos veces (${r.salesCount} contra ${r.prevSalesCount}), pero cada venta fue más grande: ${formatUSD(r.avgTicketUsd)} contra ${formatUSD(prevTicket)}.`
          : `En el mismo tiempo ${counts}.`;
      out.push({
        tone: "good",
        title: pct === 0 ? `Vas igual que ${o.previousLabel}` : `Vas ${pct}% arriba de ${o.previousLabel}`,
        body: `${how}${o.projection?.bestMonth ? ` Si sigue así, ${monthName(period.from)} va a ser tu mejor mes.` : ""}`,
      });
    } else {
      // Qué bajó: cuántas veces se vendió o cuánto fue cada venta.
      const body =
        r.salesCount < r.prevSalesCount
          ? `Vendiste menos veces: ${r.salesCount} contra ${r.prevSalesCount}.`
          : prevTicket > 0 && r.avgTicketUsd < prevTicket
            ? `Vendiste ${r.salesCount > r.prevSalesCount ? "más" : "las mismas"} veces (${r.salesCount} contra ${r.prevSalesCount}), pero cada venta fue de menos: ${formatUSD(r.avgTicketUsd)} contra ${formatUSD(prevTicket)}.`
            : `En el mismo tiempo ${counts}.`;
      out.push({
        tone: "info",
        title: `Vas ${Math.abs(pct)}% abajo de ${o.previousLabel}`,
        body,
      });
    }
  }

  // Ventas sin costo cargado: la ganancia que se ve es mayor que la real.
  const missing = o.products.filter((p) => p.missingCost).sort((a, b) => b.revenueUsd - a.revenueUsd);
  if (missing.length === 1) {
    const p = missing[0];
    out.push({
      tone: "info",
      title: `${p.name} no tiene costo cargado`,
      body: `Se vendió ${p.qty} ${p.qty === 1 ? "vez" : "veces"} y cuenta como ganancia completa. Cárgale el costo para ver tu margen real.`,
      href: productHref(p.productId),
      cta: "Cargar costo",
    });
  } else if (missing.length > 1) {
    out.push({
      tone: "info",
      title: `${missing.length} productos se vendieron sin costo`,
      body: `Cuentan como ganancia completa, así que ganas menos de lo que ves. El que más vendió es ${missing[0].name}.`,
      href: "/panel/productos",
      cta: "Cargar costos",
    });
  }

  // Sin gastos registrados, la ganancia neta es la bruta.
  if (r.expensesUsd === 0) {
    out.push({
      tone: "info",
      title: "No registraste gastos",
      body: "Sin gastos, tu ganancia neta es igual a la bruta. Registra alquiler, sueldos o publicidad para ver lo que de verdad te queda.",
      href: "/panel/finanzas/gastos?nuevo=1",
      cta: "Registrar un gasto",
    });
  } else if (r.incomeUsd > 0 && r.expensesUsd / r.incomeUsd > 0.35) {
    const top = r.expensesByCategory[0];
    out.push({
      tone: "warn",
      title: `Tus gastos se llevan el ${Math.round((r.expensesUsd / r.incomeUsd) * 100)}% de lo que vendes`,
      body: top ? `El más grande es ${top.category.toLowerCase()}: ${formatUSD(top.usd)}.` : "",
      href: "/panel/finanzas/gastos",
      cta: "Ver gastos",
    });
  }

  return out.slice(0, 3);
}

// ── Todo junto ──────────────────────────────────────────────────────────────

export async function getFinanceOverview(
  storeId: string,
  period: ReportPeriod,
): Promise<FinanceOverview> {
  const today = caracasToday();
  const supabase = createClient();
  const isThisMonth = period.preset === "este-mes";
  const singleMonth = isThisMonth || period.preset === "mes-pasado";
  // Seis meses, salvo un año: de enero hasta donde va.
  const months = lastMonths(
    period.to,
    period.preset === "este-ano"
      ? ymd(period.to)[1]
      : period.preset === "ano-pasado"
        ? 12
        : 6,
    today,
  );
  const periodDays = dayIndex(period.from, period.to) + 1;
  const daily = periodDays <= 62;

  const [
    report,
    monthAggs,
    productReport,
    sales,
    { data: pendingRows },
    { data: recentSales },
    recentExpenses,
    { data: employeeRows },
    { data: dueRows },
    { data: paidRows },
    bcv,
    recurring,
    recurringSpent,
  ] = await Promise.all([
    getPeriodReport(storeId, period),
    Promise.all(months.map((m) => getRangeAgg(storeId, m.range.fromISO, m.range.toISO))),
    getProductReport(storeId, period),
    daily
      ? listSales(storeId, period, { newestFirst: false })
      : Promise.resolve({ rows: [], hasMore: false }),
    supabase.from("orders").select("total").eq("store_id", storeId).eq("status", "pending_confirmation"),
    supabase
      .from("orders")
      .select("id, order_number, customer_name, total, created_at, payment_method_type")
      .eq("store_id", storeId)
      .in("status", SALES_STATUSES)
      .order("created_at", { ascending: false })
      .limit(6),
    getRecentExpenses(storeId),
    supabase.from("employees").select("*").eq("store_id", storeId),
    // Ventas con tarjeta que Tiendify cobró y todavía no le pasó.
    supabase
      .from("orders")
      .select("total, payment_net")
      .eq("store_id", storeId)
      .in("payment_method_type", ["stripe", "paypal"])
      .in("status", SALES_STATUSES)
      .is("paid_out_at", null),
    supabase
      .from("orders")
      .select("total, payment_net, paid_out_at, payout_reference, payout_proof_url")
      .eq("store_id", storeId)
      .in("payment_method_type", ["stripe", "paypal"])
      .not("paid_out_at", "is", null)
      .order("paid_out_at", { ascending: false })
      .limit(200),
    getCachedBcvRates(),
    isThisMonth ? getRecurringExpenses(storeId) : Promise.resolve([]),
    getRecurringSpentByCategory(storeId, period.from, addDays(period.to, 1)),
  ]);

  const employees = (employeeRows ?? []) as Employee[];
  const payrollUsd = payrollMonthlyUsd(employees, bcv?.usd ?? null);
  const monthCats = byCategory(report.expensesByCategory);
  // Lo registrado por gastos que se repiten fuera de alquiler, sueldos y
  // servicios: también es fijo (los de esas tres ya cuentan por categoría).
  const recurringOtherUsd = [...recurringSpent]
    .filter(([cat]) => !FIXED_CATEGORIES.includes(cat))
    .reduce((s, [, usd]) => s + usd, 0);
  const fixedPaid = fixedOf(report.expensesByCategory) + recurringOtherUsd;

  // ── Mes a mes ──
  const monthPoints: MonthPoint[] = months.map((m, i) => {
    const a: RangeAgg = monthAggs[i];
    const gross = a.incomeUsd - a.cogsUsd;
    return {
      key: m.key,
      label: m.label,
      name: m.name,
      incomeUsd: a.incomeUsd,
      grossUsd: gross,
      netUsd: gross - a.expensesUsd,
      salesCount: a.salesCount,
      partial: m.partial,
    };
  });

  // ── Este mes: avance y proyección ──
  let monthProgress: FinanceOverview["monthProgress"] = null;
  let projection: FinanceOverview["projection"] = null;
  let fixedExpected = fixedPaid;
  if (isThisMonth) {
    const [y, m, d] = ymd(today);
    monthProgress = { day: d, days: daysInMonth(y, m) };

    // Lo que falta registrar este mes de los gastos que se repiten: el
    // alquiler del 30 ya cuenta aunque todavía no llegó.
    const monthEnd = `${today.slice(0, 8)}${String(monthProgress.days).padStart(2, "0")}`;
    const upcoming = new Map<string, number>();
    for (const r of recurring) {
      if (!r.active) continue;
      const cat = r.category || "Otros";
      const n = pendingBetween(r, today, monthEnd).length;
      if (n > 0) upcoming.set(cat, (upcoming.get(cat) ?? 0) + n * Number(r.amount));
    }

    // Los fijos del mes son, por categoría, lo que ya se pagó (más lo que se
    // repite y falta) o lo del mes pasado si fue más: el alquiler se paga una
    // vez y no se multiplica por los días. Los sueldos, además, por lo menos
    // lo de la nómina. Lo que se repite en otras categorías suma aparte.
    const last = monthAggs.length >= 2 ? byCategory(monthAggs[monthAggs.length - 2].expensesByCategory) : new Map();
    fixedExpected = FIXED_CATEGORIES.reduce((sum, cat) => {
      const floor = cat === "Sueldos" ? payrollUsd : 0;
      const now = (monthCats.get(cat) ?? 0) + (upcoming.get(cat) ?? 0);
      return sum + Math.max(now, last.get(cat) ?? 0, floor);
    }, recurringOtherUsd);
    for (const [cat, usd] of upcoming) {
      if (!FIXED_CATEGORIES.includes(cat)) fixedExpected += usd;
    }

    // Antes del tercer día, o con menos de cinco ventas, el ritmo dice poco:
    // una sola venta grande el día 2 proyectaba un mes que no iba a pasar.
    if (d >= 3 && report.salesCount >= MIN_SALES_TO_PROJECT) {
      const factor = monthProgress.days / d;
      const variable = report.expensesUsd - fixedPaid;
      const incomeUsd = report.incomeUsd * factor;
      const best = Math.max(0, ...monthPoints.slice(0, -1).map((p) => p.incomeUsd));
      projection = {
        incomeUsd,
        netUsd: report.grossUsd * factor - fixedExpected - variable * factor,
        bestMonth: best > 0 && incomeUsd > best,
      };
    }
  }

  // ── Punto de equilibrio: cuánto vender para pagar los fijos del mes ──
  let breakEven: FinanceOverview["breakEven"] = null;
  if (singleMonth && fixedExpected > 0 && report.cogsUsd > 0 && report.grossUsd > 0) {
    const salesNeededUsd = fixedExpected / (report.grossUsd / report.incomeUsd);
    let reachedOn: string | null = null;
    let cumulative = 0;
    for (const s of sales.rows) {
      cumulative += Number(s.total);
      if (cumulative >= salesNeededUsd) {
        reachedOn = longDay(caracasToday(new Date(s.created_at)));
        break;
      }
    }
    let projectedOn: string | null = null;
    if (!reachedOn && monthProgress && report.incomeUsd > 0) {
      const perDay = report.incomeUsd / monthProgress.day;
      const target = monthProgress.day + Math.ceil((salesNeededUsd - report.incomeUsd) / perDay);
      if (target <= monthProgress.days) {
        projectedOn = longDay(`${today.slice(0, 8)}${String(target).padStart(2, "0")}`);
      }
    }
    breakEven = { fixedUsd: fixedExpected, salesNeededUsd, reachedOn, projectedOn };
  }

  // ── Lo vendido por día, para la línea de la tarjeta ──
  let trend: number[];
  if (daily) {
    trend = Array.from({ length: periodDays }, () => 0);
    for (const s of sales.rows) {
      const i = dayIndex(period.from, caracasToday(new Date(s.created_at)));
      if (i >= 0 && i < trend.length) trend[i] += Number(s.total);
    }
    if (isThisMonth && monthProgress) trend = trend.slice(0, monthProgress.day);
  } else {
    trend = monthPoints.map((p) => p.incomeUsd);
  }

  // ── Productos y avisos ──
  const products = rankProducts(productReport.rows);
  const prevLabel = previousLabel(period);
  const insights = buildInsights({
    period,
    report,
    previousLabel: prevLabel,
    products: productReport.rows,
    avgMarginPct: products.avgMarginPct,
    projection,
  });

  // ── Cómo le pagan ──
  const methods = report.byMethod.map((m) => ({
    type: m.type,
    label: methodLabel(m.type),
    usd: m.usd,
    count: m.count,
    pct: report.incomeUsd > 0 ? (m.usd / report.incomeUsd) * 100 : 0,
  }));
  const bsUsd = report.byMethod.filter((m) => BS_METHODS.has(m.type)).reduce((s, m) => s + m.usd, 0);

  // ── Cobros ──
  const pending = pendingRows ?? [];
  const due = dueRows ?? [];
  const latest = paidRows?.[0];
  let lastPayout: FinanceOverview["collect"]["lastPayout"] = null;
  if (latest?.paid_out_at) {
    const group = (paidRows ?? []).filter((o) => o.paid_out_at === latest.paid_out_at);
    let proofUrl: string | null = null;
    if (latest.payout_proof_url) {
      const { data } = await createAdminClient()
        .storage.from(PAYMENT_PROOFS_BUCKET)
        .createSignedUrl(latest.payout_proof_url, 3600);
      proofUrl = data?.signedUrl ?? null;
    }
    lastPayout = {
      date: latest.paid_out_at,
      amountUsd: group.reduce((s, o) => s + Number(o.payment_net ?? o.total), 0),
      reference: latest.payout_reference,
      proofUrl,
    };
  }

  // ── Últimos movimientos: ventas y gastos juntos ──
  const movements: (Movement & { at: string })[] = [
    ...(recentSales ?? []).map((o) => ({
      id: `v-${o.id}`,
      kind: "in" as const,
      title: `Venta #${o.order_number} · ${o.customer_name}`,
      sub: `${whenLabel(o.created_at, today)} · ${methodLabel(o.payment_method_type ?? "other")}`,
      amountUsd: Number(o.total),
      href: `/panel/pedidos/${o.id}`,
      at: o.created_at,
    })),
    ...(recentExpenses as Expense[]).map((e) => {
      // `spent_at` es un día sin hora: si se cargó ese mismo día, la hora de
      // carga lo ordena bien entre las ventas; si no, va al mediodía.
      const at =
        caracasToday(new Date(e.created_at)) === e.spent_at
          ? e.created_at
          : new Date(`${e.spent_at}T12:00:00-04:00`).toISOString();
      return {
        id: `g-${e.id}`,
        kind: "out" as const,
        title: `${e.category || "Otros"} · ${e.description}`,
        sub: e.spent_at === today ? "hoy" : e.spent_at === addDays(today, -1) ? "ayer" : shortDay(e.spent_at),
        amountUsd: Number(e.amount),
        at,
      };
    }),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);

  const sueldos = monthCats.get("Sueldos") ?? 0;

  return {
    period,
    report,
    previousLabel: prevLabel,
    previousShort: singleMonth ? monthName(period.previous.from) : "antes",
    periodName: singleMonth ? monthName(period.from) : period.label,
    bcvUsd: bcv?.usd ?? null,
    monthProgress,
    projection,
    breakEven,
    trend,
    months: monthPoints,
    products,
    methods,
    bsSharePct: report.incomeUsd > 0 ? (bsUsd / report.incomeUsd) * 100 : null,
    expenses: report.expensesByCategory.map((c) => ({
      category: c.category,
      usd: c.usd,
      pct: report.expensesUsd > 0 ? (c.usd / report.expensesUsd) * 100 : 0,
      fixed: FIXED_CATEGORIES.includes(c.category) || recurringSpent.has(c.category),
    })),
    payrollDueUsd: isThisMonth && payrollUsd - sueldos >= 1 ? payrollUsd - sueldos : null,
    collect: {
      pendingUsd: pending.reduce((s, o) => s + Number(o.total), 0),
      pendingCount: pending.length,
      payoutDueUsd: due.reduce((s, o) => s + Number(o.payment_net ?? o.total), 0),
      payoutDueCount: due.length,
      lastPayout,
    },
    payroll: {
      monthlyUsd: payrollUsd,
      people: employees.filter((e) => e.active).length,
      paidUsd: isThisMonth ? sueldos : null,
    },
    movements,
    insights,
    marginTrend: monthPoints.map((p) => (p.incomeUsd > 0 ? (p.grossUsd / p.incomeUsd) * 100 : 0)),
    ticketTrend: monthPoints.map((p) => (p.salesCount > 0 ? p.incomeUsd / p.salesCount : 0)),
  };
}
