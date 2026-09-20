/**
 * Setup de Stripe. Se corre UNA VEZ por entorno (una con la clave de prueba,
 * otra con la de producción) y escupe los ids que hay que poner en las
 * variables de entorno.
 *
 *   npx tsx --env-file=.env.local scripts/stripe-setup.ts
 *
 * Crea, si no existen:
 *   · un Product ("Tiendify Pro")
 *   · dos Prices recurrentes: mensual y anual
 *   · el webhook apuntando a <NEXT_PUBLIC_APP_URL>/api/stripe/webhook
 *
 * Es idempotente: los precios se buscan por `lookup_key` y el webhook por URL,
 * así que correrlo dos veces no duplica nada. Los precios de Stripe son
 * inmutables — si cambia el precio del plan hay que crear uno nuevo y cambiar
 * la variable de entorno; el script avisa en vez de hacerlo solo.
 */

import Stripe from "stripe";

const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");

const PRODUCT_NAME = "Tiendify Pro";
const LOOKUP_MONTHLY = "tiendify_pro_monthly";
const LOOKUP_YEARLY = "tiendify_pro_yearly";

const MONTHLY_USD = Number(process.env.SETUP_PRICE_MONTHLY ?? 5);
const YEARLY_USD = Number(process.env.SETUP_PRICE_YEARLY ?? 50);

/** Los eventos que el webhook sabe procesar. Ni uno más. */
const EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  // El de los pedidos con tarjeta: es la red que crea el pedido si el cliente
  // cierra la pestaña justo después de pagar.
  "payment_intent.succeeded",
  "checkout.session.completed",
  "checkout.session.expired",
  "invoice.paid",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

/**
 * La URL final del webhook, siguiendo las redirecciones a mano.
 *
 * Esto existe porque nos costó un cobro real: el endpoint quedó registrado en
 * `www.tiendifyapp.com`, Vercel redirige `www` al dominio sin www con un 308,
 * y **Stripe no sigue redirecciones en los webhooks** — anota cada entrega
 * como fallida y no reintenta a la URL nueva. El resultado fue un cliente
 * cobrado con su pedido colgado en "esperando pago", sin una sola pista en la
 * app, porque el evento nunca llegó.
 */
async function resolveWebhookUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      const final = new URL(location, url).toString();
      console.log(
        `⚠ ${url} redirige (${res.status}) a ${final}.\n` +
          "  Stripe no sigue redirecciones: se registra la URL final.\n" +
          "  Convendría alinear NEXT_PUBLIC_APP_URL con esa misma.",
      );
      return final;
    }
  } catch {
    // Sin red o el sitio caído: se registra la URL tal cual y que Stripe avise.
  }
  return url;
}

async function main() {
  if (!key) {
    console.error("Falta STRIPE_SECRET_KEY.");
    process.exit(1);
  }
  if (!appUrl || appUrl.includes("localhost")) {
    console.warn(
      "⚠ NEXT_PUBLIC_APP_URL no es una URL pública: se crean los precios pero no el webhook.\n" +
        "  Para probar en local usa `stripe listen --forward-to localhost:3000/api/stripe/webhook`.",
    );
  }

  const stripe = new Stripe(key, { typescript: true });
  const live = !key.startsWith("sk_test");
  console.log(`Modo: ${live ? "LIVE (plata de verdad)" : "test"}\n`);

  // ── Producto ──────────────────────────────────────────────────────────────
  const products = await stripe.products.search({
    query: `name:'${PRODUCT_NAME}' AND active:'true'`,
  });
  const product =
    products.data[0] ??
    (await stripe.products.create({
      name: PRODUCT_NAME,
      description: "Plan Pro de Tiendify",
    }));
  console.log(`Producto: ${product.id}`);

  // ── Precios ───────────────────────────────────────────────────────────────
  const price = async (
    lookupKey: string,
    amountUsd: number,
    interval: "month" | "year",
  ) => {
    const found = await stripe.prices.list({
      lookup_keys: [lookupKey],
      active: true,
      limit: 1,
    });
    const existing = found.data[0];
    if (existing) {
      const want = Math.round(amountUsd * 100);
      if (existing.unit_amount !== want) {
        console.warn(
          `⚠ ${lookupKey} existe con ${(existing.unit_amount ?? 0) / 100} USD y vos querés ${amountUsd}.\n` +
            "  Los precios de Stripe son inmutables: creá uno nuevo a mano y cambiá la variable de entorno.",
        );
      }
      return existing;
    }
    return stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: Math.round(amountUsd * 100),
      recurring: { interval },
      lookup_key: lookupKey,
    });
  };

  const monthly = await price(LOOKUP_MONTHLY, MONTHLY_USD, "month");
  const yearly = await price(LOOKUP_YEARLY, YEARLY_USD, "year");

  // ── Webhook ───────────────────────────────────────────────────────────────
  let webhookSecret: string | null = null;
  if (appUrl && !appUrl.includes("localhost")) {
    const url = await resolveWebhookUrl(`${appUrl}/api/stripe/webhook`);
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const existing = endpoints.data.find((e) => e.url === url);
    if (existing) {
      await stripe.webhookEndpoints.update(existing.id, {
        enabled_events: EVENTS,
      });
      console.log(`Webhook: ${existing.id} (ya existía, eventos actualizados)`);
      console.log(
        "  El secreto solo se muestra al crearlo. Si no lo tenés, borrá el endpoint\n" +
          "  en el dashboard y volvé a correr este script.",
      );
    } else {
      const created = await stripe.webhookEndpoints.create({
        url,
        enabled_events: EVENTS,
        description: "Tiendify",
      });
      webhookSecret = created.secret ?? null;
      console.log(`Webhook: ${created.id}`);
    }
  }

  console.log("\n── Pegá esto en .env.local y en Vercel ──────────────────────");
  console.log(`STRIPE_PRICE_MONTHLY=${monthly.id}`);
  console.log(`STRIPE_PRICE_YEARLY=${yearly.id}`);
  if (webhookSecret) console.log(`STRIPE_WEBHOOK_SECRET=${webhookSecret}`);
  console.log("─────────────────────────────────────────────────────────────");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
