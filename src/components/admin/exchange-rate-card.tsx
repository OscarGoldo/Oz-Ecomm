import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { ArrowRight, RefreshCw, TriangleAlert } from "lucide-react";

import { formatBs } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * La tasa que la tienda le está aplicando a todos sus precios en bolívares.
 *
 * Existe porque `auto_exchange_rate` viene apagada por defecto, así que toda
 * tienda nueva arranca con tasa a mano — y hasta ahora nada en el panel decía
 * de cuándo era. El comerciante la ponía el primer día, se olvidaba, y semanas
 * después estaba vendiendo con una tasa que ya no existe. Eso es plata: o vende
 * por debajo, o el cliente transfiere un monto que no cuadra y le rechazan el
 * pago.
 *
 * Por eso muestra las dos cosas juntas: cuánto vale el dólar hoy en su tienda
 * y de cuándo es ese número.
 */

/** Días a partir de los cuales la tasa se marca como vieja. */
const STALE_DAYS = 7;
/** Días a partir de los cuales conviene mencionar la antigüedad, sin alarmar. */
const AGING_DAYS = 3;

interface ExchangeRateCardProps {
  rate: number | null;
  updatedAt: string | null;
  auto: boolean;
  showBs: boolean;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, differenceInCalendarDays(new Date(), then));
}

/** "hoy" / "ayer" / "hace 5 días" — cómo lo diría una persona. */
function ageLabel(days: number | null): string {
  if (days === null) return "sin fecha";
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

export function ExchangeRateCard({
  rate,
  updatedAt,
  auto,
  showBs,
}: ExchangeRateCardProps) {
  // Sin precios en bolívares la tasa no afecta nada de lo que ve el comprador:
  // mostrarla sería ruido en la pantalla que el dueño mira todos los días.
  if (!showBs) return null;

  const days = daysSince(updatedAt);
  // La automática la refresca el cron todos los días: nunca se marca vieja.
  const stale = !auto && days !== null && days >= STALE_DAYS;
  const aging = !auto && days !== null && days >= AGING_DAYS && !stale;
  const missing = rate == null || rate <= 0;

  if (missing) {
    return (
      <section className="flex items-center justify-between gap-3 rounded-xl border border-warning/50 bg-warning/[0.06] px-3.5 py-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">
              Todavía no pusiste la tasa del día
            </p>
            <p className="text-xs text-muted-foreground">
              Tu tienda muestra precios en Bs y sin tasa no puede calcularlos.
            </p>
          </div>
        </div>
        <Link
          href="/panel/configuracion"
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Poner tasa <ArrowRight className="size-4" />
        </Link>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-2.5",
        stale && "border-warning/50 bg-warning/[0.06]",
      )}
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-1.5 leading-tight">
          <span className="text-base font-bold tabular-nums">{formatBs(rate)}</span>
          <span className="text-xs text-muted-foreground">por dólar</span>
          {auto && (
            <span className="inline-flex items-center gap-1 text-2xs font-medium text-primary">
              <RefreshCw className="size-3" /> automática
            </span>
          )}
        </p>
        <p
          className={cn(
            "truncate text-xs",
            stale ? "font-medium text-warning-foreground" : "text-muted-foreground",
          )}
        >
          {stale && <TriangleAlert className="mr-1 inline size-3.5 align-[-2px]" />}
          {auto
            ? `Tasa del BCV · ${ageLabel(days)}`
            : stale
              ? `La pusiste ${ageLabel(days)}. Conviene revisarla.`
              : aging
                ? `Tasa que pusiste ${ageLabel(days)}`
                : `Tasa actualizada ${ageLabel(days)}`}
        </p>
      </div>

      <Link
        href="/panel/configuracion"
        className={cn(
          // 44 px de alto aunque la tarjeta sea chica: es el mínimo táctil del
          // panel y el dueño lo toca desde el celular.
          "inline-flex h-11 shrink-0 items-center gap-1 rounded-lg px-3.5 text-sm font-semibold",
          stale
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border hover:bg-muted",
        )}
      >
        {stale ? "Revisar" : "Cambiar"}
        <ArrowRight className="size-4" />
      </Link>
    </section>
  );
}
