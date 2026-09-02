import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Delta } from "@/lib/metrics";

/**
 * La tarjeta de métrica del panel. Vive acá y no en cada página porque
 * Resumen, Analítica y Finanzas mostraban el mismo dato con tres diseños
 * distintos —tamaños de número, posición del ícono y del subtítulo— y eso
 * es justo lo que hace que un panel se vea armado a pedazos.
 *
 * El patrón: label chico y gris arriba a la izquierda, ícono discreto
 * arriba a la derecha, el número grande y protagonista debajo, y opcional
 * el chip de variación con la comparación contra el período anterior.
 *
 * El número va en la display con cifras tabulares. En una fila de cuatro
 * métricas, que los dígitos tengan todos el mismo ancho es lo que hace que
 * las tarjetas se lean como una tabla y no como cuatro cajas sueltas.
 */

/**
 * Chip de variación: verde si subió, rojo si bajó. No se dibuja cuando no
 * hay porcentaje calculable (el período anterior fue cero).
 */
export function DeltaChip({ pct }: { pct: number }) {
  const up = pct >= 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded border px-1.5 py-px",
        "text-3xs font-bold leading-4 tabular-nums",
        up
          ? "border-success-border bg-success-surface text-success-text"
          : "border-destructive-border bg-destructive-surface text-destructive-text",
      )}
    >
      <Icon className="size-2.5" strokeWidth={2.75} />
      {Math.abs(pct).toFixed(1).replace(".", ",")}%
    </span>
  );
}

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** Segunda línea bajo el número (equivalente en Bs, conteo, etc.). */
  sub?: string;
  /** Comparación con el período anterior, para las métricas que la tienen. */
  delta?: Delta;
  /**
   * Para los contadores de estado (por confirmar, bajo stock): no son una
   * tendencia, así que en vez de un chip de variación que no significaría
   * nada llevan la acción que hay que hacer con ese número.
   */
  hint?: string;
  /** Si se pasa, la tarjeta entera es el enlace. */
  href?: string;
  highlight?: boolean;
  /** Con qué color se resalta: ámbar avisa, azul solo destaca. */
  tone?: "warning" | "primary";
}

export function StatCard({
  icon,
  label,
  value,
  sub,
  delta,
  hint,
  href,
  highlight,
  tone = "warning",
}: StatCardProps) {
  const body = (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-xl border border-border bg-card p-3.5",
        "shadow-xs transition-[border-color,box-shadow] duration-150 ease-out",
        // El resalte se apoya en el borde y en una franja superior, no en un
        // fondo teñido: el fondo de color en una tarjeta de dato le compite al
        // número, que es lo único que hay que leer.
        highlight &&
          (tone === "primary"
            ? "border-brand-300"
            : "border-warning-border bg-warning-surface/30"),
        href && "hover:border-ink-300 hover:shadow-sm",
      )}
    >
      {highlight && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-x-3.5 top-0 h-[2px] rounded-full",
            tone === "primary" ? "bg-brand-500" : "bg-warning",
          )}
        />
      )}

      <div className="mb-2.5 flex items-start justify-between gap-2">
        <span className="text-2xs font-medium leading-4 text-ink-500">{label}</span>
        <span className="shrink-0 text-ink-400">{icon}</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {/* En móvil la tarjeta mide ~165px y una venta de cinco cifras a
            28px se sale. El escalón chico entra siempre; el grande aparece
            recién cuando hay ancho para sostenerlo. */}
        <p className="font-display text-2xl font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[1.75rem]">
          {value}
        </p>
        {delta?.pct != null && <DeltaChip pct={delta.pct} />}
      </div>

      {sub && (
        <p className="mt-1.5 truncate text-xs tabular-nums text-ink-500">{sub}</p>
      )}

      {delta && (
        <p className="mt-1.5 truncate text-2xs text-ink-400">
          vs. {delta.previousLabel} {delta.periodLabel}
        </p>
      )}

      {hint && (
        <p
          className={cn(
            "mt-auto flex items-center gap-1 truncate pt-2.5 text-2xs font-medium",
            highlight && tone === "warning" ? "text-warning-text" : "text-ink-500",
          )}
        >
          {hint}
          {href && <ArrowUpRight className="size-3 shrink-0" />}
        </p>
      )}
    </div>
  );

  return href ? (
    <Link
      href={href}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {body}
    </Link>
  ) : (
    body
  );
}
