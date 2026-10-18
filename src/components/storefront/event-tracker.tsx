"use client";

import { useEffect } from "react";

import { trackCheckoutStart, trackProductView, trackVisit } from "@/lib/analytics-actions";

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

/**
 * Registra una entrada a la tienda y de dónde vino. Va en el layout de la
 * tienda: corre una vez por carga completa de página, y si la página anterior
 * era de la misma tienda no es una entrada sino un paso dentro de la visita.
 */
export function VisitTracker({ storeId }: { storeId: string }) {
  useFireOnce("visit", () => {
    const referrer = document.referrer;
    try {
      if (referrer && new URL(referrer).host === window.location.host) return;
    } catch {
      // Un referrer raro no es de esta tienda: cuenta como entrada.
    }
    const tag = new URLSearchParams(window.location.search).get("utm_source");
    void trackVisit(storeId, referrer || null, tag);
  });
  return null;
}

/**
 * Los efectos de la página corren antes que el del layout, así que sin esto
 * quien entra directo a un producto registraba la vista antes que la visita, y
 * la vista quedaba sin origen. Con un `setTimeout` la visita sale primero, y
 * Next corre las acciones del servidor de a una, en orden: cuando sale la
 * vista, la cookie con el origen ya está puesta.
 */
function afterEntry(run: () => void) {
  setTimeout(run, 0);
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
    afterEntry(() => void trackProductView(storeId, productId));
  });
  return null;
}

/** Records a checkout_start when the checkout page mounts. */
export function CheckoutStartTracker({ storeId }: { storeId: string }) {
  useFireOnce("checkout", () => {
    afterEntry(() => void trackCheckoutStart(storeId));
  });
  return null;
}
