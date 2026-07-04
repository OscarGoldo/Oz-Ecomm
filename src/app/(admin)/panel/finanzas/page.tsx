import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Clock,
  DollarSign,
  FileText,
  Package,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { ExpensesManager } from "@/components/admin/expenses-manager";
import { PayrollManager } from "@/components/admin/payroll-manager";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFinanceSummary, getRecentExpenses } from "@/lib/metrics";
import { formatBs, formatUSD } from "@/lib/format";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import { PAYMENT_PROOFS_BUCKET } from "@/lib/storage";
import type { Employee, Expense, PaymentMethodType } from "@/types/database";

export const metadata: Metadata = { title: "Finanzas" };

/** Times-per-month for each pay frequency (52 weeks / 12 months ≈ 4.33). */
const FREQ_PER_MONTH = { weekly: 52 / 12, biweekly: 2, monthly: 1 } as const;

export default async function FinanzasPage() {
  const { store } = await requireStoreUser();
  const supabase = createClient();
  const [f, expenses, { data: employeeRows }] = await Promise.all([
    getFinanceSummary(store.id),
    getRecentExpenses(store.id),
    supabase
      .from("employees")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: true }),
  ]);
  const employees = (employeeRows ?? []) as Employee[];
  const rate = store.exchange_rate;

  // Payouts received from the platform (PayPal earnings settled by OzShop).
  const { data: payoutOrders } = await supabase
    .from("orders")
    .select("paid_out_at, payment_net, total, payout_proof_url, payout_reference")
    .eq("store_id", store.id)
    .eq("payment_method_type", "paypal")
    .not("paid_out_at", "is", null)
    .order("paid_out_at", { ascending: false });

  const payoutGroups = new Map<
    string,
    { date: string; amount: number; proof: string | null; reference: string | null }
  >();
  for (const o of payoutOrders ?? []) {
    const key = o.paid_out_at as string;
    const g =
      payoutGroups.get(key) ??
      { date: key, amount: 0, proof: o.payout_proof_url, reference: o.payout_reference };
    g.amount += o.payment_net != null ? Number(o.payment_net) : Number(o.total);
    payoutGroups.set(key, g);
  }
  const admin = createAdminClient();
  const payouts = await Promise.all(
    [...payoutGroups.values()].map(async (p) => {
      let proofUrl: string | null = null;
      if (p.proof) {
        const { data } = await admin.storage
          .from(PAYMENT_PROOFS_BUCKET)
          .createSignedUrl(p.proof, 3600);
        proofUrl = data?.signedUrl ?? null;
      }
      return { ...p, proofUrl };
    }),
  );

  // Estimated monthly payroll, normalising every frequency + currency to USD.
  const payrollMonthlyUsd = employees.reduce((sum, e) => {
    if (!e.active) return sum;
    const usd =
      e.currency === "USD"
        ? Number(e.amount)
        : rate && rate > 0
          ? Number(e.amount) / rate
          : 0;
    return sum + usd * FREQ_PER_MONTH[e.frequency];
  }, 0);
  const payrollMonthlyBs = rate && rate > 0 ? payrollMonthlyUsd * rate : null;
  const hasActivePayroll = employees.some((e) => e.active);

  const showBs = store.show_bs_prices;
  const noCosts = f.cogsUsd === 0 && f.totalUsd > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finanzas</h1>
          <p className="text-sm text-muted-foreground">
            Ingresos, márgenes, gastos y ganancia de tu tienda.
          </p>
        </div>
        <Link
          href="/panel/finanzas/reportes"
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <FileText className="size-4" /> Reportes mensuales
        </Link>
      </div>

      {/* Payouts received from the platform */}
      {payouts.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Pagos recibidos de OzShop</h2>
            <p className="text-xs text-muted-foreground">
              Lo que te transfirió la plataforma por tus ventas con PayPal/tarjeta
              (neto, ya descontada la comisión del procesador).
            </p>
          </div>
          <ul className="divide-y rounded-xl border bg-card">
            {payouts.map((p) => (
              <li key={p.date} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{formatUSD(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(p.date), "d MMM yyyy, HH:mm", { locale: es })}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </p>
                </div>
                {p.proofUrl ? (
                  <a
                    href={p.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                  >
                    Ver comprobante
                  </a>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">Sin comprobante</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* This month */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Este mes</h2>
          {f.momGrowthPct !== null && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                f.momGrowthPct >= 0
                  ? "bg-success/15 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {f.momGrowthPct >= 0 ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {Math.abs(Math.round(f.momGrowthPct))}% vs mes anterior
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={<DollarSign className="size-4" />} label="Ventas" value={formatUSD(f.monthUsd)} sub={`${f.monthCount} pedidos`} />
          <Stat icon={<TrendingUp className="size-4" />} label="Ganancia bruta" value={formatUSD(f.monthGrossUsd)} />
          <Stat icon={<Receipt className="size-4" />} label="Gastos" value={formatUSD(f.monthExpensesUsd)} />
          <Stat icon={<Wallet className="size-4" />} label="Ganancia neta" value={formatUSD(f.monthNetUsd)} highlight />
        </div>
      </section>

      {/* All-time totals */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Histórico</h2>
        <div className="rounded-xl border bg-gradient-to-br from-primary/10 to-primary/0 p-5">
          <p className="text-xs font-medium text-muted-foreground">Ganancia neta total</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{formatUSD(f.netProfitUsd)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ingresos {formatUSD(f.totalUsd)} − costos {formatUSD(f.cogsUsd)} − gastos {formatUSD(f.expensesTotalUsd)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon={<DollarSign className="size-4" />}
            label="Ingresos totales"
            value={formatUSD(f.totalUsd)}
            sub={showBs && f.totalBs > 0 ? formatBs(f.totalBs) : `${f.salesCount} ventas`}
          />
          <Stat icon={<TrendingUp className="size-4" />} label="Margen" value={`${Math.round(f.marginPct)}%`} sub={`bruta ${formatUSD(f.grossProfitUsd)}`} />
          <Stat icon={<Package className="size-4" />} label="Unidades vendidas" value={String(f.unitsSold)} sub={`ticket prom. ${formatUSD(f.avgTicketUsd)}`} />
          <Stat icon={<Clock className="size-4" />} label="Por cobrar" value={formatUSD(f.pendingUsd)} sub={`${f.pendingCount} por confirmar`} highlight={f.pendingCount > 0} />
        </div>
        {noCosts && (
          <p className="rounded-lg bg-warning/10 p-3 text-xs text-warning-foreground">
            💡 Carga el <strong>costo</strong> de tus productos (en cada producto) para ver
            márgenes y ganancias reales.
          </p>
        )}
      </section>

      {/* Top products */}
      {f.topProducts.length > 0 && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Productos más vendidos</h2>
          <ul className="space-y-2.5">
            {f.topProducts.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span className="shrink-0 text-muted-foreground">{p.qty} u.</span>
                <span className="w-20 shrink-0 text-right font-semibold">{formatUSD(p.revenue)}</span>
                <span className="w-20 shrink-0 text-right text-xs text-success">+{formatUSD(p.profit)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">Ordenado por ingresos. La última columna es la ganancia.</p>
        </section>
      )}

      {/* By payment method */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Ventas por método de pago</h2>
        {f.byMethod.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay ventas.</p>
        ) : (
          <ul className="space-y-3">
            {f.byMethod.map((row) => {
              const pct = f.totalUsd > 0 ? Math.round((row.usd / f.totalUsd) * 100) : 0;
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
        )}
      </section>

      {/* Expenses */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Gastos</h2>
          <p className="text-xs text-muted-foreground">
            Registra tus gastos (mercadería, sueldos, alquiler…) para ver la ganancia neta.
          </p>
        </div>
        <ExpensesManager initial={expenses as Expense[]} />
      </section>

      {/* Payroll */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Nómina</h2>
          <p className="text-xs text-muted-foreground">
            Tus empleados y sueldos (opcional). El monto se muestra en USD y su
            equivalente en Bs.
          </p>
        </div>
        {hasActivePayroll && (
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Nómina mensual estimada
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {formatUSD(payrollMonthlyUsd)}
            </p>
            {payrollMonthlyBs != null && payrollMonthlyBs > 0 && (
              <p className="text-xs text-muted-foreground">
                ≈ {formatBs(payrollMonthlyBs)} / mes
              </p>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Estimado de lo que pagas al mes. Registra cada pago real en
              «Gastos» para descontarlo de tu ganancia.
            </p>
          </div>
        )}
        <PayrollManager initial={employees} exchangeRate={rate} />
      </section>

      {/* Recent sales */}
      <section className="rounded-xl border bg-card">
        <h2 className="border-b p-4 text-sm font-semibold">Últimas ventas</h2>
        {f.recentSales.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Sin ventas todavía.</p>
        ) : (
          <ul className="divide-y">
            {f.recentSales.map((o) => (
              <li key={o.id}>
                <Link href={`/panel/pedidos/${o.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">#{o.order_number} · {o.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(o.created_at), "d MMM yyyy, HH:mm", { locale: es })}
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
