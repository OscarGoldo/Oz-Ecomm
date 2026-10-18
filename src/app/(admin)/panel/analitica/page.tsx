import type { Metadata } from "next";
import Link from "next/link";

import {
  AnalyticsInsights,
  AnalyticsKpis,
  CustomersCard,
  FunnelCard,
  HourHeatmap,
  ProductMatrix,
  SourcesCard,
  VisitorsChart,
} from "@/components/admin/analytics-overview";
import { ProLockedPreview } from "@/components/admin/pro-lock";
import { requireStoreUser } from "@/lib/auth";
import {
  ANALYTICS_RANGES,
  getAnalyticsOverview,
  sampleAnalyticsOverview,
  type AnalyticsRange,
} from "@/lib/analytics-overview";
import { isPro } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analítica" };

/**
 * La Analítica responde, en este orden: cuánta gente entra y cuántos compran;
 * en qué paso se van y qué se puede recuperar; qué conviene hacer; cómo vienen
 * las visitas día a día y de dónde llegan; cuándo le compran y quién vuelve; y
 * qué productos atraen y cuáles convencen.
 */
export default async function AnaliticaPage({
  searchParams,
}: {
  searchParams: { dias?: string };
}) {
  const { store } = await requireStoreUser();
  const days: AnalyticsRange =
    ANALYTICS_RANGES.find((d) => String(d) === searchParams.dias) ?? 30;

  // Plan Gratis: no se consulta la base, se dibuja el panel con datos de
  // ejemplo detrás de un desenfoque. Ver la función borrosa convierte mucho
  // mejor que esconderla: el comerciante ve exactamente lo que se está perdiendo.
  const locked = !isPro(store);
  const a = locked ? sampleAnalyticsOverview(days) : await getAnalyticsOverview(store.id, days);

  const panels = (
    <div className="space-y-6">
      <AnalyticsKpis a={a} />
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
        <FunnelCard a={a} />
        <AnalyticsInsights items={a.insights} />
      </div>
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-5">
        <VisitorsChart a={a} />
        <SourcesCard a={a} />
      </div>
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-5">
        <HourHeatmap a={a} />
        <CustomersCard a={a} />
      </div>
      <ProductMatrix a={a} />
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-landing-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            Analítica · últimos {days} días
          </p>
          <h1 className="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.028em]">
            Quién entra y quién compra
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-600">
            {a.period.label}, comparado con {a.period.previousLabel}.
          </p>
        </div>
        {!locked && (
          <nav aria-label="Período" className="flex gap-1.5">
            {ANALYTICS_RANGES.map((d) => {
              const on = d === days;
              return (
                <Link
                  key={d}
                  href={d === 30 ? "/panel/analitica" : `/panel/analitica?dias=${d}`}
                  aria-current={on ? "true" : undefined}
                  scroll={false}
                  className={cn(
                    "inline-flex h-10 items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors sm:h-9",
                    on
                      ? "border-noche bg-noche text-white"
                      : "bg-card text-ink-600 hover:border-ink-300 hover:text-foreground",
                  )}
                >
                  {d} días
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {locked ? (
        <ProLockedPreview
          title="La analítica es del plan Pro"
          text="Quién entra a tu tienda y de dónde llega, en qué paso se va, qué productos atraen y cuáles convencen, a qué hora te compran y quién vuelve. Ya estamos registrando los datos de tu tienda: al activar Pro los ves desde el primer día."
        >
          {panels}
        </ProLockedPreview>
      ) : (
        panels
      )}
    </div>
  );
}
