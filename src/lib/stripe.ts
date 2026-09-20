// Stripe, lado servidor. La clave secreta nunca sale de acá.
//
// Modelo: UNA cuenta de la plataforma (Canadá) para todas las tiendas, igual
// que PayPal. Lo que se le debe a cada comerciante se liquida en /super/pagos.
// No es Stripe Connect: no hay cuentas conectadas ni KYC por tienda.
//
// Variables de entorno:
//   STRIPE_SECRET_KEY        — sk_live_… / sk_test_… (solo servidor)
//   STRIPE_WEBHOOK_SECRET    — whsec_… del endpoint /api/stripe/webhook
//   STRIPE_PRICE_MONTHLY     — id del precio recurrente mensual del plan Pro
//   STRIPE_PRICE_YEARLY      — id del precio recurrente anual del plan Pro
//
// A diferencia de PayPal, no hay client id público: el checkout de Stripe es
// una redirección a una página alojada por ellos, así que el navegador no
// necesita ninguna credencial.

import Stripe from "stripe";

let cached: Stripe | null = null;

/** El cliente de Stripe, o null si no está configurado. */
export function getStripe(): Stripe | null {
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, {
      // Sin apiVersion: se usa la que trae fijada el SDK instalado, que es la
      // que corresponde a sus tipos. Fijarla a mano acá es la forma clásica de
      // que los tipos y la respuesta real dejen de coincidir.
      typescript: true,
      appInfo: { name: "Tiendify" },
    });
  }
  return cached;
}

export function stripeConfigured(): boolean {
  return Boolean((process.env.STRIPE_SECRET_KEY ?? "").trim());
}

export function stripeWebhookSecret(): string | null {
  return (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim() || null;
}

/** ¿Es una clave de prueba? Solo para avisar en la UI de super admin. */
export function stripeIsTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").trim().startsWith("sk_test");
}

/**
 * El precio recurrente del plan Pro para ese período, si existe.
 *
 * Misma regla que `planIdFor` en paypal-subscriptions.ts: un período sin
 * precio recurrente devuelve null y la UI cae al cobro único. Devolver el
 * precio mensual para un período de tres meses sería cobrarle al comerciante
 * un débito mensual cuando creía estar pagando un trimestre.
 */
export function stripePriceFor(months: number): string | null {
  let id: string | undefined;
  if (months >= 12) id = process.env.STRIPE_PRICE_YEARLY;
  else if (months === 1) id = process.env.STRIPE_PRICE_MONTHLY;
  else return null;
  return (id ?? "").trim() || null;
}

/** ¿Está todo lo necesario para cobrar el plan recurrente por Stripe? */
export function stripeSubscriptionsConfigured(): boolean {
  return (
    stripeConfigured() && stripePriceFor(1) !== null && stripePriceFor(12) !== null
  );
}

/** USD → centavos, que es la unidad con la que trabaja Stripe. */
export function toCents(usd: number): number {
  return Math.round(usd * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export interface ChargeBreakdown {
  /** Comisión de Stripe, en USD. */
  fee: number;
  /** Lo que queda después de la comisión, en USD. */
  net: number;
  paymentIntentId: string | null;
  chargeId: string | null;
}

/**
 * Comisión y neto reales de un cobro, para que /super/pagos sepa cuánto se le
 * debe de verdad al comerciante.
 *
 * Ojo con la moneda: la cuenta es canadiense y cobramos en USD. Si Stripe
 * liquida en CAD, el balance transaction viene en CAD y su `fee` también. Se
 * convierte de vuelta a USD con el `exchange_rate` del mismo balance
 * transaction — si no, estaríamos guardando dólares y loonies en la misma
 * columna y las cuentas de los payouts saldrían mal.
 *
 * Nunca lanza: si algo falla devuelve null y el pedido se confirma igual sin
 * el desglose (cae al net = total, como los pedidos viejos de PayPal).
 */
export async function chargeBreakdown(
  stripe: Stripe,
  paymentIntentId: string,
): Promise<ChargeBreakdown | null> {
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    const charge = pi.latest_charge;
    if (!charge || typeof charge === "string") return null;
    const bt = charge.balance_transaction;
    if (!bt || typeof bt === "string") return null;

    const rate =
      bt.currency !== "usd" && bt.exchange_rate ? bt.exchange_rate : 1;
    const round = (cents: number) => Math.round((cents / 100 / rate) * 100) / 100;

    return {
      fee: round(bt.fee),
      net: round(bt.net),
      paymentIntentId: pi.id,
      chargeId: charge.id,
    };
  } catch {
    return null;
  }
}

/** La URL pública de la app, para armar los success_url / cancel_url. */
export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
