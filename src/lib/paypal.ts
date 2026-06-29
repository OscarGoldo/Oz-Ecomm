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

/** Read PayPal credentials from a payment_method.details JSON. */
export function paypalCredsFromDetails(
  details: unknown,
): PaypalCreds | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  const clientId = typeof d.client_id === "string" ? d.client_id.trim() : "";
  const secret = typeof d.secret === "string" ? d.secret.trim() : "";
  if (!clientId || !secret) return null;
  // Default to sandbox unless explicitly set to live ("false").
  const sandbox = d.sandbox !== "false" && d.sandbox !== false;
  return { clientId, secret, sandbox };
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
  { ok: true; captureId: string; amount: number } | { ok: false; error: string }
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
        payments?: { captures?: { id?: string; amount?: { value?: string } }[] };
      }[];
    } | null;
    if (!res.ok || j?.status !== "COMPLETED") {
      return { ok: false, error: "capture" };
    }
    const cap = j.purchase_units?.[0]?.payments?.captures?.[0];
    const amount = cap?.amount?.value ? Number(cap.amount.value) : 0;
    return { ok: true, captureId: cap?.id ?? paypalOrderId, amount };
  } catch {
    return { ok: false, error: "capture" };
  }
}
