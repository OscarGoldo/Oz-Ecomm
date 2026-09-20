"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { retryStripeCheckout } from "@/app/(public)/[store_slug]/checkout/actions";
import { formatUSD } from "@/lib/format";

/**
 * Pagar (o reintentar) con tarjeta un pedido que quedó esperando.
 *
 * Es la segunda mitad del checkout con Stripe: el cliente abrió la página de
 * pago, la cerró, y vuelve por el enlace de su pedido. Abre otra sesión para el
 * MISMO pedido, con el mismo total — no crea un pedido nuevo.
 */
export function OrderStripePay({
  orderId,
  total,
  justReturned,
}: {
  orderId: string;
  total: number;
  /** Volvió de Stripe recién: puede que el cobro todavía se esté acreditando. */
  justReturned?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    const res = await retryStripeCheckout(orderId);
    if (!res.ok || !res.url) {
      setBusy(false);
      return toast.error(res.error ?? "No se pudo iniciar el pago");
    }
    window.location.href = res.url;
  }

  return (
    <div className="mt-6 rounded-2xl border bg-card p-4 shadow-sm">
      {justReturned ? (
        <p className="text-sm text-muted-foreground">
          Estamos confirmando tu pago con el banco. Puede tardar unos segundos:
          recarga esta página en un momento. Si el pago no se completó, puedes
          intentarlo otra vez aquí.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Tu pedido está guardado y te esperamos para el pago. Nadie te cobró
          nada todavía.
        </p>
      )}
      <Button className="mt-3 w-full" size="lg" onClick={pay} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <CreditCard />}
        Pagar {formatUSD(total)} con tarjeta
      </Button>
    </div>
  );
}
