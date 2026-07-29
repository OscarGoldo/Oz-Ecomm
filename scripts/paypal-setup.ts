/**
 * Setup de la suscripción recurrente en PayPal. Se corre UNA VEZ por entorno
 * (una en sandbox, otra en live) y escupe los ids que hay que poner en las
 * variables de entorno.
 *
 *   npx tsx --env-file=.env.local scripts/paypal-setup.ts
 *
 * Crea, si no existen:
 *   · un Product ("Tiendify Pro")
 *   · dos Plans de facturación: mensual y anual
 *   · el webhook apuntando a <NEXT_PUBLIC_APP_URL>/api/paypal/webhook
 *
 * Es idempotente por nombre: si ya creaste los planes, los reusa en vez de
 * duplicarlos. PayPal no deja borrar planes, solo desactivarlos, así que
 * duplicar es un lío — de ahí el cuidado.
 */

const clientId = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "").trim();
const secret = (process.env.PAYPAL_SECRET ?? "").trim();
const sandbox = process.env.PAYPAL_SANDBOX !== "false";
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");

const BASE = sandbox
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

const PRODUCT_NAME = "Tiendify Pro";
const PLAN_MONTHLY = "Tiendify Pro — Mensual";
const PLAN_YEARLY = "Tiendify Pro — Anual";

const MONTHLY_USD = process.env.SETUP_PRICE_MONTHLY ?? "5.00";
const YEARLY_USD = process.env.SETUP_PRICE_YEARLY ?? "50.00";

let token = "";

async function api<T>(
  path: string,
  init?: RequestInit & { body?: string },
): Promise<{ ok: boolean; status: number; body: T }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, body };
}

async function auth() {
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${clientId}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`No autenticó contra PayPal (HTTP ${res.status})`);
  token = ((await res.json()) as { access_token: string }).access_token;
}

async function findOrCreateProduct(): Promise<string> {
  const list = await api<{ products?: { id: string; name: string }[] }>(
    "/v1/catalogs/products?page_size=100",
  );
  const found = list.body.products?.find((p) => p.name === PRODUCT_NAME);
  if (found) {
    console.log(`  product   reusado   ${found.id}`);
    return found.id;
  }
  const created = await api<{ id?: string; message?: string }>(
    "/v1/catalogs/products",
    {
      method: "POST",
      body: JSON.stringify({
        name: PRODUCT_NAME,
        description: "Plan Pro de Tiendify",
        type: "SERVICE",
        category: "SOFTWARE",
      }),
    },
  );
  if (!created.body.id) {
    throw new Error(`No se pudo crear el product: ${JSON.stringify(created.body)}`);
  }
  console.log(`  product   creado    ${created.body.id}`);
  return created.body.id;
}

async function findOrCreatePlan(
  productId: string,
  name: string,
  interval: "MONTH" | "YEAR",
  price: string,
): Promise<string> {
  const list = await api<{ plans?: { id: string; name: string; status: string }[] }>(
    `/v1/billing/plans?product_id=${encodeURIComponent(productId)}&page_size=100`,
  );
  const found = list.body.plans?.find(
    (p) => p.name === name && p.status === "ACTIVE",
  );
  if (found) {
    console.log(`  plan      reusado   ${found.id}  (${name})`);
    return found.id;
  }

  const created = await api<{ id?: string }>("/v1/billing/plans", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      name,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: { interval_unit: interval, interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          // 0 = se renueva para siempre, hasta que se cancele.
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: price, currency_code: "USD" },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CANCEL",
        // Tras 3 intentos fallidos PayPal suspende la suscripción y nos avisa.
        payment_failure_threshold: 3,
      },
    }),
  });
  if (!created.body.id) {
    throw new Error(`No se pudo crear el plan "${name}": ${JSON.stringify(created.body)}`);
  }
  console.log(`  plan      creado    ${created.body.id}  (${name})`);
  return created.body.id;
}

async function findOrCreateWebhook(): Promise<string> {
  if (!appUrl || appUrl.includes("localhost")) {
    console.log(
      "  webhook   OMITIDO   NEXT_PUBLIC_APP_URL es localhost; PayPal necesita una URL pública",
    );
    return "";
  }
  const url = `${appUrl}/api/paypal/webhook`;

  const list = await api<{ webhooks?: { id: string; url: string }[] }>(
    "/v1/notifications/webhooks",
  );
  const found = list.body.webhooks?.find((w) => w.url === url);
  if (found) {
    console.log(`  webhook   reusado   ${found.id}`);
    return found.id;
  }

  const created = await api<{ id?: string }>("/v1/notifications/webhooks", {
    method: "POST",
    body: JSON.stringify({
      url,
      event_types: [
        { name: "BILLING.SUBSCRIPTION.ACTIVATED" },
        { name: "BILLING.SUBSCRIPTION.CANCELLED" },
        { name: "BILLING.SUBSCRIPTION.SUSPENDED" },
        { name: "BILLING.SUBSCRIPTION.EXPIRED" },
        { name: "PAYMENT.SALE.COMPLETED" },
        { name: "PAYMENT.SALE.DENIED" },
      ],
    }),
  });
  if (!created.body.id) {
    throw new Error(`No se pudo crear el webhook: ${JSON.stringify(created.body)}`);
  }
  console.log(`  webhook   creado    ${created.body.id}`);
  console.log(`            → ${url}`);
  return created.body.id;
}

async function main() {
  if (!clientId || !secret) {
    console.log("Faltan NEXT_PUBLIC_PAYPAL_CLIENT_ID y/o PAYPAL_SECRET.");
    process.exit(1);
  }
  console.log(`Entorno: ${sandbox ? "SANDBOX" : "LIVE ⚠️"}`);
  console.log(`Precios: $${MONTHLY_USD}/mes · $${YEARLY_USD}/año\n`);

  await auth();
  const productId = await findOrCreateProduct();
  const monthly = await findOrCreatePlan(productId, PLAN_MONTHLY, "MONTH", MONTHLY_USD);
  const yearly = await findOrCreatePlan(productId, PLAN_YEARLY, "YEAR", YEARLY_USD);
  const webhookId = await findOrCreateWebhook();

  console.log("\n── Pon esto en tus variables de entorno ──");
  console.log(`PAYPAL_PLAN_MONTHLY=${monthly}`);
  console.log(`PAYPAL_PLAN_YEARLY=${yearly}`);
  if (webhookId) console.log(`PAYPAL_WEBHOOK_ID=${webhookId}`);
  else console.log("PAYPAL_WEBHOOK_ID=  ← correr de nuevo con NEXT_PUBLIC_APP_URL público");
}

main().catch((e) => {
  console.error("\nFalló:", (e as Error).message);
  process.exit(1);
});
