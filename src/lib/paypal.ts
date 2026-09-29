// Server-only PayPal Orders API helper. The secret never leaves the server.

export interface PaypalCreds {
  clientId: string;
  secret: string;
  sandbox: boolean;
}

function apiBase(sandbox: boolean): string {
  return sandbox
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

/**
 * El interruptor de PayPal. Apagado por defecto.
 *
 * Desde septiembre de 2026 los pagos online van por Stripe y PayPal está
 * escondido, no borrado: todo el código sigue acá para poder volver a usarlo.
 * Para prenderlo alcanza con `PAYPAL_ENABLED=true` en Vercel (más las
 * credenciales de siempre) y un redeploy.
 *
 * Apagado, PayPal desaparece en todos lados a la vez: el checkout de las
 * tiendas, la configuración de pagos del comerciante y el plan Pro. Y el
 * servidor rechaza cobrar por PayPal aunque alguien arme el pedido a mano.
 *
 * Solo se lee en el servidor: no tiene prefijo NEXT_PUBLIC a propósito.
 */
export function paypalEnabled(): boolean {
  return process.env.PAYPAL_ENABLED === "true";
}

/**
 * Platform-wide PayPal credentials from env (a single account for all stores).
 *   NEXT_PUBLIC_PAYPAL_CLIENT_ID — public, also used by the browser SDK
 *   PAYPAL_SECRET                — server-only
 *   PAYPAL_SANDBOX               — "false" for live; anything else = sandbox
 *
 * Devuelve null con el interruptor apagado, aunque las credenciales estén. Es
 * lo que hace que TODO cobro por PayPal se corte en un solo lugar: el checkout,
 * el plan Pro, las suscripciones y el webhook pasan por acá.
 */
export function paypalCredsFromEnv(): PaypalCreds | null {
  if (!paypalEnabled()) return null;
  const clientId = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "").trim();
  const secret = (process.env.PAYPAL_SECRET ?? "").trim();
  if (!clientId || !secret) return null;
  const sandbox = process.env.PAYPAL_SANDBOX !== "false";
  return { clientId, secret, sandbox };
}

/** The public client id for the browser SDK (empty if not configured). */
export function paypalClientId(): string {
  return (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "").trim();
}

async function getAccessToken(c: PaypalCreds): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase(c.sandbox)}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${c.clientId}:${c.secret}`).toString("base64"),
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

/** Create a PayPal order for the given USD amount. Returns the PayPal order id. */
export async function createPaypalOrder(
  c: PaypalCreds,
  amountUsd: number,
  opts?: { description?: string; reference?: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const token = await getAccessToken(c);
  if (!token) return { ok: false, error: "auth" };
  try {
    const res = await fetch(`${apiBase(c.sandbox)}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: { currency_code: "USD", value: amountUsd.toFixed(2) },
            ...(opts?.description ? { description: opts.description.slice(0, 127) } : {}),
            ...(opts?.reference ? { custom_id: opts.reference } : {}),
          },
        ],
      }),
      cache: "no-store",
    });
    const j = (await res.json().catch(() => null)) as { id?: string } | null;
    if (!res.ok || !j?.id) return { ok: false, error: "create" };
    return { ok: true, id: j.id };
  } catch {
    return { ok: false, error: "create" };
  }
}

/** Capture a previously-approved PayPal order. Verifies it completed. */
export async function capturePaypalOrder(
  c: PaypalCreds,
  paypalOrderId: string,
): Promise<
  | { ok: true; captureId: string; amount: number; fee: number; net: number }
  | { ok: false; error: string }
> {
  const token = await getAccessToken(c);
  if (!token) return { ok: false, error: "auth" };
  try {
    const res = await fetch(
      `${apiBase(c.sandbox)}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        cache: "no-store",
      },
    );
    const j = (await res.json().catch(() => null)) as {
      status?: string;
      purchase_units?: {
        payments?: {
          captures?: {
            id?: string;
            amount?: { value?: string };
            seller_receivable_breakdown?: {
              paypal_fee?: { value?: string };
              net_amount?: { value?: string };
            };
          }[];
        };
      }[];
    } | null;
    if (!res.ok || j?.status !== "COMPLETED") {
      return { ok: false, error: "capture" };
    }
    const cap = j.purchase_units?.[0]?.payments?.captures?.[0];
    const amount = cap?.amount?.value ? Number(cap.amount.value) : 0;
    const breakdown = cap?.seller_receivable_breakdown;
    const fee = breakdown?.paypal_fee?.value ? Number(breakdown.paypal_fee.value) : 0;
    const net = breakdown?.net_amount?.value ? Number(breakdown.net_amount.value) : amount - fee;
    return { ok: true, captureId: cap?.id ?? paypalOrderId, amount, fee, net };
  } catch {
    return { ok: false, error: "capture" };
  }
}
