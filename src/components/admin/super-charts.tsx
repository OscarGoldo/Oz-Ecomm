import { formatUSD } from "@/lib/format";

/**
 * Los gráficos de Inicio del super admin. SVG dibujado en el servidor, sin
 * librería: son pocos, simples, y así la página no carga JS para mostrarlos.
 * Cada marca lleva un <title> con su valor, que el navegador muestra al pasar
 * el mouse.
 *
 * La paleta salió validada para daltonismo y contraste (orden fijo, nunca
 * reciclado): azul Tiendify, naranja, aqua, violeta. El aqua no llega a 3:1
 * sobre blanco, por eso todo gráfico que lo usa lleva leyenda con los números.
 */
export const SERIES = {
  blue: "#0284C7",
  orange: "#eb6834",
  aqua: "#1baf7a",
  violet: "#6250d6",
  magenta: "#e87ba4",
  /** Lo que no es protagonista (Gratis, el resto). */
  neutral: "#BFCEDD",
} as const;

/** Rampa de un solo tono para pasos ordenados (el embudo), de claro a oscuro. */
export const ORDINAL = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab"] as const;

const GRID = "#EAF0F6";
const AXIS = "#D7E1EB";
const MUTED = "#5C6D82";
const INK = "#0B1B2B";
const MONO = "IBM Plex Mono, ui-monospace, monospace";

/** Un tope redondo para el eje (1, 2 o 5 por una potencia de 10). */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/* --- Mini línea para los números ------------------------------------------- */

export function Sparkline({
  values,
  color,
  label,
}: {
  values: number[];
  color: string;
  label: string;
}) {
  if (values.length < 2) return null;
  const w = 96;
  const h = 32;
  const pad = 4;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pts = values.map((v, i) => [
    r1(pad + (i * (w - pad * 2)) / (values.length - 1)),
    r1(h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)),
  ]);
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={label} className="shrink-0">
      <path
        d={pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} stroke="#FFFFFF" strokeWidth={2} />
    </svg>
  );
}

/* --- MRR, 12 meses ----------------------------------------------------------- */

export function MrrChart({ points }: { points: { key: string; label: string; mrr: number }[] }) {
  const W = 680;
  const x0 = 56;
  const x1 = 664;
  const top = 16;
  const base = 204;
  const max = niceMax(Math.max(1, ...points.map((p) => p.mrr)) * 1.1);
  const ticks = [0, max / 2, max];
  const y = (v: number) => r1(base - (v / max) * (base - top));
  const x = (i: number) => r1(x0 + (i * (x1 - x0)) / Math.max(1, points.length - 1));
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.mrr)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${base} L${x(0)},${base} Z`;
  const last = points[points.length - 1];
  const first = points[0];

  return (
    <svg
      viewBox={`0 0 ${W} 236`}
      role="img"
      aria-label={`MRR de los últimos 12 meses: de ${formatUSD(first.mrr)} en ${first.label} a ${formatUSD(last.mrr)} hoy.`}
      className="block h-auto w-full min-w-[540px]"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x0 - 8} x2={x1} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} />
          <text x={x0 - 14} y={y(t) + 4} textAnchor="end" fontFamily={MONO} fontSize={11} fill={MUTED}>
            ${Math.round(t)}
          </text>
        </g>
      ))}
      <path d={area} fill={SERIES.blue} fillOpacity={0.1} />
      <path d={line} fill="none" stroke={SERIES.blue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={p.key}>
          <circle cx={x(i)} cy={y(p.mrr)} r={11} fill="transparent">
            <title>{`${p.label}: ${formatUSD(p.mrr)}`}</title>
          </circle>
          <text x={x(i)} y={226} textAnchor="middle" fontFamily={MONO} fontSize={11} fill={i === points.length - 1 ? INK : MUTED}>
            {p.label}
          </text>
        </g>
      ))}
      <circle cx={x(points.length - 1)} cy={y(last.mrr)} r={5} fill={SERIES.blue} stroke="#FFFFFF" strokeWidth={2} />
      <text
        x={x(points.length - 1) - 10}
        y={y(last.mrr) - 12}
        textAnchor="end"
        fontFamily={MONO}
        fontSize={12}
        fontWeight={600}
        fill={INK}
      >
        {formatUSD(last.mrr)}
      </text>
    </svg>
  );
}

/* --- Tiendas nuevas por semana, por origen --------------------------------- */

export interface SignupWeek {
  key: string;
  label: string;
  organic: number;
  promo: number;
  referral: number;
}

export function SignupsChart({ weeks }: { weeks: SignupWeek[] }) {
  const x0 = 44;
  const x1 = 668;
  const top = 12;
  const base = 192;
  const slot = (x1 - x0) / Math.max(1, weeks.length);
  const bar = Math.min(30, slot * 0.6);
  const totals = weeks.map((w) => w.organic + w.promo + w.referral);
  const max = niceMax(Math.max(1, ...totals));
  const h = (v: number) => (v / max) * (base - top);
  const series: { k: keyof Omit<SignupWeek, "key" | "label">; color: string; name: string }[] = [
    { k: "organic", color: SERIES.blue, name: "llegaron solas" },
    { k: "promo", color: SERIES.orange, name: "con código" },
    { k: "referral", color: SERIES.aqua, name: "referidas" },
  ];
  const labelEvery = weeks.length > 8 ? 3 : 1;

  return (
    <svg
      viewBox="0 0 680 216"
      role="img"
      aria-label={`Tiendas nuevas por semana en las últimas ${weeks.length} semanas: ${totals.reduce((a, b) => a + b, 0)} en total.`}
      className="block h-auto w-full min-w-[540px]"
    >
      {[0, max / 2, max].map((t) => (
        <g key={t}>
          <line x1={x0 - 8} x2={x1} y1={r1(base - h(t))} y2={r1(base - h(t))} stroke={t === 0 ? AXIS : GRID} />
          <text x={x0 - 14} y={r1(base - h(t)) + 4} textAnchor="end" fontFamily={MONO} fontSize={11} fill={MUTED}>
            {Math.round(t)}
          </text>
        </g>
      ))}
      {weeks.map((w, i) => {
        let cursor = base;
        const cx = x0 + i * slot + (slot - bar) / 2;
        return (
          <g key={w.key}>
            {series.map((s) => {
              const v = w[s.k];
              if (!v) return null;
              const hh = h(v);
              cursor -= hh;
              return (
                <rect
                  key={s.k}
                  x={r1(cx)}
                  y={r1(cursor + 1)}
                  width={r1(bar)}
                  height={r1(Math.max(1, hh - 2))}
                  rx={3}
                  fill={s.color}
                >
                  <title>{`Semana del ${w.label}: ${v} ${s.name}`}</title>
                </rect>
              );
            })}
            {(i % labelEvery === 0 || i === weeks.length - 1) && (
              <text x={r1(cx + bar / 2)} y={210} textAnchor="middle" fontFamily={MONO} fontSize={11} fill={MUTED}>
                {w.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* --- Tiendas por plan --------------------------------------------------------- */

export function PlanDonut({ paying, comped, free }: { paying: number; comped: number; free: number }) {
  const total = paying + comped + free;
  const R = 62;
  const C = 2 * Math.PI * R;
  const parts = [
    { label: "Pagando", value: paying, color: SERIES.blue },
    { label: "Cortesía", value: comped, color: SERIES.orange },
    { label: "Gratis", value: free, color: SERIES.neutral },
  ];
  let acc = 0;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-5">
      <svg
        viewBox="0 0 160 160"
        width={150}
        height={150}
        role="img"
        aria-label={`${total} tiendas: ${paying} pagando, ${comped} con cortesía y ${free} en Gratis.`}
        className="shrink-0"
      >
        <circle cx={80} cy={80} r={R} fill="none" stroke="#F3F7FB" strokeWidth={22} />
        {total > 0 &&
          parts.map((p) => {
            const len = (p.value / total) * C;
            const offset = acc;
            acc += len;
            if (!p.value) return null;
            return (
              <circle
                key={p.label}
                cx={80}
                cy={80}
                r={R}
                fill="none"
                stroke={p.color}
                strokeWidth={22}
                strokeDasharray={`${Math.max(0.5, len - 2).toFixed(2)} ${C.toFixed(2)}`}
                strokeDashoffset={(-offset).toFixed(2)}
                transform="rotate(-90 80 80)"
              >
                <title>{`${p.label}: ${p.value}`}</title>
              </circle>
            );
          })}
        <text x={80} y={80} textAnchor="middle" fontFamily="var(--font-landing-display), sans-serif" fontSize={30} fontWeight={700} fill={INK}>
          {total}
        </text>
        <text x={80} y={100} textAnchor="middle" fontSize={12} fill="#45576B">
          tiendas
        </text>
      </svg>
      <ul className="flex min-w-[150px] flex-1 flex-col gap-3">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2.5">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} />
            <span className="flex-1 font-semibold">{p.label}</span>
            <span className="font-landing-mono text-[13px] tabular-nums">{p.value}</span>
            <span className="w-12 text-right font-landing-mono text-[13px] tabular-nums text-ink-600">
              {total ? `${((p.value / total) * 100).toFixed(1).replace(".", ",")}%` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --- Embudo ------------------------------------------------------------------- */

export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const first = steps[0]?.value || 1;
  return (
    <ol className="mt-4 flex flex-col gap-3.5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const pct = (s.value / first) * 100;
        return (
          <li key={s.label}>
            <div className="flex justify-between gap-2 text-[13.5px]">
              <span className="font-semibold">{s.label}</span>
              <span>
                <span className="font-landing-mono font-semibold tabular-nums">{s.value}</span>
                {i > 0 && (
                  <span className="ml-1.5 font-landing-mono text-ink-600 tabular-nums">{Math.round(pct)}%</span>
                )}
              </span>
            </div>
            <div className="mt-1.5 h-3.5 rounded bg-surface">
              <div
                className="h-3.5 rounded"
                style={{ width: `${Math.max(1, pct)}%`, background: ORDINAL[Math.min(i, ORDINAL.length - 1)] }}
                title={`${s.label}: ${s.value}`}
              />
            </div>
            {prev !== null && prev > 0 && (
              <p className="mt-1 text-xs text-ink-600">
                {prev - s.value} se quedaron en el paso anterior · pasa el {Math.round((s.value / prev) * 100)}%
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* --- Reparto (una barra al 100%) y barras por método -------------------------- */

const SHARE_COLORS = [SERIES.blue, SERIES.orange, SERIES.aqua, SERIES.violet, SERIES.magenta];

export function ShareBar({ items }: { items: { label: string; usd: number }[] }) {
  const total = items.reduce((s, i) => s + i.usd, 0);
  if (total <= 0) return <p className="mt-4 text-sm text-ink-600">Nada cobrado en el período.</p>;
  // Más de cinco métodos se agrupan en "Otros": nunca un sexto color.
  const shown = items.length > 5 ? [...items.slice(0, 4), { label: "Otros", usd: items.slice(4).reduce((s, i) => s + i.usd, 0) }] : items;
  return (
    <>
      <div
        className="mt-4 flex h-7 gap-0.5 overflow-hidden rounded-md"
        role="img"
        aria-label={shown.map((i) => `${i.label} ${Math.round((i.usd / total) * 100)}%`).join(", ")}
      >
        {shown.map((i, k) => (
          <span
            key={i.label}
            title={`${i.label}: ${formatUSD(i.usd)}`}
            style={{ width: `${(i.usd / total) * 100}%`, background: SHARE_COLORS[k] }}
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
        {shown.map((i, k) => (
          <li key={i.label} className="flex items-center gap-2.5">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: SHARE_COLORS[k] }} />
            <span className="min-w-0 flex-1 truncate font-semibold">{i.label}</span>
            <span className="font-landing-mono text-[13px] tabular-nums">{formatUSD(i.usd)}</span>
            <span className="w-10 text-right font-landing-mono text-[13px] tabular-nums text-ink-600">
              {Math.round((i.usd / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function MethodBars({ items }: { items: { label: string; usd: number; count: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.usd));
  if (items.length === 0) return <p className="mt-4 text-sm text-ink-600">Sin ventas en el período.</p>;
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {items.slice(0, 6).map((i) => (
        <li key={i.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_6rem] items-center gap-2.5">
          <span className="truncate text-[13.5px] font-semibold">{i.label}</span>
          <span className="h-3 rounded bg-surface">
            <span
              className="block h-3 rounded"
              style={{ width: `${Math.max(1, (i.usd / max) * 100)}%`, background: SERIES.blue }}
              title={`${i.label}: ${formatUSD(i.usd)} en ${i.count} ${i.count === 1 ? "venta" : "ventas"}`}
            />
          </span>
          <span className="text-right font-landing-mono text-[13px] tabular-nums">{formatUSD(i.usd)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Contenedor de los gráficos anchos (MRR, tiendas por semana). En el teléfono
 * se desplazan de costado en vez de achicarse hasta que las letras del eje no
 * se lean. El contenedor va en rtl para que arranque mostrando la punta
 * derecha, que es lo más reciente; el gráfico adentro sigue en ltr.
 */
export function ChartScroll({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="-mx-5 mt-3 overflow-x-auto px-5 pb-1">
      <div dir="ltr" className="w-max min-w-full">
        {children}
      </div>
    </div>
  );
}
