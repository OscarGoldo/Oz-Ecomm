import type { Metadata } from "next";
import Link from "next/link";
import { format, subMonths } from "date-fns";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";

import { ReportMonthPicker } from "@/components/admin/report-month-picker";
import { requireStoreUser } from "@/lib/auth";
import { getAvailableReportMonths, getMonthlyReport } from "@/lib/metrics";
import { formatBs, formatUSD } from "@/lib/format";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import type { PaymentMethodType } from "@/types/database";

export const metadata: Metadata = { title: "Reportes" };

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const { store } = await requireStoreUser();
  const months = await getAvailableReportMonths(store.id);

  const defaultYm = format(subMonths(new Date(), 1), "yyyy-MM");
  const valid = /^\d{4}-\d{2}$/.test(searchParams.m ?? "");
  const ym = valid ? searchParams.m! : months[0]?.ym ?? defaultYm;

  const r = await getMonthlyReport(store.id, ym);
  const showBs = store.show_bs_prices;
  const empty = r.salesCount === 0 && r.expensesUsd === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link
            href="/panel/finanzas"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Finanzas
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Reporte mensual</h1>
          <p className="text-sm text-muted-foreground">
            Balance y métricas del mes. Elegí el mes e imprimí o guardá como PDF.
          </p>
        </div>
        <ReportMonthPicker months={months} value={ym} />
      </div>

      {/* Report header (prints) */}
      <div className="hidden items-baseline justify-between border-b pb-3 print:flex">
        <div>
          <p className="text-lg font-bold">{store.name}</p>
          <p className="text-sm text-muted-foreground">Reporte de {r.label}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Generado {format(new Date(), "dd/MM/yyyy")}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{r.label}</h2>
        {r.netGrowthPct !== null && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              r.netGrowthPct >= 0
                ? "bg-success/15 text-success"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {r.netGrowthPct >= 0 ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            {Math.abs(Math.round(r.netGrowthPct))}% ganancia vs mes anterior
          </span>
        )}
      </div>

      {empty ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <p className="font-medium">Sin movimientos este mes</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No hubo ventas ni gastos registrados en {r.label}.
          </p>
        </div>
      ) : (
        <>
          {/* Balance / P&L */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Estado de resultados</h3>
            <div className="overflow-hidden rounded-xl border bg-card">
              <Row label="Ingresos por ventas" value={formatUSD(r.incomeUsd)} sub={`${r.salesCount} ventas`} />
              <Row label="− Costo de mercadería" value={`−${formatUSD(r.cogsUsd)}`} muted />
              <Row label="Ganancia bruta" value={formatUSD(r.grossUsd)} sub={`margen ${Math.round(r.marginPct)}%`} strong />
              <Row label="− Gastos" value={`−${formatUSD(r.expensesUsd)}`} muted />
              <Row label="Ganancia neta" value={formatUSD(r.netUsd)} highlight />
            </div>
            {showBs && r.incomeBs > 0 && (
              <p className="text-xs text-muted-foreground">
                Ingresos en bolívares: {formatBs(r.incomeBs)}
              </p>
            )}
          </section>

          {/* Metrics */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Métricas del mes</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Ventas" value={String(r.salesCount)} sub={r.incomeGrowthPct !== null ? `${r.incomeGrowthPct >= 0 ? "+" : ""}${Math.round(r.incomeGrowthPct)}% vs mes ant.` : undefined} />
              <Stat label="Ticket promedio" value={formatUSD(r.avgTicketUsd)} />
              <Stat label="Unidades vendidas" value={String(r.unitsSold)} />
              <Stat label="Clientes" value={String(r.customers)} />
            </div>
          </section>

          {/* Expenses by category */}
          {r.expensesByCategory.length > 0 && (
            <section className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Gastos por categoría</h3>
              <ul className="space-y-3">
                {r.expensesByCategory.map((row) => {
                  const pct = r.expensesUsd > 0 ? Math.round((row.usd / r.expensesUsd) * 100) : 0;
                  return (
                    <li key={row.category}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{row.category}</span>
                        <span className="text-muted-foreground">{formatUSD(row.usd)} · {pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Top products */}
          {r.topProducts.length > 0 && (
            <section className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Productos más vendidos</h3>
              <ul className="space-y-2.5">
                {r.topProducts.map((p) => (
                  <li key={p.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                    <span className="shrink-0 text-muted-foreground">{p.qty} u.</span>
                    <span className="w-20 shrink-0 text-right font-semibold">{formatUSD(p.revenue)}</span>
                    <span className="w-20 shrink-0 text-right text-xs text-success">+{formatUSD(p.profit)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* By payment method */}
          {r.byMethod.length > 0 && (
            <section className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Ventas por método de pago</h3>
              <ul className="space-y-3">
                {r.byMethod.map((row) => {
                  const pct = r.incomeUsd > 0 ? Math.round((row.usd / r.incomeUsd) * 100) : 0;
                  const label = PAYMENT_METHOD_META[row.type as PaymentMethodType]?.label ?? row.type;
                  return (
                    <li key={row.type}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{label}</span>
                        <span className="text-muted-foreground">{formatUSD(row.usd)} · {row.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  sub,
  muted,
  strong,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  muted?: boolean;
  strong?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0 ${
        highlight ? "bg-primary/5" : ""
      }`}
    >
      <div>
        <p className={`text-sm ${strong || highlight ? "font-semibold" : muted ? "text-muted-foreground" : "font-medium"}`}>
          {label}
        </p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <p className={`tabular-nums ${highlight ? "text-xl font-bold" : strong ? "font-bold" : "font-semibold"}`}>
        {value}
      </p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight">{value}</p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
