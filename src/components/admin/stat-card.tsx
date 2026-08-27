import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";

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
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-2xs font-semibold",
        up ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive",
      )}
    >
      <Icon className="size-3" />
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
        "h-full rounded-2xl border bg-card p-4 shadow-sm transition-colors",
        highlight &&
          (tone === "primary"
            ? "border-primary/40 bg-primary/5"
            : "border-warning/50 bg-warning/5"),
        href && "hover:border-primary/50",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="shrink-0 text-muted-foreground/70">{icon}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-2xl font-extrabold leading-none tracking-tight">{value}</p>
        {delta?.pct != null && <DeltaChip pct={delta.pct} />}
      </div>

      {sub && <p className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</p>}

      {delta && (
        <p className="mt-1.5 truncate text-2xs text-muted-foreground">
          vs. {delta.previousLabel} {delta.periodLabel}
        </p>
      )}

      {hint && (
        <p
          className={cn(
            "mt-1.5 truncate text-2xs font-medium",
            highlight && tone === "warning"
              ? "text-warning-foreground"
              : "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
