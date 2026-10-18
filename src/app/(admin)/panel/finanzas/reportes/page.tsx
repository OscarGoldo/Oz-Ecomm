import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  DollarSign,
  Download,
  Package,
  Percent,
  Receipt,
  ShoppingBag,
  Tag,
  TrendingUp,
  Users,
} from "lucide-react";

import { FinanceHeader, FinanceTabs } from "@/components/admin/finance-tabs";
import { PrintButton, ReportRangeForm } from "@/components/admin/report-controls";
import { StatCard } from "@/components/admin/stat-card";
import { requireStoreUser } from "@/lib/auth";
import {
  getProductReport,
  listExpenses,
  listSales,
  REPORT_TYPES,
  resolveReportType,
  type ReportType,
} from "@/lib/finance-reports";
import { getPeriodReport, type Delta } from "@/lib/metrics";
import {
  caracasToday,
  PERIOD_PRESETS,
  periodQuery,
  resolvePeriod,
  shortDateTime,
  shortDay,
  type ReportPeriod,
} from "@/lib/report-period";
import { formatBs, formatUSD } from "@/lib/format";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { PaymentMethodType } from "@/types/database";

export const metadata: Metadata = { title: "Reportes" };

/** Filas de ventas y gastos por tanda de "Ver más". */
const PAGE_STEP = 50;
/** Más que esto no se lee en pantalla: para eso está el CSV. */
const MAX_ON_SCREEN = 1000;
/** Productos en pantalla; el CSV los trae todos. */
const MAX_PRODUCTS_ON_SCREEN = 300;

type SearchParams = {
  tipo?: string;
  periodo?: string;
  desde?: string;
  hasta?: string;
  m?: string;
  ver?: string;
};

function reportHref(tipo: ReportType, query: Record<string, string>): string {
  return `/panel/finanzas/reportes?${new URLSearchParams({ tipo, ...query })}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function methodLabel(type: string | null): string {
  if (!type) return "—";
  return PAYMENT_METHOD_META[type as PaymentMethodType]?.label ?? type;
}

/** Igual que en el resto del panel: sin período anterior no hay porcentaje. */
function delta(
  current: number,
  previous: number,
  previousLabel: string,
  period: ReportPeriod,
): Delta {
  return {
    previousLabel,
    periodLabel: `en ${period.previous.label}`,
    pct: previous > 0 ? ((current - previous) / previous) * 100 : null,
  };
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { store } = await requireStoreUser();
  const tipo = resolveReportType(searchParams.tipo);
  const period = resolvePeriod(searchParams);
  const shown = Math.min(
    MAX_ON_SCREEN,
    Math.max(PAGE_STEP, Number(searchParams.ver) || PAGE_STEP),
  );
  const title = REPORT_TYPES.find((t) => t.id === tipo)!.label;
  // El CSV lleva las fechas exactas y no el atajo: si la página se cargó a
  // las 11:59 de la noche y se descarga a las 12:01, "Hoy" ya sería otro día.
  const csvHref = `/panel/finanzas/reportes/csv?${new URLSearchParams({
    tipo,
    desde: period.from,
    hasta: period.to,
  })}`;
  const today = caracasToday();

  return (
    <div className="space-y-6">
      <FinanceHeader
        eyebrow="Finanzas"
        title="Reportes"
        sub="Elige qué quieres ver y de qué fechas. Lo ves aquí, lo bajas en CSV o lo imprimes."
      />
      <FinanceTabs active="reportes" />

      <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm print:hidden">
        <Field label="Reporte">
          <ChipRow>
            {REPORT_TYPES.map((t) => (
              <Chip
                key={t.id}
                href={reportHref(t.id, periodQuery(period))}
                active={t.id === tipo}
                strong
              >
                {t.label}
              </Chip>
            ))}
          </ChipRow>
        </Field>

        <Field label="Período">
          <ChipRow>
            {PERIOD_PRESETS.map((p) => (
              <Chip
                key={p.id}
                href={reportHref(tipo, { periodo: p.id })}
                active={period.preset === p.id}
              >
                {p.label}
              </Chip>
            ))}
          </ChipRow>
          <ReportRangeForm
            key={`${period.from}_${period.to}`}
            tipo={tipo}
            from={period.from}
            to={period.to}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2 border-t pt-4 sm:flex sm:flex-wrap">
          <a
            href={csvHref}
            download
            className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-medium hover:bg-muted sm:gap-2 sm:px-4"
          >
            <Download className="size-4" /> Descargar CSV
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Encabezado que solo sale al imprimir. */}
      <div className="hidden items-baseline justify-between border-b pb-3 print:flex">
        <div>
          <p className="text-lg font-bold">{store.name}</p>
          <p className="text-sm text-muted-foreground">
            {title} · {cap(period.label)}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Generado el {today.split("-").reverse().join("/")}
        </p>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 print:hidden">
        <h2 className="text-lg font-semibold">
          {title} · {cap(period.label)}
        </h2>
        {(tipo === "resumen" || tipo === "ventas") && (
          <p className="text-xs text-muted-foreground">
            Comparado con {period.previous.label}
          </p>
        )}
      </div>

      {tipo === "resumen" && (
        <SummaryReport storeId={store.id} period={period} showBs={store.show_bs_prices} />
      )}
      {tipo === "ventas" && (
        <SalesReport
          storeId={store.id}
          period={period}
          shown={shown}
          showBs={store.show_bs_prices}
        />
      )}
      {tipo === "productos" && <ProductsReport storeId={store.id} period={period} />}
      {tipo === "gastos" && (
        <ExpensesReport storeId={store.id} period={period} shown={shown} />
      )}
    </div>
  );
}

// ── Resumen ─────────────────────────────────────────────────────────────────

async function SummaryReport({
  storeId,
  period,
  showBs,
}: {
  storeId: string;
  period: ReportPeriod;
  showBs: boolean;
}) {
  const [r, products] = await Promise.all([
    getPeriodReport(storeId, period),
    // Del mismo reporte que la pestaña Productos, con los descuentos ya
    // repartidos: así los dos dicen lo mismo de cada producto.
    getProductReport(storeId, period),
  ]);
  const pq = periodQuery(period);
  const topProducts = products.rows.slice(0, 5);

  if (r.salesCount === 0 && r.expensesUsd === 0) {
    return (
      <EmptyState
        title="Sin movimientos en estas fechas"
        body={`No hubo ventas ni gastos registrados en ${period.label}.`}
      />
    );
  }

  return (
    <>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Estado de resultados</h3>
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <PnlRow
            label="Ingresos por ventas"
            value={formatUSD(r.incomeUsd)}
            sub={`${r.salesCount} ${r.salesCount === 1 ? "venta" : "ventas"}`}
          />
          <PnlRow label="− Costo de mercadería" value={`−${formatUSD(r.cogsUsd)}`} muted />
          <PnlRow
            label="Ganancia bruta"
            value={formatUSD(r.grossUsd)}
            sub={`margen ${Math.round(r.marginPct)}%`}
            strong
          />
          <PnlRow label="− Gastos" value={`−${formatUSD(r.expensesUsd)}`} muted />
          <PnlRow
            label="Ganancia neta"
            value={formatUSD(r.netUsd)}
            sub={`${formatUSD(r.prevNetUsd)} en ${period.previous.label}`}
            highlight
          />
        </div>
        {showBs && r.incomeBs > 0 && (
          <p className="text-xs text-muted-foreground">
            Ingresos en bolívares (a la tasa de cada pedido): {formatBs(r.incomeBs)}
          </p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<ShoppingBag className="size-4" />}
          label="Ventas"
          value={String(r.salesCount)}
          delta={delta(r.salesCount, r.prevSalesCount, String(r.prevSalesCount), period)}
        />
        <StatCard
          icon={<DollarSign className="size-4" />}
          label="Ingresos"
          value={formatUSD(r.incomeUsd)}
          delta={delta(r.incomeUsd, r.prevIncomeUsd, formatUSD(r.prevIncomeUsd), period)}
        />
        <StatCard
          icon={<Receipt className="size-4" />}
          label="Ticket promedio"
          value={formatUSD(r.avgTicketUsd)}
          sub={`${r.unitsSold} ${r.unitsSold === 1 ? "unidad vendida" : "unidades vendidas"}`}
        />
        <StatCard
          icon={<Users className="size-4" />}
          label="Clientes"
          value={String(r.customers)}
        />
      </section>

      {r.expensesByCategory.length > 0 && (
        <Panel
          title="Gastos por categoría"
          more={{ href: reportHref("gastos", pq), label: "Ver gastos" }}
        >
          <Bars
            total={r.expensesUsd}
            rows={r.expensesByCategory.map((c) => ({
              key: c.category,
              label: c.category,
              usd: c.usd,
            }))}
          />
        </Panel>
      )}

      {topProducts.length > 0 && (
        <Panel
          title="Productos más vendidos"
          more={{ href: reportHref("productos", pq), label: "Ver todos" }}
        >
          <ul className="space-y-2.5">
            {topProducts.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span className="shrink-0 text-muted-foreground">{p.qty} u.</span>
                <span className="w-20 shrink-0 text-right font-semibold tabular-nums">
                  {formatUSD(p.revenueUsd)}
                </span>
                <span className="w-20 shrink-0 text-right text-xs tabular-nums text-success">
                  +{formatUSD(p.profitUsd)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {r.byMethod.length > 0 && (
        <Panel title="Ventas por método de pago">
          <Bars
            total={r.incomeUsd}
            rows={r.byMethod.map((m) => ({
              key: m.type,
              label: methodLabel(m.type),
              usd: m.usd,
              extra: String(m.count),
            }))}
          />
        </Panel>
      )}
    </>
  );
}

// ── Ventas ──────────────────────────────────────────────────────────────────

async function SalesReport({
  storeId,
  period,
  shown,
  showBs,
}: {
  storeId: string;
  period: ReportPeriod;
  shown: number;
  showBs: boolean;
}) {
  const [r, { rows, hasMore }] = await Promise.all([
    getPeriodReport(storeId, period),
    listSales(storeId, period, { max: shown }),
  ]);

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<ShoppingBag className="size-4" />}
          label="Ventas"
          value={String(r.salesCount)}
          delta={delta(r.salesCount, r.prevSalesCount, String(r.prevSalesCount), period)}
        />
        <StatCard
          icon={<DollarSign className="size-4" />}
          label="Ingresos"
          value={formatUSD(r.incomeUsd)}
          sub={showBs && r.incomeBs > 0 ? formatBs(r.incomeBs) : undefined}
          delta={delta(r.incomeUsd, r.prevIncomeUsd, formatUSD(r.prevIncomeUsd), period)}
        />
        <StatCard
          icon={<Receipt className="size-4" />}
          label="Ticket promedio"
          value={formatUSD(r.avgTicketUsd)}
        />
        <StatCard
          icon={<Users className="size-4" />}
          label="Clientes"
          value={String(r.customers)}
        />
      </section>

      {rows.length === 0 ? (
        <EmptyState
          title="Sin ventas en estas fechas"
          body={`No hay pedidos con el pago confirmado en ${period.label}.`}
        />
      ) : (
        <>
          <ul className="space-y-2.5 lg:hidden print:hidden">
            {rows.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/panel/pedidos/${o.id}`}
                  className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      #{o.order_number} · {o.customer_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {shortDateTime(o.created_at)} · {methodLabel(o.payment_method_type)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatUSD(o.total)}</p>
                    {showBs && o.total_bs != null && (
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {formatBs(o.total_bs)}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-sm lg:block print:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Pedido</th>
                  <th className="px-4 py-3 text-left">Método</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  {showBs && <th className="px-4 py-3 text-right">Tasa</th>}
                  {showBs && <th className="px-4 py-3 text-right">Total Bs</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {shortDateTime(o.created_at)}
                    </td>
                    <td className="max-w-[16rem] px-4 py-3">
                      <Link
                        href={`/panel/pedidos/${o.id}`}
                        className="block truncate font-medium hover:underline"
                      >
                        #{o.order_number} · {o.customer_name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {methodLabel(o.payment_method_type)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                      {formatUSD(o.total)}
                    </td>
                    {showBs && (
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {o.exchange_rate != null ? Number(o.exchange_rate).toFixed(2) : "—"}
                      </td>
                    )}
                    {showBs && (
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                        {o.total_bs != null ? formatBs(o.total_bs) : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <MoreRows
            hasMore={hasMore}
            shown={shown}
            href={reportHref("ventas", {
              ...periodQuery(period),
              ver: String(shown + PAGE_STEP),
            })}
            label="Ver más ventas"
          />
        </>
      )}

      <Note>
        Solo cuentan los pedidos con el pago confirmado. Los que están por
        confirmar o cancelados no son ventas. El CSV trae además teléfono,
        referencia de pago, descuentos, envío y comisión de cada pedido.
      </Note>
    </>
  );
}

// ── Productos ───────────────────────────────────────────────────────────────

async function ProductsReport({
  storeId,
  period,
}: {
  storeId: string;
  period: ReportPeriod;
}) {
  const { rows, totals, missingCost } = await getProductReport(storeId, period);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Sin productos vendidos en estas fechas"
        body={`No hay ventas confirmadas en ${period.label}.`}
      />
    );
  }

  const visible = rows.slice(0, MAX_PRODUCTS_ON_SCREEN);
  const margin = totals.revenueUsd > 0 ? (totals.profitUsd / totals.revenueUsd) * 100 : 0;

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Tag className="size-4" />}
          label="Productos vendidos"
          value={String(rows.length)}
        />
        <StatCard
          icon={<Package className="size-4" />}
          label="Unidades"
          value={String(totals.qty)}
        />
        <StatCard
          icon={<DollarSign className="size-4" />}
          label="Ingreso"
          value={formatUSD(totals.revenueUsd)}
        />
        <StatCard
          icon={<TrendingUp className="size-4" />}
          label="Ganancia"
          value={formatUSD(totals.profitUsd)}
          sub={`margen ${Math.round(margin)}%`}
        />
      </section>

      {missingCost > 0 && (
        <div className="flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-3.5 text-sm print:hidden">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
          <p>
            {missingCost === 1
              ? "1 producto se vendió sin costo cargado"
              : `${missingCost} productos se vendieron sin costo cargado`}
            , así que su ganancia sale igual a lo que cobraste. Cárgale el
            costo en{" "}
            <Link href="/panel/productos" className="font-medium underline">
              Productos
            </Link>{" "}
            para que el margen sea real desde las próximas ventas.
          </p>
        </div>
      )}

      <ul className="space-y-2.5 lg:hidden print:hidden">
        {visible.map((p, i) => (
          <li key={`${p.name}-${i}`} className="rounded-2xl border bg-card p-3.5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</p>
              <p className="shrink-0 text-sm font-semibold tabular-nums">
                {formatUSD(p.revenueUsd)}
              </p>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {p.qty} u. · ganancia {formatUSD(p.profitUsd)}
              {p.marginPct !== null && ` · ${Math.round(p.marginPct)}%`}
              {p.missingCost && " · sin costo"}
            </p>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-sm lg:block print:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-right">Unidades</th>
              <th className="px-4 py-3 text-right">Ingreso</th>
              <th className="px-4 py-3 text-right">Costo</th>
              <th className="px-4 py-3 text-right">Ganancia</th>
              <th className="px-4 py-3 text-right">Margen</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((p, i) => (
              <tr key={`${p.name}-${i}`} className="hover:bg-muted/40">
                <td className="max-w-[18rem] px-4 py-3">
                  <span className="block truncate font-medium">{p.name}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{p.qty}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                  {formatUSD(p.revenueUsd)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {p.missingCost && p.costUsd === 0 ? "sin costo" : formatUSD(p.costUsd)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatUSD(p.profitUsd)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {p.marginPct !== null ? `${Math.round(p.marginPct)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{totals.qty}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {formatUSD(totals.revenueUsd)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {formatUSD(totals.costUsd)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {formatUSD(totals.profitUsd)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {Math.round(margin)}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {rows.length > visible.length && (
        <Note>
          Aquí ves los {visible.length} que más vendieron. El CSV trae los{" "}
          {rows.length}.
        </Note>
      )}

      <Note>
        El ingreso de cada producto ya descuenta los cupones del pedido,
        repartidos entre sus productos. No incluye el envío, así que la suma
        es lo que cobraste en el período menos lo cobrado por envíos.
      </Note>
    </>
  );
}

// ── Gastos ──────────────────────────────────────────────────────────────────

async function ExpensesReport({
  storeId,
  period,
  shown,
}: {
  storeId: string;
  period: ReportPeriod;
  shown: number;
}) {
  const [r, { rows, hasMore }] = await Promise.all([
    getPeriodReport(storeId, period),
    listExpenses(storeId, period, { max: shown }),
  ]);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Sin gastos en estas fechas"
        body={`No registraste gastos en ${period.label}.`}
        action={{ href: "/panel/finanzas/gastos?nuevo=1", label: "Registrar un gasto" }}
      />
    );
  }

  const top = r.expensesByCategory[0];
  const ofIncome = r.incomeUsd > 0 ? (r.expensesUsd / r.incomeUsd) * 100 : null;

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          icon={<Receipt className="size-4" />}
          label="Total en gastos"
          value={formatUSD(r.expensesUsd)}
          sub={`${formatUSD(r.prevExpensesUsd)} en ${period.previous.label}`}
        />
        {top && (
          <StatCard
            icon={<Tag className="size-4" />}
            label="Mayor categoría"
            value={top.category}
            sub={formatUSD(top.usd)}
          />
        )}
        {ofIncome !== null && (
          <StatCard
            icon={<Percent className="size-4" />}
            label="Sobre tus ventas"
            value={`${Math.round(ofIncome)}%`}
            sub={`de ${formatUSD(r.incomeUsd)} en ingresos`}
          />
        )}
      </section>

      {r.expensesByCategory.length > 1 && (
        <Panel title="Por categoría">
          <Bars
            total={r.expensesUsd}
            rows={r.expensesByCategory.map((c) => ({
              key: c.category,
              label: c.category,
              usd: c.usd,
            }))}
          />
        </Panel>
      )}

      <ul className="space-y-2.5 lg:hidden print:hidden">
        {rows.map((e) => (
          <li
            key={e.id}
            className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{e.description}</p>
              <p className="truncate text-xs text-muted-foreground">
                {shortDay(e.spent_at)} · {e.category || "Otros"}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums">
              {formatUSD(e.amount)}
            </p>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-sm lg:block print:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Descripción</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((e) => (
              <tr key={e.id} className="hover:bg-muted/40">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {shortDay(e.spent_at)}
                </td>
                <td className="max-w-[20rem] px-4 py-3">
                  <span className="block truncate font-medium">{e.description}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{e.category || "Otros"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                  {formatUSD(e.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MoreRows
        hasMore={hasMore}
        shown={shown}
        href={reportHref("gastos", {
          ...periodQuery(period),
          ver: String(shown + PAGE_STEP),
        })}
        label="Ver más gastos"
      />

      <Note>Los gastos se registran en dólares desde la pestaña Gastos.</Note>
    </>
  );
}

// ── Piezas ──────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

/** En el teléfono los atajos se deslizan de lado en vez de apilarse. */
function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:flex-wrap [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

function Chip({
  href,
  active,
  strong,
  children,
}: {
  href: string;
  active: boolean;
  /** El tipo de reporte va lleno; el período, solo marcado. */
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? strong
            ? "border-primary bg-primary text-primary-foreground"
            : "border-primary bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function Panel({
  title,
  more,
  children,
}: {
  title: string;
  more?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {more && (
          <Link
            href={more.href}
            className="text-xs font-medium text-muted-foreground hover:text-foreground print:hidden"
          >
            {more.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Bars({
  total,
  rows,
}: {
  total: number;
  rows: { key: string; label: string; usd: number; extra?: string }[];
}) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const pct = total > 0 ? Math.round((row.usd / total) * 100) : 0;
        return (
          <li key={row.key}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium">{row.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatUSD(row.usd)} · {row.extra ?? `${pct}%`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PnlRow({
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
      className={cn(
        "flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0",
        highlight && "bg-primary/5",
      )}
    >
      <div>
        <p
          className={cn(
            "text-sm",
            strong || highlight
              ? "font-semibold"
              : muted
                ? "text-muted-foreground"
                : "font-medium",
          )}
        >
          {label}
        </p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <p
        className={cn(
          "tabular-nums",
          highlight ? "text-xl font-bold" : strong ? "font-bold" : "font-semibold",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function MoreRows({
  hasMore,
  shown,
  href,
  label,
}: {
  hasMore: boolean;
  shown: number;
  href: string;
  label: string;
}) {
  if (!hasMore) return null;
  if (shown >= MAX_ON_SCREEN) {
    return (
      <Note>
        Aquí se muestran las primeras {MAX_ON_SCREEN}. Descarga el CSV para
        verlas todas.
      </Note>
    );
  }
  return (
    <div className="flex justify-center pt-1 print:hidden">
      <Link
        href={href}
        scroll={false}
        prefetch={false}
        className="inline-flex h-11 items-center rounded-lg border px-5 text-sm font-medium hover:bg-muted"
      >
        {label}
      </Link>
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-flex h-11 items-center rounded-lg border px-5 text-sm font-medium hover:bg-muted print:hidden"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
