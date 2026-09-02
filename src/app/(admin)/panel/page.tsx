import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Bitcoin,
  Building2,
  ClipboardList,
  CreditCard,
  DollarSign,
  ExternalLink,
  Landmark,
  ShoppingBag,
  Smartphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { DashboardMetrics } from "@/lib/metrics";
import { StatCard } from "@/components/admin/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ExchangeRateCard } from "@/components/admin/exchange-rate-card";
import { OrderStatusBadge } from "@/components/admin/status-badge";
import {
  WelcomeChecklist,
  type ChecklistStep,
} from "@/components/admin/welcome-checklist";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDashboardMetrics } from "@/lib/metrics";
import { formatBs, formatUSD } from "@/lib/format";

export const metadata: Metadata = { title: "Resumen" };

export default async function DashboardPage() {
  const { user, store } = await requireStoreUser();
  const firstName = user.full_name.split(" ")[0] ?? user.full_name;
  const m = await getDashboardMetrics(store.id);

  // Setup checklist for new stores.
  const supabase = createClient();
  const [{ count: productCount }, { count: paymentCount }] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
    supabase
      .from("payment_methods")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
  ]);
  const steps: ChecklistStep[] = [
    { label: "Sube el logo de tu tienda", done: Boolean(store.logo_url), href: "/panel/configuracion" },
    { label: "Carga tu primer producto", done: (productCount ?? 0) > 0, href: "/panel/productos/nuevo" },
    { label: "Configura un método de pago", done: (paymentCount ?? 0) > 0, href: "/panel/configuracion/pagos" },
    { label: "Define la tasa del día (Bs)", done: store.exchange_rate != null, href: "/panel/configuracion" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-display-xs font-semibold">
            Hola, {firstName}
          </h1>
          <p className="mt-1 text-sm text-ink-500">Resumen de {store.name}</p>
        </div>
        <Link
          href={`/${store.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
          )}
        >
          Ver tienda <ExternalLink />
        </Link>
      </div>

      <WelcomeChecklist steps={steps} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<ShoppingBag className="size-4" />}
          label="Pedidos de hoy"
          value={String(m.todayOrders)}
          delta={m.todayOrdersDelta}
        />
        <StatCard
          icon={<ClipboardList className="size-4" />}
          label="Por confirmar"
          value={String(m.pendingConfirmation)}
          highlight={m.pendingConfirmation > 0}
          href="/panel/pedidos?status=pending_confirmation"
          hint={
            m.pendingConfirmation > 0 ? "Revisar comprobantes" : "Nada pendiente"
          }
        />
        <StatCard
          icon={<DollarSign className="size-4" />}
          label="Ventas del mes"
          value={formatUSD(m.monthSalesUsd)}
          sub={store.show_bs_prices && m.monthSalesBs ? formatBs(m.monthSalesBs) : undefined}
          delta={m.monthSalesDelta}
        />
        <StatCard
          icon={<AlertTriangle className="size-4" />}
          label="Bajo stock"
          value={String(m.lowStock.length)}
          highlight={m.lowStock.length > 0}
          href="/panel/productos"
          hint={m.lowStock.length > 0 ? "Reponer inventario" : "Todo con stock"}
        />
      </div>

      {/* Sales trend + orders by weekday: solo si ya hubo alguna venta este
          mes, para no mostrarle al dueño un gráfico vacío el día 1. */}
      {m.monthOrders > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:col-span-2">
            <p className="text-sm font-semibold">Ventas este mes</p>
            <p className="mt-1 font-display text-[1.75rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">
              {formatUSD(m.monthSalesUsd)}
            </p>
            <SalesTrendChart data={m.salesByDay} />
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold">Pedidos por día</p>
            <WeekdayBarChart data={m.ordersByWeekday} />
          </div>
        </div>
      )}

      {(m.deliveryRatePct !== null || m.salesByMethod.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {m.deliveryRatePct !== null && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-sm font-semibold">Tasa de entrega</p>
              <DeliveryGauge pct={m.deliveryRatePct} />
            </div>
          )}
          {m.salesByMethod.length > 0 && (
            <div
              className={`rounded-2xl border border-border bg-card p-4 shadow-sm ${
                m.deliveryRatePct !== null ? "lg:col-span-2" : "lg:col-span-3"
              }`}
            >
              <p className="mb-3 text-sm font-semibold">Métodos de pago</p>
              <PaymentMethodBreakdown data={m.salesByMethod} />
            </div>
          )}
        </div>
      )}

      <ExchangeRateCard
        rate={store.exchange_rate}
        updatedAt={store.exchange_rate_updated_at}
        auto={store.auto_exchange_rate}
        showBs={store.show_bs_prices}
      />

      {/* Últimos pedidos + bajo stock, lado a lado en escritorio: son las dos
          listas cortas del resumen y apiladas dejaban la página con scroll
          de más para nada. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Últimos pedidos</h2>
            <Link
              href="/panel/pedidos"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
            >
              Ver todos <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {m.recentOrders.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Todavía no hay pedidos.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {m.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/panel/pedidos/${o.id}`}
                    className="flex items-center gap-3 p-4 transition-colors hover:bg-ink-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">#{o.order_number}</span>
                        <OrderStatusBadge status={o.status} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {o.customer_name} ·{" "}
                        {format(new Date(o.created_at), "d MMM, HH:mm", { locale: es })}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums">{formatUSD(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Low stock */}
        {m.lowStock.length > 0 && (
          <section className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-warning" />
                <h2 className="text-sm font-semibold">Productos con bajo stock</h2>
              </div>
              <Link
                href="/panel/productos"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
              >
                Ver todos <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <ul className="divide-y divide-border">
              {m.lowStock.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/panel/productos/${p.id}`}
                    className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-ink-50"
                  >
                    <span className="truncate text-sm font-medium">{p.name}</span>
                    <span
                      className={
                        p.stock <= 0
                          ? "shrink-0 text-sm font-semibold text-destructive"
                          : "shrink-0 text-sm font-semibold text-warning-text"
                      }
                    >
                      {p.stock <= 0 ? "Agotado" : `Quedan ${p.stock}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

/** Línea + área suave con las ventas de cada día del mes en curso. */
function SalesTrendChart({ data }: { data: DashboardMetrics["salesByDay"] }) {
  const width = 600;
  const height = 140;
  const max = Math.max(1, ...data.map((d) => d.usd));
  const n = data.length;
  const stepX = n > 1 ? width / (n - 1) : 0;
  const points = data.map((d, i) => ({
    x: n > 1 ? i * stepX : width / 2,
    y: height - (d.usd / max) * (height - 12) - 6,
  }));
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const first = data[0];
  const last = data[data.length - 1];
  const mid = data[Math.floor((data.length - 1) / 2)];

  return (
    <div className="mt-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="dashSalesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--brand-500))" stopOpacity="0.16" />
            <stop offset="100%" stopColor="hsl(var(--brand-500))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.02, 0.26, 0.5, 0.74, 0.98].map((f) => (
          <line
            key={f}
            x1={0}
            y1={height * f}
            x2={width}
            y2={height * f}
            stroke="hsl(var(--border))"
            strokeWidth={1}
          />
        ))}
        <path d={area} fill="url(#dashSalesFill)" stroke="none" />
        <path
          d={line}
          fill="none"
          stroke="hsl(var(--brand-500))"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {data.length > 1 && (
        <div className="flex justify-between text-2xs text-muted-foreground">
          <span>{first.label}</span>
          {mid !== first && mid !== last && <span>{mid.label}</span>}
          <span>{last.label}</span>
        </div>
      )}
    </div>
  );
}

/** Barras Lu–Do; se destaca el día con más pedidos. */
function WeekdayBarChart({ data }: { data: DashboardMetrics["ordersByWeekday"] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const peakIdx = data.reduce(
    (best, d, i) => (d.count > data[best].count ? i : best),
    0,
  );
  const hasAny = data.some((d) => d.count > 0);
  return (
    <div className="mt-3 flex h-24 items-end justify-between gap-1.5">
      {data.map((d, i) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
          <div
            className={`w-full rounded-md ${
              hasAny && i === peakIdx ? "bg-brand-500" : "bg-ink-200"
            }`}
            style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
            title={`${d.label}: ${d.count} pedido${d.count === 1 ? "" : "s"}`}
          />
          <span
            className={`text-2xs ${
              hasAny && i === peakIdx ? "font-semibold text-foreground" : "text-muted-foreground"
            }`}
          >
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

const METHOD_ICONS: Record<string, LucideIcon> = {
  pago_movil: Smartphone,
  zelle: Landmark,
  binance: Bitcoin,
  cash: Banknote,
  transfer: Building2,
  paypal: CreditCard,
};
const METHOD_BAR_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
];

/** Un renglón por método de pago, con su participación en las ventas del mes. */
/** Medidor semicircular: % de pedidos entregados entre los que ya cerraron. */
function DeliveryGauge({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="mt-1 flex flex-col items-center">
      <div className="relative h-[100px] w-[200px] overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-[200px] w-[200px] rounded-full"
          style={{
            background: `conic-gradient(from 180deg, hsl(var(--brand-500)) 0deg, hsl(var(--brand-500)) ${
              clamped * 1.8
            }deg, hsl(var(--ink-200)) ${clamped * 1.8}deg, hsl(var(--ink-200)) 180deg, transparent 180deg)`,
            WebkitMask:
              "radial-gradient(closest-side, transparent 0 68%, black 69% 100%)",
            mask: "radial-gradient(closest-side, transparent 0 68%, black 69% 100%)",
          }}
        />
      </div>
      <p className="-mt-14 font-display text-3xl font-semibold tracking-[-0.032em] tabular-nums">
        {Math.round(clamped)}%
      </p>
      <p className="mt-7 text-center text-xs text-muted-foreground">
        Pedidos entregados vs. cancelados este mes
      </p>
    </div>
  );
}

function PaymentMethodBreakdown({
  data,
}: {
  data: DashboardMetrics["salesByMethod"];
}) {
  const total = data.reduce((s, d) => s + d.usd, 0) || 1;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
      {data.slice(0, 4).map((d, i) => {
        const Icon = METHOD_ICONS[d.type] ?? CreditCard;
        const pct = Math.round((d.usd / total) * 100);
        return (
          <div key={d.type}>
            <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
              <Icon className="size-3.5" />
              <span className="text-sm font-bold tabular-nums text-foreground">{pct}%</span>
            </div>
            <p className="truncate text-2xs text-muted-foreground">{d.label}</p>
            <div className="mt-1.5 h-1.5 rounded-full bg-ink-200">
              <div
                className={`h-1.5 rounded-full ${METHOD_BAR_COLORS[i % METHOD_BAR_COLORS.length]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
