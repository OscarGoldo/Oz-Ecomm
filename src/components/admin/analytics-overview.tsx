import Link from "next/link";
import { AlertTriangle, ArrowDown, Clock, Info, ShoppingCart, Sparkles, TrendingUp } from "lucide-react";

import {
  HEAT_DAYS,
  HEAT_SLOTS,
  type AnalyticsInsight,
  type AnalyticsOverview,
  type Quadrant,
} from "@/lib/analytics-overview";
import { formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Las piezas de la Analítica. Mismo idioma que Finanzas: cada número con su
 * color, comparación contra el período anterior y, en cada tarjeta, la frase
 * que dice qué significa.
 */

const card = "rounded-2xl border bg-card p-5 sm:p-6";
const eyebrow =
  "font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500";
const h2 = "font-display text-lg font-bold tracking-[-0.02em]";

/** Tonos ordinales del embudo: del paso más ancho al más angosto. */
const FUNNEL_RAMP = ["#86B6EF", "#5598E7", "#2A78D6", "#1C5CAB"];
/** El azul del mapa de horas, de menos a más pedidos. */
const HEAT_RAMP = [
  "bg-ink-50 text-ink-300",
  "bg-[#DCEBFA] text-[#2A4A6B]",
  "bg-[#B5D3F3] text-[#1C3A5C]",
  "bg-[#86B6EF] text-noche",
  "bg-[#5598E7] text-white",
  "bg-[#2A78D6] text-white",
  "bg-[#1C5CAB] text-white",
];

const QUADRANTS: Record<Quadrant, { label: string; hint: string; color: string; text: string; bg: string }> = {
  star: { label: "Estrellas", hint: "Muchos los miran y los compran.", color: "#1baf7a", text: "#11755A", bg: "#E8F8F1" },
  gem: { label: "Joyas escondidas", hint: "Convencen, pero casi nadie los ve.", color: "#6250d6", text: "#4B3BB8", bg: "#F3F1FD" },
  leak: { label: "Miran y no compran", hint: "Revisa precio, fotos o descripción.", color: "#eb6834", text: "#A8401A", bg: "#FFEDE3" },
  cold: { label: "Sin tracción", hint: "Pocas visitas y poco carrito.", color: "#BFCEDD", text: "#45576B", bg: "#EEF3F8" },
};

function int(n: number): string {
  return n.toLocaleString("es-VE");
}

function pct1(n: number): string {
  return `${(Math.round(n * 10) / 10).toLocaleString("es-VE", { maximumFractionDigits: 1 })}%`;
}

function Swatch({ color, round }: { color: string; round?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-2.5 shrink-0", round ? "rounded-full" : "rounded-[3px]")}
      style={{ background: color }}
    />
  );
}

function Delta({ value, unit = "%" }: { value: number | null; unit?: string }) {
  if (value === null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  const shown = unit === "%" ? Math.round(Math.abs(value)) : (Math.round(Math.abs(value) * 10) / 10).toLocaleString("es-VE");
  if (Number(shown) === 0) {
    return (
      <span className="inline-flex h-[22px] items-center rounded-full bg-ink-100 px-2 text-xs font-bold text-ink-600">
        = igual
      </span>
    );
  }
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
    <svg viewBox="0 0 120 36" preserveAspectRatio="none" role="img" aria-label={label} className="h-8 w-24 shrink-0">
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

function growth(cur: number, prev: number): number | null {
  return prev > 0 ? ((cur - prev) / prev) * 100 : null;
}

// ── Cifras de arriba ────────────────────────────────────────────────────────

export function AnalyticsKpis({ a }: { a: AnalyticsOverview }) {
  const purchasers = a.funnel[3].sessions;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Kpi
        label="Visitantes"
        color="#0284C7"
        value={int(a.visitors)}
        spark={<Spark values={a.daily.map((d) => d.visitors)} color="#0284C7" label="Visitantes por día" />}
        sub={
          <>
            <Delta value={growth(a.visitors, a.prevVisitors)} />
            antes: {int(a.prevVisitors)}
          </>
        }
      />
      <Kpi
        label="Conversión"
        color="#1baf7a"
        value={a.conversionPct === null ? "—" : pct1(a.conversionPct)}
        sub={
          a.conversionPct === null ? (
            "cuando alguien abra un producto"
          ) : (
            <>
              {a.prevConversionPct !== null && <Delta value={a.conversionPct - a.prevConversionPct} unit="pts" />}
              {int(purchasers)} de {int(a.viewers)} que vieron un producto
            </>
          )
        }
      />
      <Kpi
        label="Pedidos"
        color="#6250d6"
        value={int(a.orders)}
        spark={<Spark values={a.daily.map((d) => d.orders)} color="#6250d6" label="Pedidos por día" />}
        sub={
          <>
            <Delta value={growth(a.orders, a.prevOrders)} />
            {formatUSD(a.salesUsd)} vendidos
          </>
        }
      />
      <Kpi
        label="Carritos sin terminar"
        color="#eb6834"
        value={formatUSD(a.carts.usd)}
        sub={
          a.carts.count > 0 ? (
            <>
              {a.carts.count} {a.carts.count === 1 ? "carrito" : "carritos"} ·{" "}
              <Link href="/panel/carritos" className="font-semibold text-brand-700 hover:underline">
                Recuperar
              </Link>
            </>
          ) : (
            "ninguno en estos días"
          )
        }
      />
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
  spark?: React.ReactNode;
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

// ── Embudo ──────────────────────────────────────────────────────────────────

export function FunnelCard({ a }: { a: AnalyticsOverview }) {
  const base = Math.max(1, a.funnel[0].sessions);
  const empty = a.funnel[0].sessions === 0;
  return (
    <section aria-labelledby="embudo" className={cn(card, "flex flex-col gap-5 lg:col-span-2")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="embudo" className={h2}>
            Dónde se te va la gente
          </h2>
          <p className="mt-1 text-[13px] text-ink-600">
            Personas distintas que llegaron a cada paso. Entre paso y paso, cuántas se fueron.
          </p>
        </div>
        {a.leak && (
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#FFEDE3] px-2.5 text-xs font-bold text-[#A8401A]">
            <AlertTriangle className="size-3.5" />
            Tu mayor fuga: {a.leak.index === 2 ? "el carrito" : "el pago"}
          </span>
        )}
      </div>

      {empty ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-ink-500">
          Todavía nadie abrió un producto en estos días.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {a.funnel.map((f, i) => {
            const prev = i > 0 ? a.funnel[i - 1].sessions : null;
            const lost = prev !== null ? Math.max(0, prev - f.sessions) : 0;
            const isLeak = a.leak?.index === i;
            const share = (f.sessions / base) * 100;
            return (
              <li key={f.key}>
                {prev !== null && (
                  <p
                    className={cn(
                      "flex items-center gap-2 py-1.5 text-[12.5px] xl:pl-[216px]",
                      isLeak ? "font-semibold text-[#A8401A]" : "text-ink-500",
                    )}
                  >
                    <ArrowDown className="size-3.5" />
                    {prev > 0
                      ? `se fueron ${int(lost)} (${Math.round((lost / prev) * 100)}%)${isLeak ? " · el paso que más puedes recuperar" : ""}`
                      : "nadie llegó al paso anterior"}
                  </p>
                )}
                {/* Nombre y número arriba, barra a todo lo ancho debajo; en
                    pantallas grandes, los tres en una fila. */}
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 xl:grid-cols-[200px_minmax(0,1fr)_96px]">
                  <span className="text-sm font-semibold">{f.label}</span>
                  <span className="text-right font-display text-lg font-bold tabular-nums xl:order-last">
                    {int(f.sessions)}
                  </span>
                  <div className="col-span-2 rounded-[9px] bg-ink-50 xl:col-span-1">
                    <div
                      className="flex h-[30px] min-w-[46px] items-center rounded-[9px] px-2.5 font-landing-mono text-[12.5px] font-semibold text-white xl:h-[34px]"
                      style={{ width: `${Math.max(4, share)}%`, background: FUNNEL_RAMP[i] }}
                    >
                      {share >= 10 ? `${Math.round(share)}%` : pct1(share)}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {a.leak?.index === 2 && a.carts.count > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#FFF4EC] px-4 py-3.5">
          <ShoppingCart className="size-5 shrink-0 text-[#A8401A]" />
          <p className="min-w-[14rem] flex-1 text-[13.5px] leading-relaxed text-[#5A2A12]">
            {int(a.leak.lost)} {a.leak.lost === 1 ? "persona agregó" : "personas agregaron"} algo al carrito y no
            empezaron a pagar. De {a.carts.count} tienes el WhatsApp: <b>{formatUSD(a.carts.usd)}</b> que todavía
            puedes recuperar.
          </p>
          <Link
            href="/panel/carritos"
            className="inline-flex h-10 shrink-0 items-center rounded-[10px] bg-noche px-3.5 text-sm font-semibold text-white hover:bg-noche-suave"
          >
            Ver carritos
          </Link>
        </div>
      )}
    </section>
  );
}

// ── Avisos ──────────────────────────────────────────────────────────────────

const TONE: Record<AnalyticsInsight["tone"], { icon: typeof Info; className: string }> = {
  warn: { icon: AlertTriangle, className: "bg-[#FEF3C7] text-[#92400E]" },
  good: { icon: TrendingUp, className: "bg-[#DCF5EA] text-[#11755A]" },
  gem: { icon: Sparkles, className: "bg-[#F3F1FD] text-[#4B3BB8]" },
  info: { icon: Clock, className: "bg-brand-100 text-brand-700" },
};

export function AnalyticsInsights({ items }: { items: AnalyticsInsight[] }) {
  return (
    <section aria-labelledby="avisos-visitas" className="flex min-w-0 flex-col gap-3">
      <h2 id="avisos-visitas" className={cn(h2, "px-0.5 pt-1")}>
        Lo que dicen tus visitas
      </h2>
      {items.length === 0 && (
        <p className="rounded-2xl border border-dashed bg-card p-5 text-sm text-ink-500">
          Nada que destacar por ahora. Con más visitas aquí aparecen los productos que conviene mover y
          tu mejor hora.
        </p>
      )}
      {items.map((it) => {
        const t = TONE[it.tone];
        return (
          <div key={it.title} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px]", t.className)}>
              <t.icon className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-[14.5px] font-bold leading-snug">{it.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{it.body}</p>
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

// ── Visitantes por día ──────────────────────────────────────────────────────

function niceTop(max: number): number {
  if (max <= 0) return 3;
  const raw = max / 3;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * exp).find((s) => s >= raw) ?? 10 * exp;
  return Math.max(3, Math.ceil(step) * 3);
}

export function VisitorsChart({ a }: { a: AnalyticsOverview }) {
  const n = a.daily.length;
  const top = niceTop(Math.max(...a.daily.map((d) => Math.max(d.visitors, d.prevVisitors))));
  const x = (i: number) => (n === 1 ? 300 : (i / (n - 1)) * 600);
  const y = (v: number) => 200 - (v / top) * 200;
  const line = a.daily.map((d, i) => `${x(i).toFixed(1)},${y(d.visitors).toFixed(1)}`).join(" ");
  const prevLine = a.daily.map((d, i) => `${x(i).toFixed(1)},${y(d.prevVisitors).toFixed(1)}`).join(" ");
  const ticks = [0, Math.floor((n - 1) / 4), Math.floor((n - 1) / 2), Math.floor(((n - 1) * 3) / 4), n - 1]
    .filter((v, i, arr) => arr.indexOf(v) === i);
  const total = a.daily.reduce((s, d) => s + d.visitors, 0);

  return (
    <section aria-labelledby="visitantes-dia" className={cn(card, "flex flex-col gap-4 lg:col-span-3")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="visitantes-dia" className={h2}>
            Visitantes por día
          </h2>
          <p className="mt-1 text-[13px] text-ink-600">Lo punteado son {a.period.previousLabel}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3.5 text-[12.5px] text-ink-600">
          <span className="flex items-center gap-1.5">
            <Swatch color="#0284C7" /> Estos {a.days} días
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-[3px] border-[1.5px] border-dashed border-ink-400" />
            Los {a.days} anteriores
          </span>
        </div>
      </div>
      <div className="relative ml-8">
        <div className="absolute -left-8 bottom-7 top-0 flex w-6 flex-col justify-between text-right font-landing-mono text-[11px] text-ink-400">
          <span>{top}</span>
          <span>{Math.round((top * 2) / 3)}</span>
          <span>{Math.round(top / 3)}</span>
          <span>0</span>
        </div>
        <svg
          viewBox="0 0 600 200"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Visitantes por día: ${int(total)} en ${a.days} días.`}
          className="block h-[180px] w-full sm:h-[220px]"
        >
          {[0.5, 66.7, 133.3].map((v) => (
            <line key={v} x1="0" y1={v} x2="600" y2={v} stroke="hsl(var(--ink-100))" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1="0" y1="199.5" x2="600" y2="199.5" stroke="hsl(var(--ink-300))" vectorEffect="non-scaling-stroke" />
          {total > 0 && <path d={`M0,200 L${line.split(" ").join(" L")} L600,200 Z`} fill="rgb(2 132 199 / 0.12)" />}
          <polyline points={prevLine} fill="none" stroke="#8598AD" strokeWidth={1.6} strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
          <polyline points={line} fill="none" stroke="#0284C7" strokeWidth={2.4} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="relative mt-1.5 h-4 font-landing-mono text-[11px] text-ink-400">
          {ticks.map((i) => (
            <span
              key={i}
              className={cn(
                "absolute whitespace-nowrap",
                i === 0 ? "left-0" : i === n - 1 ? "right-0" : "-translate-x-1/2",
              )}
              style={i === 0 || i === n - 1 ? undefined : { left: `${(i / (n - 1)) * 100}%` }}
            >
              {a.daily[i].label}
            </span>
          ))}
        </div>
      </div>
      {a.bestDay && (
        <p className="text-[13px] text-ink-600">
          Tu mejor día fue el <b>{a.bestDay.label}</b>, con {int(a.bestDay.visitors)}{" "}
          {a.bestDay.visitors === 1 ? "visitante" : "visitantes"}.
        </p>
      )}
    </section>
  );
}

// ── De dónde llegan ─────────────────────────────────────────────────────────

export function SourcesCard({ a }: { a: AnalyticsOverview }) {
  const s = a.sources;
  const maxConv = Math.max(10, ...s.rows.map((r) => r.convPct ?? 0));
  return (
    <section aria-labelledby="origen" className={cn(card, "flex flex-col gap-4 lg:col-span-2")}>
      <div>
        <h2 id="origen" className={h2}>
          De dónde llegan
        </h2>
        <p className="mt-1 text-[13px] text-ink-600">Y cuántos de cada lado terminan comprando.</p>
      </div>
      {s.tracked === 0 ? (
        <div className="flex flex-col gap-2 rounded-xl bg-surface p-4 text-[13px] leading-relaxed text-ink-600">
          <p>
            Empezamos a medir de dónde llegan tus visitas. En unos días vas a ver aquí si vienen de
            Instagram, WhatsApp, Google u otro lado.
          </p>
          <p className="text-ink-500">
            Para que un enlace cuente siempre como WhatsApp, compártelo con{" "}
            <code className="rounded bg-card px-1 font-landing-mono text-[12px]">?utm_source=whatsapp</code> al
            final.
          </p>
        </div>
      ) : (
        <>
          <div
            role="img"
            aria-label={s.rows.map((r) => `${r.label} ${Math.round((r.visitors / s.tracked) * 100)}%`).join(", ")}
            className="flex h-4 gap-[3px]"
          >
            {s.rows.map((r) => (
              <span key={r.id} className="rounded" style={{ flex: `${r.visitors} 1 0`, background: r.color }} />
            ))}
          </div>
          <div>
            <div className="flex justify-end pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-500">
              <span className="w-[8.5rem] sm:w-36">Compran</span>
            </div>
            <ul>
              {s.rows.map((r) => (
                <li key={r.id} className="flex items-center gap-2.5 border-t py-2.5 text-[13.5px] first:border-t-0">
                  <Swatch color={r.color} />
                  <span className="min-w-0 flex-1 font-semibold">
                    {r.label}{" "}
                    <span className="font-normal text-ink-500">
                      · {int(r.visitors)} · {Math.round((r.visitors / s.tracked) * 100)}%
                    </span>
                  </span>
                  <span className="flex w-[8.5rem] items-center gap-2 sm:w-36">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                      <span
                        className="block h-full rounded-full bg-brand-600"
                        style={{ width: `${((r.convPct ?? 0) / maxConv) * 100}%` }}
                      />
                    </span>
                    <span className="w-11 text-right font-landing-mono text-xs font-semibold">
                      {r.convPct === null ? "—" : pct1(r.convPct)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {s.highlight && (
            <p className="rounded-xl bg-[#E8F8F1] px-3.5 py-3 text-[13px] leading-relaxed text-[#0E5A43]">{s.highlight}</p>
          )}
          {s.since && (
            <p className="text-xs text-ink-500">
              Se mide desde el {s.since}: las visitas de antes no tienen origen y no entran aquí.
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ── Cuándo le compran ───────────────────────────────────────────────────────

function heatLevel(v: number, max: number): number {
  if (v === 0) return 0;
  return Math.max(1, Math.ceil((v / max) * 6));
}

export function HourHeatmap({ a }: { a: AnalyticsOverview }) {
  const h = a.heat;
  const max = Math.max(1, ...h.cells.flat());
  return (
    <section aria-labelledby="cuando" className={cn(card, "flex flex-col gap-4 lg:col-span-3")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="cuando" className={h2}>
            Cuándo te compran
          </h2>
          <p className="mt-1 text-[13px] text-ink-600">
            Pedidos de los últimos 90 días, por día y franja. Hora de Venezuela.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ink-500" aria-hidden="true">
          menos
          {[1, 3, 5, 6].map((l) => (
            <span key={l} className={cn("size-3.5 rounded", HEAT_RAMP[l])} />
          ))}
          más
        </div>
      </div>
      {h.total === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-ink-500">
          Sin pedidos en los últimos 90 días.
        </p>
      ) : (
        <div
          role="img"
          aria-label={
            h.peak
              ? `Pedidos por día y franja. La franja con más pedidos es el ${HEAT_DAYS[h.peak.day]} a las ${HEAT_SLOTS[h.peak.slot]}, con ${h.peak.orders}.`
              : "Pedidos por día y franja."
          }
          className="grid grid-cols-[28px_repeat(8,minmax(0,1fr))] gap-[3px] sm:grid-cols-[40px_repeat(8,minmax(0,1fr))] sm:gap-1"
        >
          <span />
          {HEAT_SLOTS.map((s) => (
            <span key={s} className="pb-1 text-center font-landing-mono text-[10px] text-ink-500 sm:text-[11px]">
              {s}
            </span>
          ))}
          {h.cells.map((row, d) => (
            <div key={HEAT_DAYS[d]} className="contents">
              <span className="flex items-center text-[11.5px] font-semibold text-ink-600 sm:text-[12.5px]">
                {HEAT_DAYS[d]}
              </span>
              {row.map((v, s) => {
                const isPeak = h.peak?.day === d && h.peak.slot === s;
                return (
                  <span
                    key={s}
                    className={cn(
                      "grid h-8 place-items-center rounded-md font-landing-mono text-[11px] font-semibold sm:h-[38px] sm:text-xs",
                      HEAT_RAMP[heatLevel(v, max)],
                      isPeak && "ring-2 ring-sol ring-offset-2 ring-offset-noche",
                    )}
                  >
                    {v > 0 ? v : ""}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Clientes ────────────────────────────────────────────────────────────────

export function CustomersCard({ a }: { a: AnalyticsOverview }) {
  const c = a.customers;
  const newOnes = c.total - c.returning;
  return (
    <section aria-labelledby="vuelven" className={cn(card, "flex flex-col gap-4 lg:col-span-2")}>
      <div>
        <h2 id="vuelven" className={h2}>
          Quién vuelve a comprarte
        </h2>
        <p className="mt-1 text-[13px] text-ink-600">
          {c.total > 0
            ? `${int(c.total)} ${c.total === 1 ? "cliente compró" : "clientes compraron"} en estos ${a.days} días.`
            : "Nadie compró en estos días."}
        </p>
      </div>
      {c.total > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
                {Math.round((c.returning / c.total) * 100)}%
              </p>
              <p className="mt-1 text-[13px] text-ink-500">
                volvieron ({c.returning} de {c.total})
              </p>
            </div>
            {c.returningUsdPct !== null && (
              <div>
                <p className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[#4B3BB8]">
                  {Math.round(c.returningUsdPct)}%
                </p>
                <p className="mt-1 text-[13px] text-ink-500">de lo vendido vino de ellos</p>
              </div>
            )}
          </div>
          <div>
            <div
              role="img"
              aria-label={`Clientes: ${newOnes} nuevos y ${c.returning} que volvieron`}
              className="flex h-3.5 gap-[3px]"
            >
              {newOnes > 0 && <span className="rounded" style={{ flex: `${newOnes} 1 0`, background: "#86B6EF" }} />}
              {c.returning > 0 && <span className="rounded" style={{ flex: `${c.returning} 1 0`, background: "#6250d6" }} />}
            </div>
            <div className="mt-2 flex gap-4 text-[12.5px] text-ink-600">
              <span className="flex items-center gap-1.5">
                <Swatch color="#86B6EF" /> Nuevos · {newOnes}
              </span>
              <span className="flex items-center gap-1.5">
                <Swatch color="#6250d6" /> Volvieron · {c.returning}
              </span>
            </div>
          </div>
          <div>
            <p className={eyebrow}>Tus mejores clientes</p>
            <ul className="mt-1">
              {c.top.map((t, i) => (
                <li key={`${t.name}-${i}`} className="flex items-center gap-2.5 border-t py-2.5 text-[13.5px] first:border-t-0">
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {t.name}{" "}
                    <span className="font-normal text-ink-500">
                      · {t.orders} {t.orders === 1 ? "pedido" : "pedidos"}
                    </span>
                  </span>
                  <span className="font-bold tabular-nums">{formatUSD(t.usd)}</span>
                </li>
              ))}
            </ul>
          </div>
          <Link href="/panel/clientes" className="text-[13px] font-semibold text-brand-700 hover:underline">
            Ver clientes →
          </Link>
        </>
      )}
    </section>
  );
}

// ── Productos ───────────────────────────────────────────────────────────────

export function ProductMatrix({ a }: { a: AnalyticsOverview }) {
  const p = a.products;
  const rows = p.rows;
  const enough = rows.length >= 3;
  const maxViews = Math.max(10, ...rows.map((r) => r.views));
  const xTop = Math.ceil(maxViews / 10) * 10;
  const yTop = Math.max(20, Math.ceil(Math.max(...rows.map((r) => r.ratePct), p.avgRatePct) / 5) * 5 + 5);
  const labeled = new Set([...rows].sort((x, y) => y.views - x.views).slice(0, 6).map((r) => r.productId));

  return (
    <section aria-labelledby="atraen" className={cn(card, "flex flex-col gap-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="atraen" className={h2}>
            Qué productos atraen y cuáles convencen
          </h2>
          <p className="mt-1 text-[13px] text-ink-600">
            Cada punto es un producto: a la derecha, más visitas; arriba, más gente que lo agrega al carrito.
          </p>
        </div>
        {enough && (
          <div className="hidden flex-wrap items-center gap-3.5 text-[12.5px] text-ink-600 md:flex">
            {(["star", "gem", "leak", "cold"] as Quadrant[]).map((q) => (
              <span key={q} className="flex items-center gap-1.5">
                <Swatch color={QUADRANTS[q].color} round /> {QUADRANTS[q].label}
              </span>
            ))}
          </div>
        )}
      </div>

      {!enough ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-ink-500">
          Cuando al menos tres productos tengan visitas, aquí vas a ver cuáles atraen y cuáles convencen.
        </p>
      ) : (
        <>
          {/* Escritorio: el mapa de puntos y la tabla. */}
          <div className="hidden flex-wrap items-start gap-7 md:flex">
            <div className="min-w-0 flex-[3_1_480px]">
              <div
                role="img"
                aria-label="Productos según sus visitas y el porcentaje que los agrega al carrito"
                className="relative mb-7 ml-10 mt-2 h-[320px] border-b border-l border-ink-300"
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 border-l-[1.5px] border-dashed border-ink-300"
                  style={{ left: `${(p.medianViews / xTop) * 100}%` }}
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 border-t-[1.5px] border-dashed border-ink-300"
                  style={{ bottom: `${(p.avgRatePct / yTop) * 100}%` }}
                />
                {(
                  [
                    ["star", "right-2 top-2"],
                    ["gem", "left-2 top-2"],
                    ["leak", "bottom-2 right-2"],
                    ["cold", "bottom-2 left-2"],
                  ] as [Quadrant, string][]
                ).map(([q, pos]) => (
                  <span
                    key={q}
                    className={cn("absolute rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-[0.03em]", pos)}
                    style={{ background: QUADRANTS[q].bg, color: QUADRANTS[q].text }}
                  >
                    {QUADRANTS[q].label}
                  </span>
                ))}
                {rows.map((r) => {
                  const x = (r.views / xTop) * 100;
                  const y = (r.ratePct / yTop) * 100;
                  const size = 14 + (r.views / maxViews) * 12;
                  return (
                    <div key={r.productId}>
                      <span
                        title={`${r.name}: ${int(r.views)} visitas, ${Math.round(r.ratePct)}% al carrito`}
                        className="absolute -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow-sm"
                        style={{ left: `${x}%`, bottom: `${y}%`, width: size, height: size, background: QUADRANTS[r.quadrant].color }}
                      />
                      {labeled.has(r.productId) && (
                        <span
                          className="absolute max-w-[11rem] translate-y-1/2 truncate rounded bg-white/85 px-1 text-xs font-semibold"
                          style={
                            x > 65
                              ? { right: `calc(${100 - x}% + ${size / 2 + 6}px)`, bottom: `${y}%` }
                              : { left: `calc(${x}% + ${size / 2 + 6}px)`, bottom: `${y}%` }
                          }
                        >
                          {r.name}
                        </span>
                      )}
                    </div>
                  );
                })}
                <span className="absolute -left-10 -top-1.5 w-8 text-right font-landing-mono text-[11px] text-ink-400">
                  {yTop}%
                </span>
                <span className="absolute -bottom-1.5 -left-10 w-8 text-right font-landing-mono text-[11px] text-ink-400">
                  0%
                </span>
                <span className="absolute -bottom-6 left-0 font-landing-mono text-[11px] text-ink-400">0 visitas</span>
                <span className="absolute -bottom-6 right-0 font-landing-mono text-[11px] text-ink-400">{xTop}</span>
              </div>
              <p className="ml-10 font-landing-mono text-[11px] text-ink-500">
                Las líneas punteadas son tu promedio: {Math.round(p.avgRatePct)}% al carrito y{" "}
                {Math.round(p.medianViews)} visitas.
              </p>
            </div>
            <div className="min-w-0 flex-[2_1_320px]">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                    <th className="pb-2 font-semibold">Producto</th>
                    <th className="pb-2 text-right font-semibold">Visitas</th>
                    <th className="pb-2 text-right font-semibold">Al carrito</th>
                    <th className="pb-2 pl-3 text-right font-semibold">Qué es</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.productId} className="border-t">
                      <td className="max-w-[11rem] py-2.5">
                        <Link href={`/panel/productos/${r.productId}`} className="block truncate font-semibold hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="py-2.5 text-right font-landing-mono">{int(r.views)}</td>
                      <td className="py-2.5 text-right font-landing-mono">{Math.round(r.ratePct)}%</td>
                      <td className="py-2.5 pl-3 text-right">
                        <span
                          className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold"
                          style={{ color: QUADRANTS[r.quadrant].text }}
                        >
                          <Swatch color={QUADRANTS[r.quadrant].color} round />
                          {QUADRANTS[r.quadrant].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Teléfono: los cuatro grupos en cajas. */}
          <div className="grid grid-cols-2 gap-2.5 md:hidden">
            {(["star", "gem", "leak", "cold"] as Quadrant[]).map((q) => {
              const items = rows.filter((r) => r.quadrant === q);
              return (
                <div key={q} className="flex flex-col gap-1.5 rounded-xl p-3" style={{ background: QUADRANTS[q].bg }}>
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.04em]" style={{ color: QUADRANTS[q].text }}>
                    {QUADRANTS[q].label}
                  </p>
                  <p className="text-xs leading-snug" style={{ color: QUADRANTS[q].text }}>
                    {QUADRANTS[q].hint}
                  </p>
                  {items.length === 0 ? (
                    <p className="border-t border-noche/[0.08] pt-1.5 text-xs text-ink-500">Ninguno</p>
                  ) : (
                    items.map((r) => (
                      <Link
                        key={r.productId}
                        href={`/panel/productos/${r.productId}`}
                        className="flex justify-between gap-1.5 border-t border-noche/[0.08] pt-1.5 text-[12.5px] font-semibold"
                      >
                        <span className="min-w-0 truncate">{r.name}</span>
                        <span className="font-landing-mono font-medium text-ink-600">{Math.round(r.ratePct)}%</span>
                      </Link>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
