import type { Metadata } from "next";

import { ExpensesManager } from "@/components/admin/expenses-manager";
import { FinanceHeader, FinanceTabs } from "@/components/admin/finance-tabs";
import { requireStoreUser } from "@/lib/auth";
import { FIXED_CATEGORIES } from "@/lib/finance-overview";
import { formatUSD } from "@/lib/format";
import { getPeriodReport, getRecentExpenses } from "@/lib/metrics";
import { resolvePeriod } from "@/lib/report-period";
import type { Expense } from "@/types/database";

export const metadata: Metadata = { title: "Gastos" };

const RAMP = ["#4B3BB8", "#6250d6", "#8A7CE3", "#ACA3EC", "#CBC5F3", "#E2DEF8"];

/**
 * Los gastos: se cargan aquí y se ven por categoría. Son los que separan la
 * ganancia bruta de la neta en el resumen, y los fijos (alquiler, sueldos,
 * servicios) son los que arman el punto de equilibrio.
 */
export default async function GastosPage({
  searchParams,
}: {
  searchParams: { nuevo?: string };
}) {
  const { store } = await requireStoreUser();
  const period = resolvePeriod({ periodo: "este-mes" });
  const [r, expenses] = await Promise.all([
    getPeriodReport(store.id, period),
    getRecentExpenses(store.id),
  ]);
  const fixed = r.expensesByCategory
    .filter((c) => FIXED_CATEGORIES.includes(c.category))
    .reduce((s, c) => s + c.usd, 0);
  const delta = r.prevExpensesUsd > 0 ? ((r.expensesUsd - r.prevExpensesUsd) / r.prevExpensesUsd) * 100 : null;

  return (
    <div className="space-y-6">
      <FinanceHeader
        eyebrow={`Finanzas · ${period.label}`}
        title="Gastos"
        sub="Lo que pagas para que la tienda funcione. Regístralos para ver lo que de verdad te queda."
      />
      <FinanceTabs active="gastos" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat
          label="Gastos de este mes"
          value={formatUSD(r.expensesUsd)}
          sub={
            delta === null
              ? `${formatUSD(r.prevExpensesUsd)} en ${period.previous.label}`
              : `${delta >= 0 ? "▲" : "▼"} ${Math.round(Math.abs(delta))}% vs. ${period.previous.label}`
          }
        />
        <Stat
          label="Sobre lo que vendiste"
          value={r.incomeUsd > 0 ? `${Math.round((r.expensesUsd / r.incomeUsd) * 100)}%` : "—"}
          sub={r.incomeUsd > 0 ? `de ${formatUSD(r.incomeUsd)} en ventas` : "sin ventas este mes"}
        />
        <Stat
          label="Fijos"
          value={formatUSD(fixed)}
          sub="alquiler, sueldos y servicios: los pagas vendas o no"
        />
      </div>

      <div className="grid items-start gap-4 sm:gap-5 lg:grid-cols-5">
        <section aria-labelledby="registrar" className="space-y-3 lg:col-span-3">
          <h2 id="registrar" className="font-display text-lg font-bold tracking-[-0.02em]">
            Tus gastos
          </h2>
          <ExpensesManager initial={expenses as Expense[]} defaultOpen={searchParams.nuevo === "1"} />
        </section>

        <section aria-labelledby="por-categoria" className="rounded-2xl border bg-card p-5 sm:p-6 lg:col-span-2">
          <h2 id="por-categoria" className="font-display text-lg font-bold tracking-[-0.02em]">
            Por categoría, este mes
          </h2>
          {r.expensesByCategory.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">Todavía no registraste gastos este mes.</p>
          ) : (
            <ul className="mt-4 space-y-3.5">
              {r.expensesByCategory.map((c, i) => {
                const share = r.expensesUsd > 0 ? (c.usd / r.expensesUsd) * 100 : 0;
                return (
                  <li key={c.category}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold">
                        {c.category}
                        {FIXED_CATEGORIES.includes(c.category) && (
                          <span className="ml-1.5 inline-flex h-5 items-center rounded-md bg-[#EEF0FB] px-1.5 text-[11px] font-bold text-[#4B3BB8]">
                            fijo
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums text-ink-600">
                        <b className="text-foreground">{formatUSD(c.usd)}</b> · {Math.round(share)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#ECEAFB]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${share}%`, background: RAMP[Math.min(i, RAMP.length - 1)] }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <p className="text-[13px] font-semibold text-ink-600">{label}</p>
      <p className="mt-1.5 font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.025em] tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-[12.5px] text-ink-500">{sub}</p>
    </section>
  );
}
