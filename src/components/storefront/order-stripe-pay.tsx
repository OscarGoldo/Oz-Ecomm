"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StripeEmbedded } from "@/components/storefront/stripe-embedded";
import { retryStripeCheckout } from "@/app/(public)/[store_slug]/checkout/actions";
import { formatUSD } from "@/lib/format";

/**
 * Pagar (o reintentar) con tarjeta un pedido que quedó esperando.
 *
 * Es la segunda mitad del checkout con Stripe: el cliente abrió el formulario,
 * cerró la pestaña, y vuelve por el enlace de su pedido. Abre otra sesión para
 * el MISMO pedido, con el mismo total — no crea un pedido nuevo.
 */
export function OrderStripePay({
  orderId,
  total,
  justReturned,
}: {
  orderId: string;
  total: number;
  /** Volvió del pago recién: puede que el cobro todavía se esté acreditando. */
  justReturned?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

  async function pay() {
    setBusy(true);
    const res = await retryStripeCheckout(orderId);
    setBusy(false);
    if (!res.ok || !res.clientSecret) {
      return toast.error(res.error ?? "No se pudo iniciar el pago");
    }
    setClientSecret(res.clientSecret);
  }

  if (clientSecret) {
    return (
      <div className="mt-6">
        <StripeEmbedded
          clientSecret={clientSecret}
          publishableKey={publishableKey}
        />
      </div>
    );
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
      {publishableKey ? (
        <Button className="mt-3 w-full" size="lg" onClick={pay} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <CreditCard />}
          Pagar {formatUSD(total)} con tarjeta
        </Button>
      ) : (
        <p className="mt-3 text-sm text-destructive">
          El pago con tarjeta no está configurado correctamente.
        </p>
      )}
    </div>
  );
}
