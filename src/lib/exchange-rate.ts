import { formatBs } from "@/lib/format";
import type { ExchangeRateSource } from "@/types/database";

// ── De dónde sale la tasa de la tienda ──────────────────────────────────────

/**
 * El comerciante elige con qué tasa se calculan sus bolívares: dólar BCV, euro
 * BCV o USDT, con un ajuste opcional en % ("USDT − 2 %"). El cron de cada hora
 * (api/cron/bcv) y el guardado de Ajustes hacen la misma cuenta y la escriben
 * en `stores.exchange_rate`, que es lo único que leen la tienda, el checkout y
 * Finanzas.
 *
 * El USDT se nombra solo dentro del panel. Afuera, una tienda que usa el USDT
 * o una tasa con ajuste muestra "Tasa del día" sin decir de dónde sale (ver
 * lib/usdt.ts por qué).
 */
export const RATE_SOURCES: Record<ExchangeRateSource, { name: string; sym: string }> = {
  bcv_usd: { name: "Dólar BCV", sym: "$" },
  bcv_eur: { name: "Euro BCV", sym: "€" },
  usdt: { name: "USDT", sym: "₮" },
};

export const MARGIN_MIN = -50;
export const MARGIN_MAX = 100;

/** Lo que una tienda necesita para saber de dónde sale su tasa. */
export interface StoreRateFields {
  auto_exchange_rate?: boolean | null;
  exchange_rate_source?: ExchangeRateSource | null;
  exchange_rate_margin?: number | string | null;
  currency_primary?: string | null;
}

export interface RateSettings {
  /** false: la tasa la pone el comerciante y no se toca. */
  auto: boolean;
  source: ExchangeRateSource;
  /** Ajuste en %: 0, −2, 10… */
  margin: number;
}

/**
 * La tasa de la tienda, con los valores de antes de la migración 0036 cuando
 * faltan: dólar BCV sin ajuste, o euro BCV si la tienda cobra en euros (lo que
 * ya hacía el cron).
 */
export function rateSettings(store: StoreRateFields): RateSettings {
  const margin = Number(store.exchange_rate_margin ?? 0);
  return {
    auto: store.auto_exchange_rate ?? false,
    source:
      store.exchange_rate_source ??
      (store.currency_primary === "EUR" ? "bcv_eur" : "bcv_usd"),
    margin: Number.isFinite(margin) ? margin : 0,
  };
}

/** Las tasas de donde puede salir la de una tienda, en bolívares. */
export interface RateInputs {
  usd: number | null;
  eur: number | null;
  usdt: number | null;
}

export function baseRate(source: ExchangeRateSource, inputs: RateInputs): number | null {
  const value = source === "usdt" ? inputs.usdt : source === "bcv_eur" ? inputs.eur : inputs.usd;
  return value != null && value > 0 ? Number(value) : null;
}

/** La base con el ajuste, a dos decimales: es lo que se guarda y se ve. */
export function applyMargin(base: number, margin: number): number {
  return Math.round(base * (1 + margin / 100) * 100) / 100;
}

/** La tasa automática que le toca a la tienda hoy, o null si falta la base. */
export function autoRate(settings: RateSettings, inputs: RateInputs): number | null {
  const base = baseRate(settings.source, inputs);
  return base == null ? null : applyMargin(base, settings.margin);
}

/** "+ 10 %", "− 2,5 %" o "" sin ajuste. */
export function marginLabel(margin: number): string {
  if (!margin) return "";
  const abs = Math.abs(margin).toLocaleString("es-VE", { maximumFractionDigits: 2 });
  return `${margin > 0 ? "+" : "−"} ${abs} %`;
}

/** "USDT − 2 %", "Dólar BCV": cómo se llama la tasa en el panel. */
export function rateSourceLabel(settings: Pick<RateSettings, "source" | "margin">): string {
  const name = RATE_SOURCES[settings.source].name;
  const adj = marginLabel(settings.margin);
  return adj ? `${name} ${adj}` : name;
}

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
  /** Del dólar o del euro: el cartel dice cuál. */
  currency: "usd" | "eur";
}

/**
 * La tasa BCV contra la que se compara la de una tienda, igual que en el cron.
 *
 * Null si la tienda se actualiza sola con el USDT o con un ajuste: ahí su tasa
 * no es la del BCV aunque un día coincida, y decir "Tasa BCV" sería mentir.
 */
export function bcvReference(
  store: StoreRateFields,
  rates: { usd: number | null; eur: number | null; source_date: string | null } | null | undefined,
): BcvReference | null {
  if (!rates) return null;
  const s = rateSettings(store);
  if (s.auto && (s.source === "usdt" || s.margin !== 0)) return null;
  // La fija se compara con la del BCV de su moneda, como siempre.
  const eur = s.auto ? s.source === "bcv_eur" : store.currency_primary === "EUR";
  return {
    rate: eur ? rates.eur : rates.usd,
    date: rates.source_date,
    currency: eur ? "eur" : "usd",
  };
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
    // Con el euro no va "/ USD": "Tasa euro BCV: Bs 250 / USD" se lee como
    // una contradicción. El número es el mismo que multiplica los precios.
    return bcv?.currency === "eur"
      ? { label: `Tasa euro BCV del ${bcvDateLabel(valueDate)}: ${formatBs(rate)}`, stale }
      : { label: `Tasa BCV del ${bcvDateLabel(valueDate)}: ${amount}`, stale };
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
