"use server";

import { recordEvent } from "@/lib/analytics";

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
