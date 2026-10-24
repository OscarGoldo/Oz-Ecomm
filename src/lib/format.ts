/**
 * Money + locale formatting helpers. Prices are stored in USD; Bs values are
 * derived from the store's exchange_rate (manually set by the owner).
 */

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format a Bs amount (Venezuelan bolívares) with es-VE grouping. */
export function formatBs(amount: number): string {
  const formatted = new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `Bs ${formatted}`;
}

/** Convert a USD amount to Bs using an exchange rate. Returns null if no rate. */
export function usdToBs(
  amountUsd: number,
  exchangeRate: number | null | undefined,
): number | null {
  if (!exchangeRate || exchangeRate <= 0) return null;
  return amountUsd * exchangeRate;
}

/** Both currencies in one shot for storefront display. */
export function formatDualPrice(
  amountUsd: number,
  exchangeRate: number | null | undefined,
): { usd: string; bs: string | null } {
  const bs = usdToBs(amountUsd, exchangeRate);
  return {
    usd: formatUSD(amountUsd),
    bs: bs === null ? null : formatBs(bs),
  };
}

// ── Fecha y hora de un pedido, en hora de Caracas ───────────────────────────
//
// Con la zona fija: Vercel corre en UTC, y date-fns formatea en la zona del
// servidor, así que un pedido de las 10 de la noche salía a las 2 de la
// madrugada del día siguiente. "es" y no "es-VE": escribe "oct" sin punto,
// como se veía antes.
const ORDER_TIME = new Intl.DateTimeFormat("es", {
  timeZone: "America/Caracas",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const SHORT_MONTH = new Intl.DateTimeFormat("es", {
  timeZone: "America/Caracas",
  month: "short",
});

function orderTimeParts(iso: string) {
  const d = new Date(iso);
  const p: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of ORDER_TIME.formatToParts(d)) p[part.type] = part.value;
  return {
    weekday: p.weekday ?? "",
    day: p.day ?? "",
    month: p.month ?? "",
    shortMonth: SHORT_MONTH.format(d),
    time: `${p.hour}:${p.minute}`,
  };
}

/** "24 de oct, 22:07" */
export function orderDateShort(iso: string): string {
  const t = orderTimeParts(iso);
  return `${t.day} de ${t.shortMonth}, ${t.time}`;
}

/** "24 de octubre, 22:07" */
export function orderDateLong(iso: string): string {
  const t = orderTimeParts(iso);
  return `${t.day} de ${t.month}, ${t.time}`;
}

/** "sábado 24 de octubre, 22:07" */
export function orderDateFull(iso: string): string {
  const t = orderTimeParts(iso);
  return `${t.weekday} ${t.day} de ${t.month}, ${t.time}`;
}
