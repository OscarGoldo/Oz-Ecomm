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

/** La tasa del BCV que le toca a una tienda, con su fecha valor. */
export interface BcvReference {
  rate: number | null;
  /** Fecha valor: desde qué día rige. */
  date: string | null;
}

/** La tasa BCV que le toca a una tienda según su moneda, igual que en el cron. */
export function bcvReference(
  currency: string | null | undefined,
  rates: { usd: number | null; eur: number | null; source_date: string | null } | null | undefined,
): BcvReference | null {
  if (!rates) return null;
  return { rate: currency === "EUR" ? rates.eur : rates.usd, date: rates.source_date };
}

/**
 * La fecha valor de la tasa BCV que la tienda está cobrando, o null si cobra
 * otra.
 *
 * Se compara el número y no `auto_exchange_rate`: el automático solo promete
 * que el cron la va a pisar, no que ya lo hizo (ver exchange-rate-card.tsx). A
 * los dos decimales que se ven, porque "Usar esta tasa" la guarda redondeada.
 */
export function bcvValueDate(
  rate: number | null | undefined,
  bcv: BcvReference | null | undefined,
): string | null {
  if (!rate || !bcv?.rate || !bcv.date) return null;
  return Math.round(Number(rate) * 100) === Math.round(Number(bcv.rate) * 100)
    ? bcv.date
    : null;
}

/** "lunes 19 de octubre": el día desde el que rige una tasa del BCV. */
export function bcvDateLabel(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("es-VE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Caracas",
    })
    .replace(",", "");
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
 * Con `bcv`, si la tienda cobra justo la del BCV se dice cuál, con su fecha
 * valor. El BCV publica en la tarde la del día hábil siguiente: un sábado la
 * tasa que corre es "del lunes 19", y llamarla "de hoy" sería decir otra cosa.
 *
 * Devuelve null cuando no hay nada honesto que decir (sin tasa cargada).
 */
export function rateInfo(
  rate: number | null | undefined,
  updatedAt: string | null | undefined,
  bcv?: BcvReference | null,
): RateInfo | null {
  if (!rate || rate <= 0) return null;

  const amount = `${formatBs(rate)} / USD`;
  const setAt = updatedAt ? new Date(updatedAt) : null;
  const stale = setAt
    ? (Date.now() - setAt.getTime()) / 3_600_000 > RATE_STALE_HOURS
    : false;

  const valueDate = bcvValueDate(rate, bcv);
  if (valueDate) {
    return { label: `Tasa BCV del ${bcvDateLabel(valueDate)}: ${amount}`, stale };
  }

  if (!setAt) {
    // Hay tasa pero no sabemos de cuándo: no se afirma que sea de hoy.
    return { label: `Tasa referencial: ${amount}`, stale };
  }

  const sameDay = new Date().toDateString() === setAt.toDateString();
  const when = sameDay
    ? "de hoy"
    : `del ${setAt.toLocaleDateString("es-VE", { day: "numeric", month: "long" })}`;

  return { label: `Tasa ${when}: ${amount}`, stale };
}
