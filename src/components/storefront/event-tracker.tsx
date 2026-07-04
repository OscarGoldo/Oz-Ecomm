"use client";

import { useEffect } from "react";

import { trackCheckoutStart, trackProductView } from "@/lib/analytics-actions";

/** Keys already fired this page load — survives React strict-mode double-mount. */
const fired = new Set<string>();

function useFireOnce(key: string, run: () => void) {
  useEffect(() => {
    if (fired.has(key)) return;
    fired.add(key);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Records a product_view when the product detail page mounts. */
export function ProductViewTracker({
  storeId,
  productId,
}: {
  storeId: string;
  productId: string;
}) {
  useFireOnce(`view:${productId}`, () => {
    void trackProductView(storeId, productId);
  });
  return null;
}

/** Records a checkout_start when the checkout page mounts. */
export function CheckoutStartTracker({ storeId }: { storeId: string }) {
  useFireOnce("checkout", () => {
    void trackCheckoutStart(storeId);
  });
  return null;
}
