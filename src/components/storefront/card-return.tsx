"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";

import { finalizeCardOrder } from "@/app/(public)/[store_slug]/checkout/actions";

/**
 * Termina un pago que pasó por la verificación del banco.
 *
 * Corre en el navegador a propósito: así puede vaciar el carrito y contar la
 * compra, cosas que necesitan las cookies del visitante y que el webhook no
 * puede hacer.
 *
 * Reintenta un par de veces porque el cobro puede tardar un segundo en quedar
 * en `succeeded` del lado de Stripe.
 */
export function CardReturn({
  storeSlug,
  paymentIntentId,
  redirectStatus,
}: {
  storeSlug: string;
  paymentIntentId: string | null;
  redirectStatus: string | null;
}) {
  const router = useRouter();
  const [failed, setFailed] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!paymentIntentId) {
      setFailed("No encontramos el pago. Escríbele a la tienda.");
      return;
    }
    if (redirectStatus === "failed") {
      setFailed("El banco rechazó el pago. Puedes intentarlo de nuevo.");
      return;
    }

    let cancelled = false;
    (async () => {
      for (let intento = 0; intento < 4; intento++) {
        const res = await finalizeCardOrder(paymentIntentId, {
          fromBrowser: true,
        });
        if (cancelled) return;
        if (res.ok && res.orderId) {
          router.replace(`/${storeSlug}/pedido/${res.orderId}`);
          return;
        }
        // Todavía procesando del lado de Stripe: se espera y se reintenta.
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!cancelled) {
        setFailed(
          "Tu pago se está procesando. Si te llegó el cobro y no ves tu pedido en unos minutos, escríbele a la tienda.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paymentIntentId, redirectStatus, router, storeSlug]);

  if (failed) {
    return (
      <>
        <AlertTriangle className="mb-3 size-8 text-warning" />
        <p className="text-sm text-muted-foreground">{failed}</p>
      </>
    );
  }

  return (
    <>
      <Loader2 className="mb-3 size-8 animate-spin text-primary" />
      <p className="font-medium">Confirmando tu pago…</p>
      <p className="mt-1 text-sm text-muted-foreground">
        No cierres esta página, es solo un momento.
      </p>
    </>
  );
}
