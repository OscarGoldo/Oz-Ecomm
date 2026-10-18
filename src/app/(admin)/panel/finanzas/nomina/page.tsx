import type { Metadata } from "next";

import { FinanceHeader, FinanceTabs } from "@/components/admin/finance-tabs";
import { PayrollManager } from "@/components/admin/payroll-manager";
import { requireStoreUser } from "@/lib/auth";
import { payrollMonthlyUsd } from "@/lib/finance-overview";
import { formatBs, formatUSD } from "@/lib/format";
import { getPeriodReport } from "@/lib/metrics";
import { resolvePeriod } from "@/lib/report-period";
import { createClient } from "@/lib/supabase/server";
import type { Employee } from "@/types/database";

export const metadata: Metadata = { title: "Nómina" };

/**
 * El equipo y sus sueldos. Es opcional: sirve para saber cuánto se va al mes
 * en sueldos y para que el resumen avise lo que falta registrar.
 */
export default async function NominaPage() {
  const { store } = await requireStoreUser();
  const period = resolvePeriod({ periodo: "este-mes" });
  const [{ data: rows }, r] = await Promise.all([
    createClient()
      .from("employees")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: true }),
    getPeriodReport(store.id, period),
  ]);
  const employees = (rows ?? []) as Employee[];
  const rate = store.exchange_rate;
  const monthlyUsd = payrollMonthlyUsd(employees, rate);
  const active = employees.filter((e) => e.active).length;
  const registered = r.expensesByCategory.find((c) => c.category === "Sueldos")?.usd ?? 0;

  return (
    <div className="space-y-6">
      <FinanceHeader
        eyebrow="Finanzas"
        title="Nómina"
        sub="Tu equipo y sus sueldos. El monto va en dólares o en bolívares, con su equivalente."
      />
      <FinanceTabs active="nomina" />

      {active > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <section className="rounded-2xl border bg-card p-5 sm:p-6">
            <p className="text-[13px] font-semibold text-ink-600">Nómina mensual estimada</p>
            <p className="mt-1.5 font-display text-[2rem] font-extrabold leading-tight tracking-[-0.025em] tabular-nums">
              {formatUSD(monthlyUsd)}
            </p>
            <p className="mt-1 text-[12.5px] text-ink-500">
              {active} {active === 1 ? "persona" : "personas"}
              {rate && rate > 0 ? ` · ≈ ${formatBs(monthlyUsd * rate)} al mes` : ""}
            </p>
          </section>
          <section className="rounded-2xl border bg-card p-5 sm:p-6">
            <p className="text-[13px] font-semibold text-ink-600">Registrado como gasto en {period.label}</p>
            <p className="mt-1.5 font-display text-[2rem] font-extrabold leading-tight tracking-[-0.025em] tabular-nums">
              {formatUSD(registered)}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ECEAFB]">
              <div
                className="h-full rounded-full bg-[#6250d6]"
                style={{ width: `${monthlyUsd > 0 ? Math.min(100, (registered / monthlyUsd) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-2 text-[12.5px] text-ink-500">
              Cada pago real va en Gastos, con la categoría Sueldos: así se descuenta de tu ganancia.
            </p>
          </section>
        </div>
      )}

      <PayrollManager initial={employees} exchangeRate={rate} />
    </div>
  );
}
