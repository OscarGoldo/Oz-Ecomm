import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, TrendingUp, Wallet } from "lucide-react";

import { requireStoreUser } from "@/lib/auth";
import { getFinanceSummary } from "@/lib/metrics";
import { formatBs, formatUSD } from "@/lib/format";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import type { PaymentMethodType } from "@/types/database";

export const metadata: Metadata = { title: "Finanzas" };

export default async function FinanzasPage() {
  const { store } = await requireStoreUser();
  const f = await getFinanceSummary(store.id);
  const showBs = store.show_bs_prices;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finanzas</h1>
        <p className="text-sm text-muted-foreground">
          Ventas confirmadas de tu tienda.
        </p>
      </div>

      {/* Headline */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 to-primary/0 p-5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Wallet className="size-4" />
          <span className="text-xs font-medium">Total vendido</span>
        </div>
        <p className="mt-1 text-3xl font-bold tracking-tight">
          {formatUSD(f.totalUsd)}
        </p>
        {showBs && f.totalBs > 0 && (
          <p className="text-sm text-muted-foreground">{formatBs(f.totalBs)}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {f.salesCount} {f.salesCount === 1 ? "venta" : "ventas"}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          icon={<TrendingUp className="size-4" />}
          label="Ventas del mes"
          value={formatUSD(f.monthUsd)}
          sub={`${f.monthCount} ${f.monthCount === 1 ? "pedido" : "pedidos"}`}
        />
        <Stat
          icon={<Wallet className="size-4" />}
          label="Ticket promedio"
          value={formatUSD(f.avgTicketUsd)}
        />
        <Stat
          icon={<Clock className="size-4" />}
          label="Por cobrar"
          value={formatUSD(f.pendingUsd)}
          sub={`${f.pendingCount} por confirmar`}
          highlight={f.pendingCount > 0}
        />
      </div>

      {/* By payment method */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Ventas por método de pago</h2>
        {f.byMethod.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay ventas.</p>
        ) : (
          <ul className="space-y-3">
            {f.byMethod.map((row) => {
              const pct = f.totalUsd > 0 ? Math.round((row.usd / f.totalUsd) * 100) : 0;
              const label =
                PAYMENT_METHOD_META[row.type as PaymentMethodType]?.label ?? row.type;
              return (
                <li key={row.type}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground">
                      {formatUSD(row.usd)} · {row.count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recent sales */}
      <section className="rounded-xl border bg-card">
        <h2 className="border-b p-4 text-sm font-semibold">Últimas ventas</h2>
        {f.recentSales.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Sin ventas todavía.
          </p>
        ) : (
          <ul className="divide-y">
            {f.recentSales.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/panel/pedidos/${o.id}`}
                  className="flex items-center justify-between gap-3 p-4 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      #{o.order_number} · {o.customer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(o.created_at), "d MMM yyyy, HH:mm", {
                        locale: es,
                      })}
                    </p>
                  </div>
                  <span className="font-semibold">{formatUSD(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
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
    <div
      className={`rounded-xl border bg-card p-4 ${
        highlight ? "border-warning/50 bg-warning/5" : ""
      }`}
    >
      <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
