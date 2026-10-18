import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import {
  Collections,
  ExpenseBreakdown,
  FinanceHero,
  FinanceInsights,
  FinanceKpis,
  FinanceOutlook,
  Movements,
  MonthlyChart,
  PaymentMix,
  PayrollSummary,
  ProductProfit,
} from "@/components/admin/finance-overview";
import { FinanceHeader, FinanceTabs } from "@/components/admin/finance-tabs";
import { buttonVariants } from "@/components/ui/button";
import { requireStoreUser } from "@/lib/auth";
import { getFinanceOverview } from "@/lib/finance-overview";
import { PERIOD_PRESETS, resolvePeriod, type PeriodPresetId } from "@/lib/report-period";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Finanzas" };

/** Los períodos del resumen. Los rangos a mano siguen en Reportes. */
const PERIODS: PeriodPresetId[] = ["este-mes", "mes-pasado", "trimestre", "este-ano"];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * El resumen de Finanzas responde, en este orden: cuánto te quedó y a dónde
 * se fue lo vendido; hacia dónde va el mes y si ya cubriste los gastos fijos;
 * cómo vienes mes a mes y qué conviene mirar; qué productos te dejan más y en
 * qué gastas; cómo te pagan y qué te falta cobrar. Gastos, nómina y los pagos
 * de Tiendify se cargan y se ven en sus pestañas.
 */
export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: { periodo?: string };
}) {
  const { store } = await requireStoreUser();
  const preset = PERIODS.find((p) => p === searchParams.periodo) ?? "este-mes";
  const period = resolvePeriod({ periodo: preset });
  const o = await getFinanceOverview(store.id, period);

  return (
    <div className="space-y-6">
      <FinanceHeader
        eyebrow={`Finanzas · ${period.label}`}
        title="Cómo van tus números"
        sub={`${cap(period.label)}, comparado con ${o.previousLabel}.`}
        actions={
          <>
            <nav aria-label="Período" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
              {PERIODS.map((id) => {
                const on = id === preset;
                return (
                  <Link
                    key={id}
                    href={id === "este-mes" ? "/panel/finanzas" : `/panel/finanzas?periodo=${id}`}
                    aria-current={on ? "true" : undefined}
                    scroll={false}
                    className={cn(
                      "inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors sm:h-9",
                      on
                        ? "border-noche bg-noche text-white"
                        : "bg-card text-ink-600 hover:border-ink-300 hover:text-foreground",
                    )}
                  >
                    {PERIOD_PRESETS.find((p) => p.id === id)!.label}
                  </Link>
                );
              })}
            </nav>
            <Link href="/panel/finanzas/gastos?nuevo=1" className={buttonVariants()}>
              <Plus /> Registrar gasto
            </Link>
          </>
        }
      />

      <FinanceTabs active="resumen" />

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
        <FinanceHero o={o} />
        <FinanceOutlook o={o} />
      </div>

      <FinanceKpis o={o} />

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
        <MonthlyChart o={o} />
        <FinanceInsights items={o.insights} />
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-5">
        <ProductProfit o={o} />
        <ExpenseBreakdown o={o} />
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <PaymentMix o={o} />
        <Collections o={o} />
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
        <Movements o={o} />
        <PayrollSummary o={o} />
      </div>
    </div>
  );
}
