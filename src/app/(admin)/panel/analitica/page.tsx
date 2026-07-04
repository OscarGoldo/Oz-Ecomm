import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Clock,
  Eye,
  MousePointerClick,
  ShoppingCart,
  Users,
} from "lucide-react";

import { requireStoreUser } from "@/lib/auth";
import { getStoreAnalytics } from "@/lib/analytics";
import { formatUSD } from "@/lib/format";

export const metadata: Metadata = { title: "Analítica" };

const RANGES = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
];

function fmtHour(h: number): string {
  const period = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${period}`;
}

export default async function AnaliticaPage({
  searchParams,
}: {
  searchParams: { dias?: string };
}) {
  const { store } = await requireStoreUser();
  const days = RANGES.some((r) => String(r.days) === searchParams.dias)
    ? Number(searchParams.dias)
    : 30;

  const a = await getStoreAnalytics(store.id, days);

  const maxDayUsd = Math.max(1, ...a.byDay.map((d) => d.usd));
  const maxHourOrders = Math.max(1, ...a.byHour.map((h) => h.orders));
  const funnelBase = Math.max(1, a.funnel[0]?.sessions ?? 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analítica</h1>
          <p className="text-sm text-muted-foreground">
            Cómo se comporta tu tienda: visitas, conversión y a qué hora te compran.
          </p>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border text-sm">
          {RANGES.map((r) => {
            const active = r.days === days;
            return (
              <Link
                key={r.days}
                href={`/panel/analitica?dias=${r.days}`}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {r.label}
              </Link>
            );
          })}
        </div>
      </div>

      {!a.hasEvents && (
        <p className="rounded-lg bg-primary/10 p-3 text-xs text-foreground">
          📊 La medición de visitas y conversión empezó a registrarse ahora.
          A medida que entren visitas a tu tienda, aquí vas a ver los productos
          más vistos, el embudo de compra y tu tasa de conversión. Las ventas por
          día y hora ya reflejan tus pedidos reales.
        </p>
      )}

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={<Users className="size-4" />}
          label="Visitantes"
          value={String(a.visitors)}
          sub={`${a.productViews} vistas de productos`}
        />
        <Stat
          icon={<Activity className="size-4" />}
          label="Tasa de conversión"
          value={`${a.conversionPct.toFixed(1)}%`}
          sub="visitantes que compraron"
          highlight
        />
        <Stat
          icon={<ShoppingCart className="size-4" />}
          label="Pedidos"
          value={String(a.ordersCount)}
          sub={`en ${days} días`}
        />
        <Stat
          icon={<BarChart3 className="size-4" />}
          label="Ventas"
          value={formatUSD(a.salesUsd)}
          sub={a.peakHour !== null ? `pico ${fmtHour(a.peakHour)}` : undefined}
        />
      </div>

      {/* Funnel */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-1 text-sm font-semibold">Embudo de compra</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Cuántos visitantes distintos llegaron a cada paso (últimos {days} días).
        </p>
        {a.funnel[0].sessions === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay visitas registradas en este período.
          </p>
        ) : (
          <ul className="space-y-3">
            {a.funnel.map((s) => {
              const width = Math.max(3, (s.sessions / funnelBase) * 100);
              return (
                <li key={s.key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{s.label}</span>
                    <span className="text-muted-foreground">
                      {s.sessions}
                      {s.fromPrevPct !== null && (
                        <span className="ml-2 text-xs">
                          {Math.round(s.fromPrevPct)}% del paso anterior
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Sales by day */}
      <section className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Ventas por día</h2>
        </div>
        {a.salesUsd === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ventas en este período.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex min-w-full items-end gap-1" style={{ height: 140 }}>
              {a.byDay.map((d) => (
                <div
                  key={d.ymd}
                  className="group flex min-w-[8px] flex-1 flex-col items-center justify-end"
                  title={`${d.label}: ${formatUSD(d.usd)} · ${d.orders} pedido(s)`}
                >
                  <div
                    className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
                    style={{ height: `${(d.usd / maxDayUsd) * 120 + (d.usd > 0 ? 2 : 0)}px` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>{a.byDay[0]?.label}</span>
              <span>{a.byDay[a.byDay.length - 1]?.label}</span>
            </div>
          </div>
        )}
      </section>

      {/* Sales by hour */}
      <section className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">¿A qué hora te compran?</h2>
        </div>
        {a.ordersCount === 0 ? (
          <p className="text-sm text-muted-foreground">Sin pedidos en este período.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex min-w-full items-end gap-[3px]" style={{ height: 110 }}>
              {a.byHour.map((h) => (
                <div
                  key={h.hour}
                  className="flex flex-1 flex-col items-center justify-end"
                  title={`${fmtHour(h.hour)}: ${h.orders} pedido(s) · ${formatUSD(h.usd)}`}
                >
                  <div
                    className={`w-full rounded-t ${
                      h.hour === a.peakHour ? "bg-primary" : "bg-primary/40"
                    }`}
                    style={{ height: `${(h.orders / maxHourOrders) * 90 + (h.orders > 0 ? 2 : 0)}px` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>12am</span>
              <span>6am</span>
              <span>12pm</span>
              <span>6pm</span>
              <span>11pm</span>
            </div>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Hora de Venezuela. La barra resaltada es tu hora pico de pedidos.
        </p>
      </section>

      {/* Most viewed products */}
      <section className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Eye className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Productos más vistos</h2>
        </div>
        {a.topViewed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay vistas de productos registradas.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {a.topViewed.map((p) => {
              const toCartPct = p.views > 0 ? Math.round((p.addToCarts / p.views) * 100) : 0;
              return (
                <li key={p.productId} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground">
                    <Eye className="size-3.5" /> {p.views}
                  </span>
                  <span
                    className="inline-flex w-24 shrink-0 items-center justify-end gap-1 text-xs text-muted-foreground"
                    title="Vistas que terminaron agregando el producto al carrito"
                  >
                    <MousePointerClick className="size-3.5" /> {p.addToCarts} · {toCartPct}%
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          La última columna es cuántas de esas vistas agregaron el producto al carrito.
        </p>
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-card p-4 ${highlight ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-bold tracking-tight">{value}</p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
