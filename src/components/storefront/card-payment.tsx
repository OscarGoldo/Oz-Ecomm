"use client";

import { useEffect, useRef, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Appearance, type Stripe } from "@stripe/stripe-js";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  finalizeCardOrder,
  syncCardPayment,
  type CheckoutInput,
} from "@/app/(public)/[store_slug]/checkout/actions";
import { formatUSD } from "@/lib/format";

/**
 * Los campos de la tarjeta, dentro del checkout.
 *
 * El orden es al revés del resto: primero se cobra, después nace el pedido. Por
 * eso el formulario puede aparecer apenas el cliente elige "Tarjeta" sin
 * ensuciarle el panel al comerciante con pedidos de gente que solo mira.
 *
 * El monto no se toca desde acá: lo calcula el servidor y lo vuelve a calcular
 * antes de cobrar. Lo único que viaja al navegador es el `clientSecret`, que
 * sirve para pagar ESE cobro y nada más.
 */

/** `loadStripe` inyecta un script: una sola vez por pestaña, no por render. */
let stripePromise: Promise<Stripe | null> | null = null;
function stripeJs(publishableKey: string) {
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

/**
 * Claro u oscuro según el fondo real de la tienda. Las plantillas oscuras
 * existen y un formulario blanco encima se ve como un error.
 */
function themeForPage(): Appearance["theme"] {
  try {
    const bg = getComputedStyle(document.body).backgroundColor;
    const [r, g, b] = (bg.match(/\d+/g) ?? ["255", "255", "255"]).map(Number);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5 ? "night" : "stripe";
  } catch {
    return "stripe";
  }
}

export function CardPayment({
  publishableKey,
  storeSlug,
  total,
  getDraftInput,
  getInput,
  onPaid,
}: {
  publishableKey: string;
  storeSlug: string;
  /** Total calculado en el cliente. Solo sirve para saber CUÁNDO resincronizar. */
  total: number;
  /** Lo mínimo para calcular el monto: puede faltar el nombre o el email. */
  getDraftInput: () => CheckoutInput;
  /** El formulario completo y validado, o null si falta algo. */
  getInput: () => CheckoutInput | null;
  onPaid: (orderId: string) => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Appearance["theme"]>("stripe");
  const paymentIntentId = useRef<string | null>(null);

  useEffect(() => setTheme(themeForPage()), []);

  // Abre el cobro al montar, y le ajusta el monto cada vez que el total cambia
  // (un cupón, el envío). El `clientSecret` se fija una sola vez a propósito:
  // cambiarlo remontaría el formulario y le borraría al cliente lo que escribió.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await syncCardPayment(
        getDraftInput(),
        paymentIntentId.current ?? undefined,
      );
      if (cancelled) return;
      if (!res.ok || !res.clientSecret) {
        setError(res.error ?? "No se pudo iniciar el pago");
        return;
      }
      paymentIntentId.current = res.paymentIntentId ?? null;
      setError(null);
      setClientSecret((prev) => prev ?? res.clientSecret!);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  if (!publishableKey) {
    return (
      <p className="text-sm text-destructive">
        El pago con tarjeta no está configurado correctamente.
      </p>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Preparando el pago…
      </div>
    );
  }

  return (
    <Elements
      stripe={stripeJs(publishableKey)}
      options={{ clientSecret, appearance: { theme }, locale: "es" }}
    >
      <CardForm
        storeSlug={storeSlug}
        total={total}
        getInput={getInput}
        onPaid={onPaid}
      />
    </Elements>
  );
}

function CardForm({
  storeSlug,
  total,
  getInput,
  onPaid,
}: {
  storeSlug: string;
  total: number;
  getInput: () => CheckoutInput | null;
  onPaid: (orderId: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [ready, setReady] = useState(false);

  async function pay() {
    if (!stripe || !elements) return;

    // Marca los campos que falten y devuelve al paso 1 si hace falta.
    const input = getInput();
    if (!input) return;

    setPaying(true);

    // La sincronización final es la que congela el pedido entero —con los datos
    // del cliente— del lado del servidor. Sin esto, un cobro cuyo navegador no
    // vuelve no se podría convertir en pedido desde el webhook.
    const sync = await syncCardPayment(input);
    if (!sync.ok) {
      setPaying(false);
      return toast.error(sync.error ?? "No se pudo preparar el pago");
    }
    // El monto pudo haberse movido entre que se montó el formulario y ahora.
    await elements.fetchUpdates();

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Solo se usa si el banco pide verificación y saca al cliente de la
        // página. Al volver, esa ruta termina de crear el pedido.
        return_url: `${window.location.origin}/${storeSlug}/checkout/procesando`,
      },
      redirect: "if_required",
    });

    if (error) {
      setPaying(false);
      return toast.error(error.message ?? "No se pudo procesar el pago");
    }
    if (paymentIntent?.status !== "succeeded") {
      setPaying(false);
      return toast.error("El pago no se completó. Intenta de nuevo.");
    }

    const created = await finalizeCardOrder(paymentIntent.id, {
      fromBrowser: true,
    });
    if (!created.ok || !created.orderId) {
      setPaying(false);
      // La plata ya salió: el mensaje NO puede decir que falló la compra.
      return toast.error(
        created.error ??
          "Tu pago se procesó pero no pudimos mostrar el pedido. Escríbele a la tienda.",
      );
    }
    onPaid(created.orderId);
  }

  return (
    <div className="space-y-3">
      <PaymentElement onReady={() => setReady(true)} />
      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={pay}
        disabled={!stripe || !ready || paying}
      >
        {paying ? <Loader2 className="animate-spin" /> : <Lock />}
        Pagar {formatUSD(total)}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Pago seguro con Stripe. No guardamos los datos de tu tarjeta.
      </p>
    </div>
  );
}
