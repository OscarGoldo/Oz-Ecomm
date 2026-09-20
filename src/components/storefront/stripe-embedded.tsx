"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";

/**
 * El formulario de pago de Stripe, dentro de nuestra página.
 *
 * Es la misma sesión de Checkout que antes abría una página aparte: mismo
 * monto calculado en el servidor, mismo webhook confirmando. Lo único que
 * cambia es dónde se pinta — y que arriba del formulario aparecen Apple Pay y
 * Google Pay cuando el dispositivo los tiene.
 *
 * El `clientSecret` no sirve para cobrar nada: solo deja mostrar y pagar ESA
 * sesión, cuyo monto ya está fijado del lado del servidor.
 */

/**
 * Se carga una sola vez por pestaña, fuera del componente: `loadStripe` inyecta
 * un script y volver a llamarlo en cada render haría parpadear el formulario.
 */
let stripePromise: Promise<Stripe | null> | null = null;

function stripe(publishableKey: string) {
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

export function StripeEmbedded({
  clientSecret,
  publishableKey,
}: {
  clientSecret: string;
  publishableKey: string;
}) {
  if (!publishableKey) {
    return (
      <p className="text-sm text-destructive">
        El pago con tarjeta no está configurado correctamente.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white p-1">
      {/* Fondo blanco fijo: el formulario de Stripe se pinta claro y sobre un
          tema oscuro de la tienda quedaría ilegible. */}
      <EmbeddedCheckoutProvider
        stripe={stripe(publishableKey)}
        options={{ clientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
