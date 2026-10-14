import { daysUntilExpiry, isPro } from "@/lib/plans";
import { EXPIRING_DAYS, type StoreStat } from "@/lib/super-segments";

/**
 * Cómo se escriben las fechas y el plan en el super admin. Se formatea en el
 * servidor y se pasa ya como texto a las tablas del navegador: "hace 3 d"
 * calculado dos veces, una en cada lado, es una diferencia de hidratación
 * esperando a pasar.
 */

const DAY_MS = 86_400_000;

// Con la zona fija: Vercel corre en UTC y una tienda creada a las 9 de la
// noche en Caracas saldría con la fecha del día siguiente.
const DAY_MONTH = new Intl.DateTimeFormat("es-VE", {
  day: "numeric",
  month: "short",
  timeZone: "America/Caracas",
});
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("es-VE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Caracas",
});
const YEAR = new Intl.DateTimeFormat("es-VE", {
  year: "numeric",
  timeZone: "America/Caracas",
});

/** "8 oct", o "8 oct 2025" si no es de este año. */
export function shortDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  return YEAR.format(d) === YEAR.format(now)
    ? DAY_MONTH.format(d)
    : DAY_MONTH_YEAR.format(d);
}

/**
 * Una fecha de calendario que llega como medianoche UTC (la de llegada de un
 * depósito de Stripe). Pasarla a hora de Caracas la corre al día anterior.
 */
export function calendarDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-VE", {
    day: "numeric",
    month: "short",
    ...(d.getUTCFullYear() === now.getUTCFullYear() ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(d);
}

/** Siempre con año, para el `title` y para exportar. */
export function fullDate(iso: string): string {
  return DAY_MONTH_YEAR.format(new Date(iso));
}

/** "hoy", "ayer", "hace 9 d", y pasado el mes la fecha. */
export function agoShort(iso: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 31) return `hace ${days} d`;
  return shortDate(iso, now);
}

/** Para un feed de actividad: "ahora", "hace 5 min", "hace 3 h", y después como agoShort. */
export function agoTime(iso: string, now = new Date()): string {
  const min = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (min < 24 * 60) return `hace ${Math.floor(min / 60)} h`;
  return agoShort(iso, now);
}

export interface PlanBadge {
  label: string;
  variant: "success" | "info" | "neutral" | "danger";
  /** La línea chica de abajo: cuándo vence o por qué está en rojo. */
  sub: string | null;
}

/** El plan de una tienda de un vistazo, con el vencimiento si importa. */
export function planBadge(s: StoreStat, now = new Date()): PlanBadge {
  if (!isPro(s)) return { label: "Gratis", variant: "neutral", sub: null };

  const comp = s.plan_source === "comp";
  const label = comp ? "Cortesía" : "Pro";
  const autoRenew =
    s.stripe_subscription_status === "active" ||
    s.paypal_subscription_status === "active";
  const failed =
    s.stripe_subscription_status === "suspended" ||
    s.paypal_subscription_status === "suspended";
  const days = daysUntilExpiry(s);

  if (failed) return { label, variant: "danger", sub: "cobro fallido" };
  if (days === null) {
    return { label, variant: comp ? "info" : "success", sub: "no vence" };
  }
  if (autoRenew) {
    return {
      label,
      variant: "success",
      sub: `se renueva el ${shortDate(s.plan_expires_at!, now)}`,
    };
  }
  if (days <= EXPIRING_DAYS) {
    return {
      label,
      variant: "danger",
      sub: days <= 0 ? "vence hoy" : days === 1 ? "vence mañana" : `vence en ${days} d`,
    };
  }
  return {
    label,
    variant: comp ? "info" : "success",
    sub: `vence el ${shortDate(s.plan_expires_at!, now)}`,
  };
}
