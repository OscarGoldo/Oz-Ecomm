"use server";

import { recordEvent, recordVisit } from "@/lib/analytics";

/**
 * Fired once when someone lands on the store from outside (another site, an
 * app or a typed address). The referrer and the `utm_source` of the link only
 * exist in the browser, so the client sends them.
 */
export async function trackVisit(
  storeId: string,
  referrer: string | null,
  tag: string | null,
): Promise<void> {
  await recordVisit(storeId, referrer?.slice(0, 500) ?? null, tag?.slice(0, 60) ?? null);
}

/** Fired from the product detail page (client) once per view. */
export async function trackProductView(
  storeId: string,
  productId: string,
): Promise<void> {
  await recordEvent(storeId, "product_view", productId);
}

/** Fired when the checkout page mounts. */
export async function trackCheckoutStart(storeId: string): Promise<void> {
  await recordEvent(storeId, "checkout_start");
}
