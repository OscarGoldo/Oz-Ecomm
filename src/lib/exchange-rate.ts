import { formatBs } from "@/lib/format";

/**
 * Cuándo una tasa deja de ser creíble.
 *
 * 48 horas es el criterio: el BCV no publica los fines de semana, así que un
 * viernes por la tarde una tasa "de ayer" sigue siendo la vigente. Más que eso
 * y en Venezuela ya es otro precio.
 */
export const RATE_STALE_HOURS = 48;

export interface RateInfo {
  /** "Tasa del 17 de agosto" — nunca "de hoy" si no es de hoy. */
  label: string;
  /** Pasó la ventana: los bolívares se muestran como referenciales. */
  stale: boolean;
}

/**
 * Cómo presentarle la tasa al comprador.
 *
 * El cartel decía literalmente "Tasa de hoy" leyendo solo `exchange_rate`, sin
 * mirar `exchange_rate_updated_at` — una columna que existía desde la primera
 * migración y que no leía nadie. Un comerciante que se iba una semana dejaba su
 * tienda anunciando como "de hoy" una tasa de hace siete días: el cliente
 * transfería de menos y el que perdía la diferencia era el comerciante.
 *
 * Devuelve null cuando no hay nada honesto que decir (sin tasa cargada).
 */
export function rateInfo(
  rate: number | null | undefined,
  updatedAt: string | null | undefined,
): RateInfo | null {
  if (!rate || rate <= 0) return null;

  const amount = `${formatBs(rate)} / USD`;

  if (!updatedAt) {
    // Hay tasa pero no sabemos de cuándo: no se afirma que sea de hoy.
    return { label: `Tasa referencial: ${amount}`, stale: false };
  }

  const setAt = new Date(updatedAt);
  const hours = (Date.now() - setAt.getTime()) / 3_600_000;
  const stale = hours > RATE_STALE_HOURS;

  const sameDay = new Date().toDateString() === setAt.toDateString();
  const when = sameDay
    ? "de hoy"
    : `del ${setAt.toLocaleDateString("es-VE", { day: "numeric", month: "long" })}`;

  return { label: `Tasa ${when}: ${amount}`, stale };
}
