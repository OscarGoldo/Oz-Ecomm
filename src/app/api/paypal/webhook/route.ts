import { NextResponse } from "next/server";

import { extendExpiry } from "@/lib/plans";
import {
  subscriptionCreds,
  verifyWebhookSignature,
} from "@/lib/paypal-subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Webhook de PayPal para la suscripción recurrente del plan Pro.
 *
 * Reglas de oro de este archivo:
 *
 *  1. NADA se procesa sin verificar la firma. Sin eso, cualquiera que descubra
 *     esta URL puede POSTear un "cobro exitoso" y regalarse el plan.
 *  2. El plan se extiende SOLO con PAYMENT.SALE.COMPLETED — el evento de plata
 *     de verdad. ACTIVATED solo registra la suscripción, porque PayPal manda
 *     los dos al contratar y extender en ambos daría el doble de meses.
 *  3. Todo evento se deduplica por su id: PayPal reintenta hasta recibir un
 *     200, y sin dedupe cada reintento sumaría meses otra vez.
 *  4. Ante un evento que no podemos procesar respondemos 200 igual, salvo que
 *     el fallo sea nuestro y valga la pena que PayPal reintente. Un 500 por un
 *     evento que nunca vamos a poder procesar hace que PayPal reintente
 *     durante días.
 */

interface PaypalEvent {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    custom_id?: string;
    plan_id?: string;
    // En PAYMENT.SALE.*: la suscripción que originó el cobro.
    billing_agreement_id?: string;
    amount?: { total?: string; currency?: string };
    billing_info?: { next_billing_time?: string };
  };
}

export async function POST(request: Request) {
  const creds = subscriptionCreds();
  if (!creds) {
    // PayPal no debería estar mandando nada si no hay credenciales.
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const raw = await request.text();
  let event: PaypalEvent;
  try {
    event = JSON.parse(raw) as PaypalEvent;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const verified = await verifyWebhookSignature(creds, request.headers, event);
  if (!verified) {
    console.warn("[paypal-webhook] firma inválida", event.event_type, event.id);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const eventId = event.id;
  const type = event.event_type ?? "";
  if (!eventId) return NextResponse.json({ ok: true });

  const db = createAdminClient();

  // Dedupe. El PK del id del evento es la garantía real: si dos entregas del
  // mismo evento llegan a la vez, solo una gana el insert.
  const { error: dupeErr } = await db.from("paypal_webhook_events").insert({
    id: eventId,
    event_type: type,
    resource_id: event.resource?.id ?? null,
  });
  if (dupeErr) {
    if (dupeErr.code === "23505") {
      // Ya procesado. 200 para que PayPal deje de reintentar.
      return NextResponse.json({ ok: true, duplicate: true });
    }
    // Falla nuestra: que PayPal reintente en vez de perder el evento.
    console.error("[paypal-webhook] no se pudo registrar el evento", dupeErr.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  try {
    switch (type) {
      case "PAYMENT.SALE.COMPLETED":
        await handleSaleCompleted(db, event);
        break;
      case "BILLING.SUBSCRIPTION.ACTIVATED":
        await handleSubscriptionStatus(db, event, "active");
        break;
      case "BILLING.SUBSCRIPTION.CANCELLED":
        await handleSubscriptionStatus(db, event, "cancelled");
        break;
      case "BILLING.SUBSCRIPTION.SUSPENDED":
      case "PAYMENT.SALE.DENIED":
        await handleSubscriptionStatus(db, event, "suspended");
        break;
      case "BILLING.SUBSCRIPTION.EXPIRED":
        await handleSubscriptionStatus(db, event, "expired");
        break;
      default:
        break;
    }
  } catch (e) {
    // El evento ya quedó marcado como procesado, así que un reintento de
    // PayPal no lo re-ejecutaría. Se registra fuerte para poder arreglarlo a
    // mano desde /super.
    console.error("[paypal-webhook] error procesando", type, eventId, e);
  }

  return NextResponse.json({ ok: true });
}

type Db = ReturnType<typeof createAdminClient>;

/** Encuentra la tienda por la suscripción que originó el evento. */
async function storeForSubscription(
  db: Db,
  subscriptionId: string | null | undefined,
  customId: string | null | undefined,
) {
  if (subscriptionId) {
    const { data } = await db
      .from("stores")
      .select("id, plan_expires_at")
      .eq("paypal_subscription_id", subscriptionId)
      .maybeSingle();
    if (data) return data;
  }
  // Respaldo: el custom_id que mandamos al crear la suscripción es el store_id.
  // Cubre el primer cobro, que puede llegar antes de que registremos el id.
  if (customId) {
    const { data } = await db
      .from("stores")
      .select("id, plan_expires_at")
      .eq("id", customId)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

/**
 * Un cobro entró: el primero al contratar, o una renovación.
 * Es el ÚNICO lugar donde se extiende el plan.
 */
async function handleSaleCompleted(db: Db, event: PaypalEvent) {
  const r = event.resource ?? {};
  const subscriptionId = r.billing_agreement_id ?? null;
  // Sin suscripción asociada es un cobro suelto (Orders API), no nuestro.
  if (!subscriptionId) return;

  const store = await storeForSubscription(db, subscriptionId, r.custom_id);
  if (!store) {
    console.warn("[paypal-webhook] cobro sin tienda", subscriptionId);
    return;
  }

  const amount = r.amount?.total ? Number(r.amount.total) : 0;
  // El plan anual cuesta bastante más que un mes: así se distingue sin
  // depender de mirar el plan_id contra el entorno.
  const months = amount >= 30 ? 12 : 1;

  await db.from("subscription_payments").insert({
    store_id: store.id,
    period_months: months,
    amount,
    currency: r.amount?.currency ?? "USD",
    method: "paypal",
    reference: r.id ?? null,
    paypal_capture_id: r.id ?? null,
    paypal_subscription_id: subscriptionId,
    status: "approved",
    reviewed_at: new Date().toISOString(),
  });

  await db
    .from("stores")
    .update({
      plan: "pro",
      plan_source: "paid",
      plan_expires_at: extendExpiry(store.plan_expires_at, months),
      paypal_subscription_id: subscriptionId,
      paypal_subscription_status: "active",
    })
    .eq("id", store.id);
}

/**
 * Cambio de estado de la suscripción.
 *
 * Importante: NO se revoca el plan. Si cancela o le falla la tarjeta, lo que
 * ya pagó corre hasta su vencimiento y recién ahí cae a Gratis solo, porque
 * isPro() mira la fecha. Cortarle el servicio por el que ya pagó sería un robo.
 */
async function handleSubscriptionStatus(
  db: Db,
  event: PaypalEvent,
  status: "active" | "cancelled" | "suspended" | "expired",
) {
  const r = event.resource ?? {};
  const subscriptionId = r.billing_agreement_id ?? r.id ?? null;
  const store = await storeForSubscription(db, subscriptionId, r.custom_id);
  if (!store) return;

  await db
    .from("stores")
    .update({
      paypal_subscription_status: status,
      ...(status === "active" && subscriptionId
        ? { paypal_subscription_id: subscriptionId }
        : {}),
    })
    .eq("id", store.id);
}
