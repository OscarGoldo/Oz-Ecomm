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
