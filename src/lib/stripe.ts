// Stripe, lado servidor. La clave secreta nunca sale de acá.
//
// Modelo: UNA cuenta de la plataforma (Canadá) para todas las tiendas, igual
// que PayPal. Lo que se le debe a cada comerciante se liquida en /super/pagos.
// No es Stripe Connect: no hay cuentas conectadas ni KYC por tienda.
//
// Variables de entorno:
//   STRIPE_SECRET_KEY        — sk_live_… / sk_test_… (solo servidor)
//   STRIPE_WEBHOOK_SECRET    — whsec_… del endpoint /api/stripe/webhook
//   STRIPE_PRICE_MONTHLY     — precio recurrente mensual de las tiendas
//   STRIPE_PRICE_YEARLY        fundadoras (US$5 / US$50, ver lib/plans). Son los
//                              primeros que se crearon, por eso el nombre corto.
//   STRIPE_PRICE_LIST_MONTHLY — precio recurrente de lista, el de las tiendas
//   STRIPE_PRICE_LIST_YEARLY    nuevas (US$15 / US$150).
//
// A diferencia de PayPal, no hay client id público: el checkout de Stripe es
// una redirección a una página alojada por ellos, así que el navegador no
// necesita ninguna credencial.

import Stripe from "stripe";

import { reportError } from "@/lib/report-error";

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

/**
 * La clave pública, la única que puede vivir en el navegador. La necesita el
 * formulario embebido para hablar con Stripe; sin ella no se puede pintar.
 */
export function stripePublishableKey(): string {
  return (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").trim();
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
 * precio mensual para cualquier otro período sería cobrarle al comerciante un
 * débito mensual cuando creía estar pagando otra cosa.
 */
export function stripePriceFor(months: number, founder: boolean): string | null {
  const env = process.env;
  let id: string | undefined;
  if (months >= 12) id = founder ? env.STRIPE_PRICE_YEARLY : env.STRIPE_PRICE_LIST_YEARLY;
  else if (months === 1) id = founder ? env.STRIPE_PRICE_MONTHLY : env.STRIPE_PRICE_LIST_MONTHLY;
  else return null;
  return (id ?? "").trim() || null;
}

/**
 * El precio recurrente para esta compra, solo si Stripe cobra exactamente lo
 * que calculó Tiendify.
 *
 * Con una suscripción, el monto lo pone el precio guardado en Stripe, no el
 * nuestro. Si la variable de entorno quedó apuntando al precio viejo (el de
 * US$5 cuando la tienda debe pagar US$15, o al revés), cobraríamos otra cosa
 * que la que mostramos. En ese caso se devuelve null y la compra cae al cobro
 * único por el monto correcto, que es lo que hace un período sin precio.
 */
export async function matchingRecurringPrice(
  stripe: Stripe,
  months: number,
  founder: boolean,
  amountUsd: number,
): Promise<string | null> {
  const id = stripePriceFor(months, founder);
  if (!id) return null;
  try {
    const price = await stripe.prices.retrieve(id);
    const matches =
      price.active &&
      price.currency === "usd" &&
      price.unit_amount === toCents(amountUsd) &&
      price.recurring?.interval === (months >= 12 ? "year" : "month");
    if (matches) return id;
    reportError("stripe:recurring-price-mismatch", new Error("precio distinto"), {
      priceId: id,
      months,
      founder,
      expectedCents: toCents(amountUsd),
      stripeCents: price.unit_amount,
    });
  } catch (e) {
    reportError("stripe:recurring-price-lookup", e, { priceId: id });
  }
  return null;
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
