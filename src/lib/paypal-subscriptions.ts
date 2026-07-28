// Suscripciones recurrentes de PayPal. Complementa a lib/paypal.ts (que hace
// cobros únicos con la Orders API) reusando sus credenciales.
//
// El secreto nunca sale del servidor.

import { paypalCredsFromEnv, type PaypalCreds } from "@/lib/paypal";

export function apiBase(sandbox: boolean): string {
  return sandbox
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

export async function accessToken(c: PaypalCreds): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase(c.sandbox)}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${c.clientId}:${c.secret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string };
    return j.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Los ids de los planes de facturación que creó `scripts/paypal-setup.ts`.
 * Van por entorno porque son distintos en sandbox y en live.
 */
export function planIdFor(months: number): string | null {
  const id =
    months >= 12
      ? process.env.PAYPAL_PLAN_YEARLY
      : process.env.PAYPAL_PLAN_MONTHLY;
  return (id ?? "").trim() || null;
}

/** ¿Está todo lo necesario para cobrar recurrente? */
export function subscriptionsConfigured(): boolean {
  return (
    paypalCredsFromEnv() !== null &&
    planIdFor(1) !== null &&
    planIdFor(12) !== null
  );
}

export interface PaypalSubscription {
  id: string;
  status: string;
  /** store_id que mandamos al crearla. */
  customId: string | null;
  /** Próximo cobro, ISO. */
  nextBillingTime: string | null;
  planId: string | null;
}

/** Consulta el estado real de una suscripción en PayPal. */
export async function getSubscription(
  c: PaypalCreds,
  subscriptionId: string,
): Promise<PaypalSubscription | null> {
  const token = await accessToken(c);
  if (!token) return null;
  try {
    const res = await fetch(
      `${apiBase(c.sandbox)}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      id?: string;
      status?: string;
      custom_id?: string;
      plan_id?: string;
      billing_info?: { next_billing_time?: string };
    };
    if (!j.id) return null;
    return {
      id: j.id,
      status: j.status ?? "UNKNOWN",
      customId: j.custom_id ?? null,
      nextBillingTime: j.billing_info?.next_billing_time ?? null,
      planId: j.plan_id ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Cancela la suscripción en PayPal. No toca el plan de la tienda: lo que ya
 * está pago corre hasta su vencimiento.
 */
export async function cancelSubscription(
  c: PaypalCreds,
  subscriptionId: string,
  reason: string,
): Promise<boolean> {
  const token = await accessToken(c);
  if (!token) return false;
  try {
    const res = await fetch(
      `${apiBase(c.sandbox)}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: reason.slice(0, 127) }),
        cache: "no-store",
      },
    );
    // 204 = cancelada. 422 suele ser "ya estaba cancelada", que para nosotros
    // es el mismo resultado deseado.
    return res.status === 204 || res.status === 422;
  } catch {
    return false;
  }
}

/**
 * Verifica que el webhook lo mandó PayPal de verdad.
 *
 * Sin esto, cualquiera que descubra la URL puede POSTear un "cobro exitoso" y
 * regalarse Pro. Es la pieza de seguridad más importante de todo el flujo:
 * ante cualquier duda, se rechaza.
 */
export async function verifyWebhookSignature(
  c: PaypalCreds,
  headers: Headers,
  event: unknown,
): Promise<boolean> {
  const webhookId = (process.env.PAYPAL_WEBHOOK_ID ?? "").trim();
  if (!webhookId) return false;

  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const transmissionSig = headers.get("paypal-transmission-sig");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");
  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return false;
  }

  const token = await accessToken(c);
  if (!token) return false;

  try {
    const res = await fetch(
      `${apiBase(c.sandbox)}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: event,
        }),
        cache: "no-store",
      },
    );
    if (!res.ok) return false;
    const j = (await res.json()) as { verification_status?: string };
    return j.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}

/** Credenciales + guardas, para las rutas que las necesitan. */
export function subscriptionCreds(): PaypalCreds | null {
  return paypalCredsFromEnv();
}
