import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CreditCard,
  Info,
  Plus,
  TrendingUp,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  MIN_SALES_TO_PROJECT,
  type FinanceOverview,
  type Insight,
  type MarginTier,
} from "@/lib/finance-overview";
import { formatBs, formatUSD } from "@/lib/format";
import { periodQuery } from "@/lib/report-period";
import { cn } from "@/lib/utils";

/**
 * Las piezas del resumen de Finanzas. Cada número tiene un color fijo en
 * toda la pantalla: lo vendido en azul, la mercadería en naranja, los gastos
 * en violeta y lo que queda en verde. Así la barra de arriba, el gráfico y las
 * tarjetas se leen juntos sin volver a mirar la leyenda.
 */
const C = {
  sales: "#0284C7",
  cogs: "#eb6834",
  expenses: "#6250d6",
  profit: "#1baf7a",
} as const;

/** Tonos del violeta de gastos, del más grande al más chico. */
const EXPENSE_RAMP = ["#4B3BB8", "#6250d6", "#8A7CE3", "#ACA3EC", "#CBC5F3", "#E2DEF8"];
/** Tonos del azul de ventas, para los métodos de pago. */
const METHOD_RAMP = ["#075985", "#0284C7", "#38BDF8", "#7DD3FC", "#BAE6FD", "#E0F2FE"];

const TIER: Record<MarginTier, { bar: string; text: string }> = {
  good: { bar: "bg-[#1baf7a]", text: "text-[#11755A]" },
  mid: { bar: "bg-brand-600", text: "text-brand-700" },
  low: { bar: "bg-[#D97706]", text: "text-[#92400E]" },
  none: { bar: "", text: "text-ink-500" },
};

const card = "rounded-2xl border bg-card p-5 sm:p-6";
const eyebrow =
  "font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500";
const h2 = "font-display text-lg font-bold tracking-[-0.02em]";

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

/** "$4,412" sin centavos, para lo que es orden de magnitud. */
function usd0(n: number): string {
  return `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
}

function money(n: number): string {
  return n < 0 ? `−${formatUSD(Math.abs(n))}` : formatUSD(n);
}

function Swatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-2.5 shrink-0 rounded-[3px]", className)}
      style={{ background: color }}
    />
  );
}

/** ▲ 18% / ▼ 4%. Sin anterior no hay porcentaje: no se inventa un "+100%". */
function Delta({ value, unit = "%" }: { value: number | null; unit?: string }) {
  if (value === null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  const shown = unit === "%" ? Math.round(Math.abs(value)) : Math.abs(Math.round(value));
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-bold tabular-nums",
        up ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FDE8E4] text-[#9F2A16]",
      )}
    >
      {up ? "▲" : "▼"} {shown}
      {unit === "%" ? "%" : ` ${unit}`}
    </span>
  );
}

function Spark({ values, color, label }: { values: number[]; color: string; label: string }) {
  if (values.length < 2 || values.every((v) => v === values[0])) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = 116 / (values.length - 1);
  const points = values
    .map((v, i) => `${(2 + i * step).toFixed(1)},${(33 - ((v - min) / (max - min || 1)) * 30).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      viewBox="0 0 120 36"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="h-8 w-24 shrink-0"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ── Cabecera ────────────────────────────────────────────────────────────────

/** Ganancia neta, a dónde se fue cada dólar vendido y la cuenta completa. */
export function FinanceHero({ o }: { o: FinanceOverview }) {
  const r = o.report;
  const income = r.incomeUsd;
  const base = Math.max(income, r.cogsUsd + r.expensesUsd, 1);
  const parts = [
    { key: "cogs", label: "Mercadería", hint: "lo que te costó lo que vendiste", usd: r.cogsUsd, color: C.cogs },
    { key: "exp", label: "Gastos", hint: "alquiler, sueldos, publicidad…", usd: r.expensesUsd, color: C.expenses },
    { key: "net", label: "Te queda", hint: "tu ganancia neta", usd: Math.max(0, r.netUsd), color: C.profit },
  ];
  const netGrowth =
    r.prevNetUsd > 0 ? ((r.netUsd - r.prevNetUsd) / r.prevNetUsd) * 100 : null;
  const keep = income > 0 ? Math.round((r.netUsd / income) * 100) : null;
  const loss = r.netUsd < 0;

  return (
    <section aria-labelledby="ganancia" className={cn(card, "flex flex-col gap-6 lg:col-span-2")}>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p id="ganancia" className={eyebrow}>
            {loss ? "Pérdida" : "Ganancia neta"} · {o.periodName}
          </p>
          <p className="mt-2.5 font-display text-[3.25rem] font-extrabold leading-[0.95] tracking-[-0.045em] tabular-nums sm:text-[3.75rem]">
            {money(r.netUsd)}
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-600">
            <Delta value={netGrowth} />
            vs. {money(r.prevNetUsd)} {o.previousLabel}
          </p>
          {o.bcvUsd && r.netUsd > 0 && (
            <p className="mt-1.5 font-landing-mono text-[12.5px] text-ink-500">
              ≈ {formatBs(r.netUsd * o.bcvUsd)} a la tasa BCV de hoy
            </p>
          )}
        </div>
        {/* Sin costos cargados, "lo que te queda" es todo lo cobrado: decirle
            que le quedan $100 de cada $100 sería mentirle. */}
        {keep !== null && r.cogsUsd === 0 ? (
          <p className="max-w-[17rem] rounded-xl bg-[#FEF3C7] px-4 py-3 text-[14px] leading-snug text-[#6B4A00]">
            Tus productos no tienen costo cargado: esta ganancia es lo que cobraste
            {r.expensesUsd > 0 ? " menos los gastos" : ""}, no lo que te queda.{" "}
            <Link href="/panel/productos" className="font-semibold underline">
              Cargar costos
            </Link>
          </p>
        ) : keep !== null ? (
          <p className="max-w-[16rem] rounded-xl bg-[#E8F8F1] px-4 py-3 text-[15px] leading-snug">
            {keep > 0 ? (
              <>
                De cada <b>$100</b> que vendes,{" "}
                <b className="text-[#11755A]">te quedan ${keep}</b> limpios.
              </>
            ) : (
              <>La mercadería y los gastos se llevaron todo lo que vendiste.</>
            )}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3.5">
        <div
          role="img"
          aria-label={`De lo vendido: ${parts.map((p) => `${p.label.toLowerCase()} ${pct((p.usd / base) * 100)}`).join(", ")}`}
          className="flex h-[18px] gap-[3px] overflow-hidden rounded-[7px] bg-ink-100"
        >
          {/* Cada tramo crece según su parte: con pérdida, mercadería y gastos
              llenan la barra entera, que es justo lo que pasó. */}
          {income > 0 &&
            parts
              .filter((p) => p.usd > 0)
              .map((p) => <span key={p.key} style={{ flex: `${p.usd} 1 0`, background: p.color }} />)}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {parts.map((p) => (
            <div key={p.key}>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-600">
                <Swatch color={p.color} />
                {p.label}
              </p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums">
                {p.key === "net" ? money(r.netUsd) : formatUSD(p.usd)}{" "}
                {income > 0 && (
                  <span className="font-landing-mono text-xs font-medium text-ink-500">
                    {pct((p.key === "net" ? r.netUsd : p.usd) / income * 100)}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-ink-500">{p.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-5 text-[13px] text-ink-600">
        <FlowChip label="Vendiste" value={formatUSD(income)} color={C.sales} />
        <Op>−</Op>
        <FlowChip label="Mercadería" value={formatUSD(r.cogsUsd)} />
        <Op>−</Op>
        <FlowChip label="Gastos" value={formatUSD(r.expensesUsd)} />
        <Op>=</Op>
        <FlowChip label={loss ? "Pérdida" : "Ganancia"} value={money(r.netUsd)} highlight />
      </div>
    </section>
  );
}

function FlowChip({
  label,
  value,
  color,
  highlight,
}: {
  label: string;
  value: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-[10px] px-3",
        highlight ? "bg-[#E8F8F1]" : "bg-surface",
      )}
    >
      {color && <Swatch color={color} />}
      {label} <b className="tabular-nums text-foreground">{value}</b>
    </span>
  );
}

function Op({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden="true" className="font-landing-mono text-base text-ink-400">
      {children}
    </span>
  );
}

/**
 * La tarjeta oscura: hacia dónde va el mes (o cómo cerró) y el punto de
 * equilibrio, que es lo que de verdad decide si el mes fue bueno.
 */
export function FinanceOutlook({ o }: { o: FinanceOverview }) {
  const r = o.report;
  const be = o.breakEven;
  const p = o.projection;
  const single = o.period.preset === "este-mes" || o.period.preset === "mes-pasado";

  let title: React.ReactNode;
  let label: string;
  if (o.monthProgress && p) {
    label = "Si sigues a este ritmo";
    title = (
      <>
        Cierras {o.periodName} con{" "}
        <span className="tabular-nums text-sol">≈ {usd0(p.incomeUsd)}</span> vendidos y{" "}
        {p.netUsd >= 0 ? (
          <>
            <span className="tabular-nums text-[#5EE0AE]">≈ {usd0(p.netUsd)}</span> de ganancia.
          </>
        ) : (
          <>
            una pérdida de <span className="tabular-nums text-[#FFB4A3]">≈ {usd0(-p.netUsd)}</span>.
          </>
        )}
      </>
    );
  } else if (o.monthProgress) {
    const early = o.monthProgress.day < 3;
    label = early ? `Recién empieza ${o.periodName}` : `En lo que va de ${o.periodName}`;
    title = early ? (
      <>Con unos días más de ventas, aquí verás cómo cerrarías el mes.</>
    ) : (
      <>
        Llevas <span className="tabular-nums text-sol">{usd0(r.incomeUsd)}</span> vendidos. Cuando
        tengas {MIN_SALES_TO_PROJECT} ventas en el mes, aquí verás cómo lo cerrarías.
      </>
    );
  } else {
    label =
      o.period.preset === "mes-pasado"
        ? `Cómo cerró ${o.periodName}`
        : o.period.preset === "trimestre"
          ? "En lo que va del trimestre"
          : o.period.preset === "este-ano"
            ? `En lo que va de ${o.period.from.slice(0, 4)}`
            : `En ${o.period.label}`;
    title = (
      <>
        Vendiste <span className="tabular-nums text-sol">{usd0(r.incomeUsd)}</span> y{" "}
        {r.netUsd >= 0 ? (
          <>
            te quedaron <span className="tabular-nums text-[#5EE0AE]">{usd0(r.netUsd)}</span>.
          </>
        ) : (
          <>
            perdiste <span className="tabular-nums text-[#FFB4A3]">{usd0(-r.netUsd)}</span>.
          </>
        )}
      </>
    );
  }

  // En un trimestre o un año no hay punto de equilibrio mensual: en su lugar,
  // el promedio por mes y el mejor mes del período.
  const inPeriod = o.months.filter((m) => m.key >= o.period.from.slice(0, 7));
  const perMonth =
    !single && inPeriod.length > 1
      ? {
          income: inPeriod.reduce((s, m) => s + m.incomeUsd, 0) / inPeriod.length,
          net: inPeriod.reduce((s, m) => s + m.netUsd, 0) / inPeriod.length,
          best: [...inPeriod].sort((a, b) => b.incomeUsd - a.incomeUsd)[0],
        }
      : null;

  const scale = be ? Math.max(be.salesNeededUsd * 1.15, p?.incomeUsd ?? 0, r.incomeUsd) : 1;
  const remaining = be ? Math.max(0, be.salesNeededUsd - r.incomeUsd) : 0;

  return (
    <section className="flex flex-col gap-5 rounded-2xl bg-noche p-5 text-white sm:p-6">
      <p className={cn(eyebrow, "text-niebla")}>{label}</p>
      <p className="font-display text-2xl font-bold leading-tight tracking-[-0.015em]">{title}</p>

      {o.monthProgress && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[12.5px] text-niebla">
            <span>
              Día {o.monthProgress.day} de {o.monthProgress.days}
            </span>
            <span className="font-landing-mono">
              {pct((o.monthProgress.day / o.monthProgress.days) * 100)} del mes
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.14]">
            <div
              className="h-full rounded-full bg-brand-400"
              style={{ width: `${(o.monthProgress.day / o.monthProgress.days) * 100}%` }}
            />
          </div>
        </div>
      )}

      {single && <div className="h-px bg-white/10" />}

      {be ? (
        <div className="flex flex-col gap-3">
          <p className={cn(eyebrow, "text-niebla")}>Punto de equilibrio</p>
          <p className="text-sm leading-relaxed text-white/[0.85]">
            Tus gastos fijos del mes son{" "}
            <b className="tabular-nums text-white">{usd0(be.fixedUsd)}</b>. Con tu margen, se cubren
            vendiendo <b className="tabular-nums text-white">{usd0(be.salesNeededUsd)}</b>.
          </p>
          <div className="relative mt-5">
            <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.14]">
              <div
                className="h-full bg-[#1baf7a]"
                style={{ width: `${Math.min(100, (r.incomeUsd / scale) * 100)}%` }}
              />
            </div>
            <div
              aria-hidden="true"
              className="absolute -bottom-1 -top-[18px] w-0.5 bg-sol"
              style={{ left: `${(be.salesNeededUsd / scale) * 100}%` }}
            />
            <span
              className="absolute -top-[22px] translate-x-1.5 font-landing-mono text-[11px] text-sol"
              style={{ left: `${(be.salesNeededUsd / scale) * 100}%` }}
            >
              {usd0(be.salesNeededUsd)}
            </span>
          </div>
          <p className="flex items-start gap-2 text-[13.5px] leading-snug">
            {be.reachedOn ? (
              <>
                <Check className="mt-0.5 size-[18px] shrink-0 text-[#5EE0AE]" strokeWidth={2.4} />
                <span>
                  Lo pasaste el <b>{be.reachedOn}</b>.
                  {o.monthProgress &&
                    " Desde ese día, lo que ganas con cada venta ya no se va en cubrir gastos."}
                </span>
              </>
            ) : (
              <>
                <CalendarClock className="mt-0.5 size-[18px] shrink-0 text-sol" />
                <span>
                  {o.monthProgress
                    ? `Te faltan ${usd0(remaining)}. ${be.projectedOn ? `A este ritmo lo pasas el ${be.projectedOn}.` : "A este ritmo no llegas este mes."}`
                    : `Te faltaron ${usd0(remaining)} para cubrirlos.`}
                </span>
              </>
            )}
          </p>
        </div>
      ) : perMonth ? (
        <>
          <div className="h-px bg-white/10" />
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className={cn(eyebrow, "text-niebla")}>Por mes, en promedio</dt>
              <dd className="mt-2 font-display text-xl font-bold tabular-nums">{usd0(perMonth.income)}</dd>
              <dd className="mt-0.5 text-[13px] text-white/[0.75]">
                vendidos · {usd0(perMonth.net)} de ganancia
              </dd>
            </div>
            {perMonth.best.incomeUsd > 0 && (
              <div>
                <dt className={cn(eyebrow, "text-niebla")}>Tu mejor mes</dt>
                <dd className="mt-2 font-display text-xl font-bold">{cap(perMonth.best.name)}</dd>
                <dd className="mt-0.5 text-[13px] text-white/[0.75]">
                  {usd0(perMonth.best.incomeUsd)} vendidos
                </dd>
              </div>
            )}
          </dl>
        </>
      ) : single ? (
        <p className="text-[13.5px] leading-relaxed text-white/[0.8]">
          Para ver tu punto de equilibrio, registra tus gastos fijos (alquiler, sueldos, servicios)
          y cárgale el costo a tus productos.{" "}
          <Link href="/panel/finanzas/gastos?nuevo=1" className="font-semibold text-brand-300 underline">
            Registrar un gasto
          </Link>
        </p>
      ) : null}
    </section>
  );
}

// ── Tarjetas ────────────────────────────────────────────────────────────────

export function FinanceKpis({ o }: { o: FinanceOverview }) {
  const r = o.report;
  const hasCosts = r.cogsUsd > 0;
  const margin = r.incomeUsd > 0 ? (r.grossUsd / r.incomeUsd) * 100 : null;
  const prevMargin =
    r.prevIncomeUsd > 0 && r.prevCogsUsd > 0
      ? ((r.prevIncomeUsd - r.prevCogsUsd) / r.prevIncomeUsd) * 100
      : null;
  const prevTicket = r.prevSalesCount ? r.prevIncomeUsd / r.prevSalesCount : null;
  const pending = o.collect.pendingCount > 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Kpi
        label="Ventas"
        color={C.sales}
        value={formatUSD(r.incomeUsd)}
        spark={<Spark values={o.trend} color={C.sales} label="Lo vendido en el período" />}
        sub={
          <>
            <Delta value={r.incomeGrowthPct} />
            {r.salesCount} {r.salesCount === 1 ? "venta" : "ventas"} · {r.customers}{" "}
            {r.customers === 1 ? "cliente" : "clientes"}
          </>
        }
      />
      <Kpi
        label="Margen bruto"
        color={C.profit}
        value={hasCosts && margin !== null ? pct(margin) : "—"}
        spark={<Spark values={o.marginTrend} color={C.profit} label="Margen bruto por mes" />}
        sub={
          hasCosts && margin !== null ? (
            <>
              {prevMargin !== null && <Delta value={margin - prevMargin} unit="pts" />}
              {prevMargin !== null ? `${o.previousShort}: ${pct(prevMargin)}` : "lo que te deja cada venta"}
            </>
          ) : (
            "carga el costo de tus productos para verlo"
          )
        }
      />
      <Kpi
        label="Ticket promedio"
        color={C.expenses}
        value={r.salesCount ? formatUSD(r.avgTicketUsd) : "—"}
        spark={<Spark values={o.ticketTrend} color={C.expenses} label="Ticket promedio por mes" />}
        sub={
          prevTicket ? (
            <>
              <Delta value={((r.avgTicketUsd - prevTicket) / prevTicket) * 100} />
              {o.previousShort}: {formatUSD(prevTicket)}
            </>
          ) : (
            "lo que gasta cada cliente por pedido"
          )
        }
      />
      <section
        className={cn(
          "flex flex-col gap-2.5 rounded-2xl border p-4 sm:p-5",
          pending ? "border-[#F5DE7A] bg-[#FFF8DB]" : "bg-card",
        )}
      >
        <p className={cn("flex items-center gap-2 text-[13px] font-semibold", pending ? "text-[#6B5300]" : "text-ink-600")}>
          <Swatch color={pending ? "#E0B400" : "#BFCEDD"} />
          Por cobrar
        </p>
        <p className="font-display text-[1.6rem] font-extrabold leading-tight tracking-[-0.025em] tabular-nums sm:text-[1.9rem]">
          {formatUSD(o.collect.pendingUsd)}
        </p>
        <p className={cn("text-[12.5px] leading-snug", pending ? "text-[#6B5300]" : "text-ink-500")}>
          {pending ? (
            <>
              {o.collect.pendingCount}{" "}
              {o.collect.pendingCount === 1 ? "comprobante por revisar" : "comprobantes por revisar"} ·{" "}
              <Link href="/panel/pedidos?status=pending_confirmation" className="font-semibold underline">
                Revisar
              </Link>
            </>
          ) : (
            "Ningún comprobante esperando"
          )}
        </p>
      </section>
    </div>
  );
}

function Kpi({
  label,
  color,
  value,
  spark,
  sub,
}: {
  label: string;
  color: string;
  value: string;
  spark: React.ReactNode;
  sub: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2.5 rounded-2xl border bg-card p-4 sm:p-5">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-600">
        <Swatch color={color} />
        {label}
      </p>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="font-display text-[1.6rem] font-extrabold leading-tight tracking-[-0.025em] tabular-nums sm:text-[1.9rem]">
          {value}
        </p>
        {spark}
      </div>
      <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] leading-snug text-ink-500">{sub}</p>
    </section>
  );
}

// ── Mes a mes ───────────────────────────────────────────────────────────────

/** Un tope redondo para el eje: 3 tramos de 1, 2, 2,5 o 5 × 10ⁿ. */
function niceTop(max: number): number {
  if (max <= 0) return 300;
  const raw = max / 3;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * exp).find((s) => s >= raw) ?? 10 * exp;
  return step * 3;
}

function axisLabel(v: number): string {
  if (v >= 1000) return `$${Number((v / 1000).toFixed(1))}k`;
  return `$${Math.round(v)}`;
}

export function MonthlyChart({ o }: { o: FinanceOverview }) {
  const last = o.months.length - 1;
  const proj = o.projection;
  const top = niceTop(
    Math.max(...o.months.map((m) => m.incomeUsd), proj?.incomeUsd ?? 0),
  );
  const best = o.months
    .filter((m) => !m.partial && m.incomeUsd > 0)
    .sort((a, b) => b.incomeUsd - a.incomeUsd)[0];
  const h = (v: number) => `${Math.max(0, Math.min(100, (v / top) * 100))}%`;

  return (
    <section aria-labelledby="mes-a-mes" className={cn(card, "flex flex-col gap-5 lg:col-span-2")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="mes-a-mes" className={h2}>
            Ventas y ganancia, mes a mes
          </h2>
          <p className="mt-1 text-[13px] text-ink-600">
            {proj
              ? `${cap(o.periodName)} va por la mitad: lo punteado es hasta dónde llegaría a este ritmo.`
              : "Lo que vendiste y lo que te quedó cada mes."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3.5 text-[12.5px] text-ink-600">
          <span className="flex items-center gap-1.5">
            <Swatch color={C.sales} /> Ventas
          </span>
          <span className="flex items-center gap-1.5">
            <Swatch color={C.profit} /> Ganancia neta
          </span>
          {proj && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-[3px] border-[1.5px] border-dashed border-ink-500" />
              Proyección
            </span>
          )}
        </div>
      </div>

      <div
        role="img"
        aria-label={o.months
          .map((m) => `${m.name}: ${usd0(m.incomeUsd)} vendidos, ${usd0(m.netUsd)} de ganancia`)
          .join("; ")}
      >
        <div className="relative ml-10 h-[220px] sm:h-[250px]">
          {[1, 2 / 3, 1 / 3, 0].map((f) => (
            <div key={f} className="absolute inset-x-0" style={{ top: `${(1 - f) * 100}%` }}>
              <div className={cn("border-t", f === 0 ? "border-ink-300" : "border-ink-100")} />
              <span className="absolute -left-10 w-8 -translate-y-1/2 text-right font-landing-mono text-[11px] text-ink-400">
                {axisLabel(top * f)}
              </span>
            </div>
          ))}
          <div className="absolute inset-0 flex gap-1 px-1 sm:gap-2.5 sm:px-2">
            {o.months.map((m, i) => {
              const projected = i === last && m.partial && proj;
              const vBox = projected ? proj.incomeUsd : m.incomeUsd;
              const gBox = projected ? Math.max(0, proj.netUsd) : Math.max(0, m.netUsd);
              return (
                <div
                  key={m.key}
                  className="group relative flex h-full flex-1 items-end justify-center gap-[3px] rounded-lg transition-colors hover:bg-brand-600/[0.05] sm:gap-1"
                >
                  {/* Solo con mouse: en el teléfono no hay hover y, aunque
                      invisible, la del último mes empujaba la página de lado.
                      Las de las puntas se alinean al borde por lo mismo. */}
                  <div
                    className={cn(
                      "pointer-events-none absolute -top-1.5 z-10 hidden min-w-[170px] -translate-y-full rounded-[10px] bg-noche px-3 py-2.5 text-[12.5px] leading-normal text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 sm:block",
                      i === 0 ? "left-0" : i === last ? "right-0" : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    <b className="mb-1 block">
                      {cap(m.name)}
                      {m.partial ? " (en curso)" : ""}
                    </b>
                    <span className="block">
                      Ventas <b className="tabular-nums">{usd0(m.incomeUsd)}</b>
                    </span>
                    <span className="block">
                      Ganancia <b className="tabular-nums">{usd0(m.netUsd)}</b>
                    </span>
                    <span className="block text-niebla">
                      {projected
                        ? `A este ritmo: ≈ ${usd0(proj.incomeUsd)} y ≈ ${usd0(proj.netUsd)}`
                        : m.incomeUsd > 0
                          ? `Margen neto ${pct((m.netUsd / m.incomeUsd) * 100)}`
                          : "Sin ventas"}
                    </span>
                  </div>
                  <Bar box={h(vBox)} fill={projected ? `${(m.incomeUsd / vBox) * 100}%` : "100%"} color={C.sales} dashed={!!projected} />
                  <Bar
                    box={h(gBox)}
                    fill={projected && gBox > 0 ? `${Math.min(100, (Math.max(0, m.netUsd) / gBox) * 100)}%` : "100%"}
                    color={C.profit}
                    dashed={!!projected}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="ml-10 mt-2 flex gap-1 px-1 sm:gap-2.5 sm:px-2">
          {o.months.map((m) => (
            <span key={m.key} className="flex-1 text-center font-landing-mono text-[11.5px] text-ink-500">
              {m.label}
            </span>
          ))}
        </div>
      </div>

      {best && (
        <p className="text-[13px] text-ink-600">
          Tu mejor mes fue <b>{best.name}</b>: {usd0(best.incomeUsd)} vendidos y{" "}
          {usd0(best.netUsd)} de ganancia.
        </p>
      )}
    </section>
  );
}

function Bar({ box, fill, color, dashed }: { box: string; fill: string; color: string; dashed: boolean }) {
  return (
    <div
      className={cn(
        "flex w-3 flex-col justify-end overflow-hidden rounded-t-[5px] sm:w-[22px]",
        dashed && "border-[1.5px] border-b-0 border-dashed",
      )}
      style={{ height: box, borderColor: dashed ? color : undefined }}
    >
      <div className="w-full rounded-t-[4px]" style={{ height: fill, background: color }} />
    </div>
  );
}

// ── Avisos ──────────────────────────────────────────────────────────────────

const TONE: Record<Insight["tone"], { icon: typeof Info; className: string }> = {
  warn: { icon: AlertTriangle, className: "bg-[#FEF3C7] text-[#92400E]" },
  good: { icon: TrendingUp, className: "bg-[#DCF5EA] text-[#11755A]" },
  info: { icon: Info, className: "bg-brand-100 text-brand-700" },
};

export function FinanceInsights({ items }: { items: Insight[] }) {
  return (
    <section aria-labelledby="avisos" className="flex min-w-0 flex-col gap-3">
      <h2 id="avisos" className={cn(h2, "px-0.5 pt-1")}>
        Lo que dicen tus números
      </h2>
      {items.map((it) => {
        const t = TONE[it.tone];
        return (
          <div key={it.title} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px]", t.className)}>
              <t.icon className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-[14.5px] font-bold leading-snug">{it.title}</p>
              {it.body && <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{it.body}</p>}
              {it.href && it.cta && (
                <Link href={it.href} className="mt-1.5 inline-block text-[13px] font-semibold text-brand-700 hover:underline">
                  {it.cta} →
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ── Productos ───────────────────────────────────────────────────────────────

export function ProductProfit({ o }: { o: FinanceOverview }) {
  const rows = o.products.rows;
  const scale = Math.max(60, ...rows.map((r) => r.marginPct ?? 0));
  const reportHref = `/panel/finanzas/reportes?${new URLSearchParams({ tipo: "productos", ...periodQuery(o.period) })}`;

  return (
    <section aria-labelledby="productos-ganancia" className={cn(card, "lg:col-span-3")}>
      <h2 id="productos-ganancia" className={h2}>
        Qué productos te dejan más
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
        Ordenados por lo que te dejan, no por lo que vendes: el que más se vende no siempre es el que
        más gana.
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-ink-500">
          Sin productos vendidos en {o.period.label}.
        </p>
      ) : (
        <>
          <div className="mt-4 hidden grid-cols-[28px_minmax(0,1fr)_88px_180px] gap-3.5 pb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-500 sm:grid">
            <span />
            <span>Producto</span>
            <span className="text-right">Ganancia</span>
            <span>Margen</span>
          </div>
          <ol className="mt-2 sm:mt-0">
            {rows.map((r, i) => {
              const tier = TIER[r.tier];
              return (
                <li
                  key={`${r.productId ?? r.name}-${i}`}
                  className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 border-t py-3 sm:grid-cols-[28px_minmax(0,1fr)_88px_180px]"
                >
                  <span className="grid size-[26px] place-items-center rounded-lg bg-surface font-landing-mono text-xs font-semibold text-ink-600">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={r.productId ? `/panel/productos/${r.productId}` : "/panel/productos"}
                      className="block truncate text-sm font-semibold hover:underline"
                    >
                      {r.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {r.qty} {r.qty === 1 ? "vendido" : "vendidos"} · ingreso {usd0(r.revenueUsd)}
                    </p>
                  </div>
                  <span className="text-right font-display text-lg font-bold tabular-nums">
                    {r.cost === "ok" ? usd0(r.profitUsd) : "—"}
                  </span>
                  <div className="col-span-3 flex items-center gap-2 pl-[42px] sm:col-span-1 sm:pl-0">
                    <div
                      className={cn(
                        "h-2 flex-1 overflow-hidden rounded-full",
                        r.tier === "none"
                          ? "bg-[repeating-linear-gradient(135deg,hsl(var(--ink-100))_0_5px,hsl(var(--ink-25))_5px_10px)]"
                          : "bg-ink-100",
                      )}
                    >
                      {r.marginPct !== null && r.tier !== "none" && (
                        <div
                          className={cn("h-full rounded-full", tier.bar)}
                          style={{ width: `${Math.max(2, (Math.max(0, r.marginPct) / scale) * 100)}%` }}
                        />
                      )}
                    </div>
                    <span className={cn("min-w-[5.5rem] whitespace-nowrap text-right font-landing-mono text-xs font-semibold", tier.text)}>
                      {r.cost === "none"
                        ? "sin costo"
                        : r.cost === "partial"
                          ? "costo incompleto"
                          : r.tier === "low"
                            ? `${pct(r.marginPct ?? 0)} · bajo`
                            : pct(r.marginPct ?? 0)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
          <Link href={reportHref} className="mt-3 inline-block text-[13px] font-semibold text-brand-700 hover:underline">
            Ver {o.products.total === 1 ? "el producto" : `los ${o.products.total} productos`} en Reportes →
          </Link>
        </>
      )}
    </section>
  );
}

// ── Gastos ──────────────────────────────────────────────────────────────────

/** Un aro de `conic-gradient` con un corte blanco entre porciones. */
function donut(parts: { pct: number; color: string }[]): string {
  let at = 0;
  const stops: string[] = [];
  for (const p of parts) {
    const end = at + p.pct;
    const gap = parts.length > 1 ? Math.min(0.6, p.pct / 3) : 0;
    stops.push(`${p.color} ${at}% ${end - gap}%`, `#fff ${end - gap}% ${end}%`);
    at = end;
  }
  return `conic-gradient(${stops.join(", ")})`;
}

export function ExpenseBreakdown({ o }: { o: FinanceOverview }) {
  const r = o.report;
  const rows = o.expenses.map((e, i) => ({ ...e, color: EXPENSE_RAMP[Math.min(i, EXPENSE_RAMP.length - 1)] }));

  return (
    <section aria-labelledby="gastos" className={cn(card, "flex flex-col gap-5 lg:col-span-2")}>
      <div>
        <h2 id="gastos" className={h2}>
          En qué se va la plata
        </h2>
        <p className="mt-1 text-[13px] text-ink-600">
          {r.expensesUsd > 0
            ? `${formatUSD(r.expensesUsd)} en gastos${r.incomeUsd > 0 ? `: el ${pct((r.expensesUsd / r.incomeUsd) * 100)} de lo que vendiste` : ""}.`
            : `No registraste gastos en ${o.period.label}.`}
        </p>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-6">
          <div
            role="img"
            aria-label={`Gastos: ${rows.map((e) => `${e.category.toLowerCase()} ${pct(e.pct)}`).join(", ")}`}
            className="relative size-[132px] shrink-0 rounded-full sm:size-[150px]"
            style={{ background: donut(rows) }}
          >
            <div className="absolute inset-[20px] grid place-items-center rounded-full bg-card text-center sm:inset-[22px]">
              <div>
                <p className="font-display text-[1.35rem] font-extrabold tabular-nums">{usd0(r.expensesUsd)}</p>
                <p className="text-xs text-ink-500">en gastos</p>
              </div>
            </div>
          </div>
          <ul className="min-w-[11rem] flex-1">
            {rows.map((e) => (
              <li key={e.category} className="flex items-center gap-2.5 border-t py-2 text-[13.5px] first:border-t-0">
                <Swatch color={e.color} />
                <span className="min-w-0 flex-1 font-semibold">
                  {e.category}
                  {e.fixed && (
                    <span className="ml-1.5 inline-flex h-5 items-center rounded-md bg-[#EEF0FB] px-1.5 text-[11px] font-bold text-[#4B3BB8]">
                      fijo
                    </span>
                  )}
                </span>
                <span className="font-bold tabular-nums">{usd0(e.usd)}</span>
                <span className="w-9 text-right font-landing-mono text-xs text-ink-500">{pct(e.pct)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {o.payrollDueUsd !== null && (
        <p className="flex items-start gap-2.5 rounded-xl bg-[#F3F1FD] px-3.5 py-3 text-[13px] leading-relaxed text-[#2E2470]">
          <CalendarClock className="mt-0.5 size-[18px] shrink-0" />
          <span>
            Te falta registrar <b>{usd0(o.payrollDueUsd)}</b> de sueldos este mes, según tu nómina.
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/panel/finanzas/gastos?nuevo=1" className={buttonVariants({ variant: "outline" })}>
          <Plus /> Registrar gasto
        </Link>
        {rows.length > 0 && (
          <Link href="/panel/finanzas/gastos" className={buttonVariants({ variant: "ghost" })}>
            Ver todos
          </Link>
        )}
      </div>
    </section>
  );
}

// ── Cómo le pagan ───────────────────────────────────────────────────────────

export function PaymentMix({ o }: { o: FinanceOverview }) {
  const rows = o.methods.map((m, i) => ({ ...m, color: METHOD_RAMP[Math.min(i, METHOD_RAMP.length - 1)] }));
  const bs = o.bsSharePct;

  return (
    <section aria-labelledby="como-pagan" className={cn(card, "flex flex-col gap-4")}>
      <div>
        <h2 id="como-pagan" className={h2}>
          Cómo te pagan
        </h2>
        <p className="mt-1 text-[13px] text-ink-600">
          {rows.length === 0
            ? `Sin ventas en ${o.period.label}.`
            : bs !== null && bs >= 1
              ? `El ${pct(bs)} te llega en bolívares (Pago Móvil y transferencias).`
              : "Todo te llega en divisas."}
        </p>
      </div>
      {rows.length > 0 && (
        <>
          <div
            role="img"
            aria-label={rows.map((m) => `${m.label} ${pct(m.pct)}`).join(", ")}
            className="flex h-4 gap-[3px]"
          >
            {rows.map((m) => (
              <span key={m.type} className="rounded" style={{ flex: `0 0 calc(${m.pct}% - 3px)`, background: m.color }} />
            ))}
          </div>
          <ul>
            {rows.map((m) => (
              <li key={m.type} className="flex items-center gap-2.5 border-t py-2.5 text-[13.5px] first:border-t-0">
                <Swatch color={m.color} />
                <span className="min-w-0 flex-1 font-semibold">
                  {m.label}{" "}
                  <span className="font-normal text-ink-500">
                    · {m.count} {m.count === 1 ? "venta" : "ventas"}
                  </span>
                </span>
                <span className="font-bold tabular-nums">{formatUSD(m.usd)}</span>
                <span className="w-9 text-right font-landing-mono text-xs text-ink-500">{pct(m.pct)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ── Cobros ──────────────────────────────────────────────────────────────────

export function Collections({ o }: { o: FinanceOverview }) {
  const c = o.collect;
  const usesCards = c.payoutDueCount > 0 || c.lastPayout !== null;

  return (
    <section aria-labelledby="por-cobrar" className={cn(card, "flex flex-col gap-4")}>
      <div>
        <h2 id="por-cobrar" className={h2}>
          Lo que te falta cobrar
        </h2>
        <p className="mt-1 text-[13px] text-ink-600">Plata que ya vendiste pero todavía no tienes en la mano.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={cn("flex flex-col gap-1.5 rounded-xl p-4", c.pendingCount > 0 ? "bg-[#FFF8DB]" : "bg-surface")}>
          <p className={cn(eyebrow, c.pendingCount > 0 && "text-[#6B5300]")}>Por confirmar</p>
          <p className="font-display text-[1.75rem] font-extrabold leading-tight tabular-nums">{formatUSD(c.pendingUsd)}</p>
          <p className={cn("text-[13px]", c.pendingCount > 0 ? "text-[#6B5300]" : "text-ink-500")}>
            {c.pendingCount > 0
              ? `${c.pendingCount} ${c.pendingCount === 1 ? "pedido" : "pedidos"} con comprobante por revisar`
              : "Ningún comprobante esperando"}
          </p>
          {c.pendingCount > 0 && (
            <Link href="/panel/pedidos?status=pending_confirmation" className="text-[13px] font-semibold text-[#6B5300] underline">
              Revisar comprobantes
            </Link>
          )}
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl bg-[#E9F5FD] p-4">
          <p className={cn(eyebrow, "text-brand-800")}>Tiendify te liquida</p>
          <p className="font-display text-[1.75rem] font-extrabold leading-tight tabular-nums">{formatUSD(c.payoutDueUsd)}</p>
          <p className="text-[13px] text-brand-800">
            {c.payoutDueCount > 0
              ? `${c.payoutDueCount} ${c.payoutDueCount === 1 ? "venta" : "ventas"} con tarjeta, ya sin la comisión`
              : usesCards
                ? "Todo lo que cobraste con tarjeta ya te llegó"
                : "Cuando vendas con tarjeta, aquí verás lo que te toca"}
          </p>
        </div>
      </div>
      {c.lastPayout && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <span className="grid size-9 place-items-center rounded-[10px] bg-surface text-ink-600">
            <CreditCard className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              Último pago de Tiendify: <span className="tabular-nums">{formatUSD(c.lastPayout.amountUsd)}</span>
            </p>
            <p className="mt-0.5 text-[12.5px] text-ink-500">
              {new Date(c.lastPayout.date).toLocaleDateString("es-VE", {
                day: "numeric",
                month: "long",
                timeZone: "America/Caracas",
              })}
              {c.lastPayout.reference ? ` · ref. ${c.lastPayout.reference}` : ""}
            </p>
          </div>
          <Link href="/panel/finanzas/cobros" className="text-[13px] font-semibold text-brand-700 hover:underline">
            Ver pagos
          </Link>
        </div>
      )}
    </section>
  );
}

// ── Movimientos y nómina ────────────────────────────────────────────────────

export function Movements({ o }: { o: FinanceOverview }) {
  const reportHref = `/panel/finanzas/reportes?${new URLSearchParams({ tipo: "ventas", ...periodQuery(o.period) })}`;
  return (
    <section aria-labelledby="movimientos" className={cn(card, "lg:col-span-2")}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="movimientos" className={h2}>
          Últimos movimientos
        </h2>
        <Link href={reportHref} className="text-[13px] font-semibold text-brand-700 hover:underline">
          Ver todo en Reportes →
        </Link>
      </div>
      {o.movements.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-ink-500">
          Todavía no hay ventas ni gastos.
        </p>
      ) : (
        <ul className="mt-3">
          {o.movements.map((m) => {
            const inner = (
              <>
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full font-landing-mono text-base font-bold",
                    m.kind === "in" ? "bg-brand-100 text-brand-700" : "bg-[#ECEAFB] text-[#4B3BB8]",
                  )}
                >
                  {m.kind === "in" ? "+" : "−"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{m.title}</span>
                  <span className="mt-0.5 block text-[12.5px] text-ink-500">{m.sub}</span>
                </span>
                <span className="whitespace-nowrap font-landing-mono text-sm font-semibold tabular-nums">
                  {m.kind === "in" ? "+" : "−"}
                  {formatUSD(m.amountUsd)}
                </span>
              </>
            );
            return (
              <li key={m.id} className="border-t first:border-t-0">
                {m.href ? (
                  <Link href={m.href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-ink-25">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-2.5">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function PayrollSummary({ o }: { o: FinanceOverview }) {
  const p = o.payroll;
  return (
    <section aria-labelledby="nomina" className={cn(card, "flex flex-col gap-4")}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="nomina" className={h2}>
          Nómina
        </h2>
        <Link href="/panel/finanzas/nomina" className="text-[13px] font-semibold text-brand-700 hover:underline">
          {p.people > 0 ? "Ver nómina" : "Agregar"}
        </Link>
      </div>
      {p.people === 0 ? (
        <p className="text-[13px] leading-relaxed text-ink-600">
          Si tienes empleados, agrégalos con su sueldo: así sabes cuánto se te va al mes y te
          avisamos lo que falta pagar.
        </p>
      ) : (
        <>
          <div>
            <p className="font-display text-[2rem] font-extrabold leading-none tracking-[-0.02em] tabular-nums">
              {usd0(p.monthlyUsd)}
              <span className="text-base font-semibold text-ink-500">
                {" "}
                /mes · {p.people} {p.people === 1 ? "persona" : "personas"}
              </span>
            </p>
            {o.bcvUsd && (
              <p className="mt-1.5 font-landing-mono text-[12.5px] text-ink-500">
                ≈ {formatBs(p.monthlyUsd * o.bcvUsd)} a la tasa de hoy
              </p>
            )}
          </div>
          {p.paidUsd !== null && p.monthlyUsd > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-[12.5px] text-ink-600">
                <span>Registrado en {o.periodName}</span>
                <span className="tabular-nums">
                  <b>{usd0(p.paidUsd)}</b> de {usd0(p.monthlyUsd)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#ECEAFB]">
                <div
                  className="h-full rounded-full bg-[#6250d6]"
                  style={{ width: `${Math.min(100, (p.paidUsd / p.monthlyUsd) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
