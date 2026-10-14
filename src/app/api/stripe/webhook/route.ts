import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { finalizeCardOrder } from "@/app/(public)/[store_slug]/checkout/actions";
import { formatUSD } from "@/lib/format";
import { notifyPaidOrder } from "@/lib/order-notify";
import { stockOpsForOrder } from "@/lib/order-stock";
import {
  PLAN_PERIODS,
  extendExpiry,
  priceFor,
  type PlanPrices,
} from "@/lib/plans";
import { getPlatformConfig } from "@/lib/platform";
import { recordPlatformEvent } from "@/lib/platform-events";
import { monthsLabel } from "@/lib/promo";
import { maybeQualifyReferral } from "@/lib/referrals-server";
import { reportError } from "@/lib/report-error";
import {
  chargeBreakdown,
  fromCents,
  getStripe,
  stripeIsTestMode,
  stripeWebhookSecret,
  toCents,
} from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionState } from "@/types/database";

export const dynamic = "force-dynamic";
// El cuerpo crudo y la verificación de firma necesitan Node, no Edge.
export const runtime = "nodejs";

/**
 * Webhook de Stripe. Cubre las dos cosas que cobramos con tarjeta: los pedidos
 * de las tiendas y el plan Pro.
 *
 * Reglas de oro, las mismas que el de PayPal:
 *
 *  1. NADA se procesa sin verificar la firma sobre el cuerpo CRUDO. Sin eso,
 *     cualquiera que descubra esta URL se regala pedidos pagados y meses de Pro.
 *  2. El monto se compara siempre contra lo que dice NUESTRA base, no contra lo
 *     que viene en el evento.
 *  3. Todo evento se deduplica por su id: Stripe reintenta hasta recibir un
 *     200, y sin dedupe cada reintento volvería a ejecutar el efecto.
 *  4. Ante un evento que no podemos procesar respondemos 200 igual, salvo que
 *     el fallo sea nuestro y valga la pena que Stripe reintente. Un 500 por
 *     algo que nunca vamos a poder procesar hace que reintente durante días.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = stripeWebhookSecret();
  if (!stripe || !secret) {
    // Stripe no debería estar mandando nada si no está configurado.
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ ok: false }, { status: 400 });

  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
  } catch (e) {
    console.warn("[stripe-webhook] firma inválida", (e as Error)?.message);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const db = createAdminClient();

  // Dedupe. El PK del id del evento es la garantía real: si dos entregas del
  // mismo evento llegan a la vez, solo una gana el insert.
  const { error: dupeErr } = await db.from("stripe_webhook_events").insert({
    id: event.id,
    event_type: event.type,
    resource_id: (event.data.object as { id?: string })?.id ?? null,
  });
  if (dupeErr) {
    if (dupeErr.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    // Falla nuestra: que Stripe reintente en vez de perder el evento.
    console.error("[stripe-webhook] no se pudo registrar el evento", dupeErr.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleSessionCompleted(db, stripe, event.data.object);
        break;
      case "checkout.session.expired":
        await handleSessionExpired(db, event.data.object);
        break;
      case "payment_intent.succeeded":
        await handleCardPayment(db, event.data.object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(db, event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionState(db, event.data.object, "cancelled");
        break;
      case "customer.subscription.updated":
        await handleSubscriptionState(
          db,
          event.data.object,
          subscriptionState(event.data.object.status),
        );
        break;
      case "charge.dispute.created":
        await handleDispute(db, event.data.object);
        break;
      case "charge.refunded":
        await handleRefund(db, event.data.object);
        break;
      default:
        break;
    }
  } catch (e) {
    // El evento ya quedó marcado como procesado, así que un reintento de
    // Stripe no lo re-ejecutaría. Se registra fuerte para poder arreglarlo a
    // mano desde /super.
    console.error("[stripe-webhook] error procesando", event.type, event.id, e);
    reportError("stripe-webhook", e, { type: event.type, id: event.id });
  }

  return NextResponse.json({ ok: true });
}

type Db = ReturnType<typeof createAdminClient>;

// ── Pedidos de las tiendas ──────────────────────────────────────────────────

async function handleSessionCompleted(
  db: Db,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  const kind = session.metadata?.kind;
  if (kind === "plan") return handlePlanSession(db, session);
  if (kind !== "order") return;

  // Con `payment_status` distinto de 'paid' el cobro no entró (por ejemplo un
  // método asincrónico que todavía se está procesando). No se confirma nada.
  if (session.payment_status !== "paid") return;

  const orderId = session.metadata?.order_id ?? session.client_reference_id;
  if (!orderId) return;

  const { data: order } = await db
    .from("orders")
    .select("id, store_id, total, status, order_number")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    console.warn("[stripe-webhook] cobro sin pedido", orderId);
    await recordPlatformEvent({
      type: "stripe.orphan_charge",
      amount: fromCents(session.amount_total ?? 0),
      title: "Cobro con tarjeta sin pedido",
      detail: `La sesión ${session.id} apunta a un pedido que no existe. La plata está en Stripe.`,
      url: stripeDashboardUrl("payments", paymentIntentId(session.payment_intent)),
      dedupeKey: `orphan:${session.id}`,
    });
    return;
  }
  if (order.status !== "pending_payment") return; // ya procesado

  // Regla 2: el monto se compara contra el pedido, no contra el evento. Si no
  // coincide, algo se tocó en el medio: no se confirma y queda para revisar a
  // mano con la plata ya en la cuenta.
  const expected = toCents(Number(order.total));
  if (session.amount_total !== expected) {
    console.error(
      "[stripe-webhook] monto distinto al del pedido",
      orderId,
      session.amount_total,
      expected,
    );
    reportError("stripe-webhook:amount-mismatch", new Error("monto distinto"), {
      orderId,
      charged: session.amount_total,
      expected,
    });
    await recordPlatformEvent({
      type: "stripe.orphan_charge",
      storeId: order.store_id,
      amount: fromCents(session.amount_total ?? 0),
      title: `Cobro que no coincide con el pedido #${order.order_number}`,
      detail: `Se cobraron ${formatUSD(fromCents(session.amount_total ?? 0))} y el pedido es de ${formatUSD(Number(order.total))}. No se confirmó: hay que revisarlo a mano.`,
      url: stripeDashboardUrl("payments", paymentIntentId(session.payment_intent)),
      dedupeKey: `mismatch:${session.id}`,
    });
    return;
  }

  const intentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // Comisión y neto reales, para que /super/pagos sepa cuánto se le debe al
  // comerciante. Si no se pueden leer, el pedido se confirma igual.
  const breakdown = intentId ? await chargeBreakdown(stripe, intentId) : null;

  // El filtro por status es el candado de idempotencia: si dos entregas del
  // evento llegan a la vez, solo una encuentra el pedido en "esperando pago".
  const { data: claimed } = await db
    .from("orders")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      payment_reference: intentId,
      stripe_payment_intent: intentId,
      payment_fee: breakdown?.fee ?? null,
      payment_net: breakdown?.net ?? fromCents(session.amount_total ?? 0),
    })
    .eq("id", order.id)
    .eq("status", "pending_payment")
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  await notifyPaidOrder(db, order.id);
  const { data: store } = await db
    .from("stores")
    .select("name")
    .eq("id", order.store_id)
    .maybeSingle();
  await recordPlatformEvent({
    type: "order.card_paid",
    storeId: order.store_id,
    amount: Number(order.total),
    title: `Venta con tarjeta en ${store?.name ?? "una tienda"}`,
    detail: `Pedido #${order.order_number} · se le debe a la tienda`,
    url: "/super/pagos",
  });
  // Una venta confirmada es lo que puede activar el referido que trajo a esta
  // tienda; en el checkout normal esto pasa dentro de createOrder.
  await maybeQualifyReferral(order.store_id);
}

/**
 * Un cobro con tarjeta salió bien.
 *
 * Es la red por debajo del navegador: si el cliente cerró la pestaña justo
 * después de pagar, el pedido se crea igual desde el borrador congelado en
 * `checkout_intents`. Sin esto, ese cobro sería plata sin pedido y nadie se
 * enteraría — el mismo desastre mudo del webhook mal apuntado.
 *
 * Es idempotente: si el navegador llegó primero, `finalizeCardOrder` devuelve
 * el pedido que ya existe en vez de crear otro.
 */
async function handleCardPayment(db: Db, intent: Stripe.PaymentIntent) {
  if (intent.metadata?.kind !== "card_order") return;

  const res = await finalizeCardOrder(intent.id);
  if (!res.ok) {
    // La plata está cobrada. Que quede ruidoso: hay que resolverlo a mano.
    console.error("[stripe-webhook] cobro sin pedido", intent.id, res.error);
    reportError("stripe-webhook:card-sin-pedido", new Error(res.error ?? "falló"), {
      paymentIntentId: intent.id,
    });
    await recordPlatformEvent({
      type: "stripe.orphan_charge",
      storeId: intent.metadata?.store_id ?? null,
      amount: fromCents(intent.amount_received ?? intent.amount),
      title: "Cobro con tarjeta sin pedido",
      detail: `El cliente pagó y el pedido no se pudo crear (${res.error ?? "sin detalle"}). Hay que resolverlo a mano.`,
      url: stripeDashboardUrl("payments", intent.id),
      dedupeKey: `orphan:${intent.id}`,
    });
  }
}

/**
 * La sesión venció sin pagarse (24 h por defecto).
 *
 * Se cancela el pedido y se devuelve el inventario. Es importante que pase:
 * el stock se reserva al crear el pedido, así que sin esto la última unidad de
 * algo queda bloqueada un día entero porque alguien abrió Stripe y cerró la
 * pestaña.
 */
async function handleSessionExpired(db: Db, session: Stripe.Checkout.Session) {
  if (session.metadata?.kind !== "order") return;
  const orderId = session.metadata?.order_id ?? session.client_reference_id;
  if (!orderId) return;

  const { data: order } = await db
    .from("orders")
    .select("id, store_id, status, stock_committed, stripe_session_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status !== "pending_payment") return;

  // Si el cliente reintentó, el pedido ya está atado a otra sesión: la que
  // venció es la vieja y cancelar sería tumbarle el pago en curso.
  if (order.stripe_session_id && order.stripe_session_id !== session.id) return;

  const { data: claimed } = await db
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      stock_committed: false,
    })
    .eq("id", order.id)
    .eq("status", "pending_payment")
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  if (order.stock_committed) {
    const ops = await stockOpsForOrder(db, order.store_id, order.id);
    if (ops.length > 0) await db.rpc("restore_order_stock", { p_items: ops });
  }
}

// ── Plan Pro ────────────────────────────────────────────────────────────────

/**
 * El comerciante terminó el checkout del plan.
 *
 * En modo suscripción esto NO extiende nada: solo registra la suscripción. Los
 * meses los suma `invoice.paid`, que es el evento de plata de verdad — igual
 * que en PayPal, donde ACTIVATED registra y PAYMENT.SALE.COMPLETED cobra.
 * Sumar en los dos daría el doble de meses en el primer cobro.
 */
async function handlePlanSession(db: Db, session: Stripe.Checkout.Session) {
  const storeId = session.metadata?.store_id;
  if (!storeId) return;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);

  if (session.mode === "subscription") {
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription?.id ?? null);
    await db
      .from("stores")
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_subscription_status: "active",
      })
      .eq("id", storeId);
    return;
  }

  // Pago único: el período no tiene precio recurrente configurado en Stripe.
  if (session.payment_status !== "paid") return;
  const months = Number(session.metadata?.months ?? 0);
  if (!months) return;

  const { prices } = await getPlatformConfig();
  const expected = toCents(priceFor(months, prices));
  if ((session.amount_total ?? 0) + 1 < expected) {
    console.error("[stripe-webhook] plan cobrado por menos", storeId, session.amount_total, expected);
    return;
  }

  const intentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  await extendPlan(db, storeId, months, {
    amount: fromCents(session.amount_total ?? 0),
    paymentId: intentId ?? session.id,
    subscriptionId: null,
    customerId,
  });
}

/**
 * Entró un cobro de la suscripción: el primero al contratar, o una renovación.
 * Es el ÚNICO lugar donde la suscripción extiende el plan.
 */
async function handleInvoicePaid(db: Db, invoice: Stripe.Invoice) {
  const details = invoice.parent?.subscription_details ?? null;
  const subscription =
    typeof details?.subscription === "string"
      ? details.subscription
      : (details?.subscription?.id ?? null);
  // Sin suscripción asociada es una factura suelta, no nuestra.
  if (!subscription) return;

  const store = await storeForSubscription(
    db,
    subscription,
    details?.metadata?.store_id ?? null,
  );
  if (!store) {
    console.warn("[stripe-webhook] factura sin tienda", subscription);
    return;
  }

  const amount = fromCents(invoice.amount_paid ?? 0);
  if (amount <= 0) return;

  const { prices } = await getPlatformConfig();
  const months = monthsForAmount(amount, prices);

  await extendPlan(db, store.id, months, {
    amount,
    // El id de la factura es único por cobro: es lo que impide sumar meses dos
    // veces si el evento llega repetido.
    paymentId: invoice.id ?? subscription,
    subscriptionId: subscription,
    customerId:
      typeof invoice.customer === "string"
        ? invoice.customer
        : (invoice.customer?.id ?? null),
  });
}

/**
 * Cambio de estado de la suscripción.
 *
 * Importante: NO se revoca el plan. Si cancela o le falla la tarjeta, lo que ya
 * pagó corre hasta su vencimiento y recién ahí cae a Gratis solo, porque isPro()
 * mira la fecha. Cortarle el servicio que ya pagó sería un robo.
 */
async function handleSubscriptionState(
  db: Db,
  subscription: Stripe.Subscription,
  state: SubscriptionState,
) {
  const store = await storeForSubscription(
    db,
    subscription.id,
    subscription.metadata?.store_id ?? null,
  );
  if (!store) return;

  await db
    .from("stores")
    .update({
      stripe_subscription_status: state,
      ...(state === "active" ? { stripe_subscription_id: subscription.id } : {}),
    })
    .eq("id", store.id);

  // `customer.subscription.updated` llega por cualquier cambio (una renovación,
  // la metadata). Solo se avisa cuando el estado de verdad cambió a algo malo.
  if (state === store.stripe_subscription_status) return;
  if (state === "suspended") {
    await recordPlatformEvent({
      type: "plan.payment_failed",
      storeId: store.id,
      title: `Cobro fallido: ${store.name}`,
      detail:
        "La tarjeta no pasó. Stripe reintenta solo; el plan corre hasta que venza.",
      url: `/super/tiendas/${store.id}`,
    });
  } else if (state === "cancelled") {
    await recordPlatformEvent({
      type: "plan.cancelled",
      storeId: store.id,
      title: `Suscripción cancelada: ${store.name}`,
      detail: store.plan_expires_at
        ? `Tiene Pro hasta el ${new Date(store.plan_expires_at).toLocaleDateString("es-VE", { timeZone: "America/Caracas" })}`
        : null,
      url: `/super/tiendas/${store.id}`,
    });
  }
}

// ── Contracargos y reembolsos ───────────────────────────────────────────────
//
// Las ventas con tarjeta de las tiendas entran a la cuenta de Tiendify, así
// que un contracargo le saca la plata a Tiendify, quizás después de haberle
// pagado a la tienda. Antes estos eventos ni se escuchaban: se veían solo
// entrando a Stripe. Acá no se toca nada (ni el pedido ni lo que se le debe a
// la tienda); se avisa para decidir a mano.

/** El pedido de un cobro, para decir de qué tienda es. */
async function orderForIntent(db: Db, intentId: string | null) {
  if (!intentId) return null;
  const { data } = await db
    .from("orders")
    .select("id, store_id, order_number, paid_out_at")
    .eq("stripe_payment_intent", intentId)
    .maybeSingle();
  if (!data) return null;
  const { data: store } = await db
    .from("stores")
    .select("name")
    .eq("id", data.store_id)
    .maybeSingle();
  return { ...data, storeName: store?.name ?? "una tienda" };
}

async function handleDispute(db: Db, dispute: Stripe.Dispute) {
  const order = await orderForIntent(db, paymentIntentId(dispute.payment_intent));
  await recordPlatformEvent({
    type: "stripe.dispute",
    storeId: order?.store_id ?? null,
    amount: fromCents(dispute.amount),
    title: "Contracargo",
    detail: [
      order
        ? `${order.storeName} · pedido #${order.order_number}${
            order.paid_out_at ? " · a la tienda ya se le pagó" : ""
          }`
        : "No es de un pedido de tienda (puede ser un plan)",
      `motivo: ${dispute.reason}`,
      dispute.evidence_details?.due_by
        ? `hay que responder antes del ${new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString("es-VE", { timeZone: "America/Caracas" })}`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
    url: stripeDashboardUrl("disputes", dispute.id),
  });
}

async function handleRefund(db: Db, charge: Stripe.Charge) {
  const order = await orderForIntent(db, paymentIntentId(charge.payment_intent));
  await recordPlatformEvent({
    type: "stripe.refund",
    storeId: order?.store_id ?? null,
    amount: fromCents(charge.amount_refunded),
    title: charge.refunded ? "Reembolso total" : "Reembolso parcial",
    detail: order
      ? `${order.storeName} · pedido #${order.order_number}${
          order.paid_out_at
            ? " · a la tienda ya se le pagó"
            : " · descontarlo de lo que se le debe"
        }`
      : "No es de un pedido de tienda (puede ser un plan)",
    url: stripeDashboardUrl("payments", paymentIntentId(charge.payment_intent)),
  });
}

function paymentIntentId(
  pi: string | Stripe.PaymentIntent | null | undefined,
): string | null {
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

/** Enlace a algo en el dashboard de Stripe, respetando el modo de prueba. */
function stripeDashboardUrl(section: "payments" | "disputes", id: string | null) {
  const base = `https://dashboard.stripe.com${stripeIsTestMode() ? "/test" : ""}/${section}`;
  return id ? `${base}/${id}` : base;
}

function subscriptionState(status: Stripe.Subscription.Status): SubscriptionState {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "canceled":
      return "cancelled";
    case "incomplete_expired":
      return "expired";
    default:
      // past_due, unpaid, paused, incomplete: el cobro no está saliendo.
      return "suspended";
  }
}

/** Encuentra la tienda por la suscripción que originó el evento. */
async function storeForSubscription(
  db: Db,
  subscriptionId: string | null,
  storeId: string | null,
) {
  if (subscriptionId) {
    const { data } = await db
      .from("stores")
      .select("id, name, plan_expires_at, stripe_subscription_status")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    if (data) return data;
  }
  // Respaldo: el store_id que mandamos en la metadata. Cubre el primer cobro,
  // que puede llegar antes de que registremos el id de la suscripción.
  if (storeId) {
    const { data } = await db
      .from("stores")
      .select("id, name, plan_expires_at, stripe_subscription_status")
      .eq("id", storeId)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

/**
 * ¿Cuántos meses compró? Se deduce del monto contra los precios configurados,
 * eligiendo el período más parecido. Es el mismo criterio que el webhook de
 * PayPal, pero sin la constante mágica: si mañana el anual cambia de precio,
 * esto sigue acertando.
 */
function monthsForAmount(amount: number, prices: PlanPrices): number {
  let best = 1;
  let diff = Infinity;
  for (const m of PLAN_PERIODS) {
    const d = Math.abs(priceFor(m, prices) - amount);
    if (d < diff) {
      diff = d;
      best = m;
    }
  }
  return best;
}

/**
 * Registra el cobro y suma los meses.
 *
 * El pago se registra ANTES de tocar el plan, y `stripe_payment_id` es UNIQUE:
 * si el mismo cobro llega dos veces, el insert falla con 23505 y se corta ahí
 * sin regalar meses. Nunca hay meses sin un cobro que los respalde.
 */
async function extendPlan(
  db: Db,
  storeId: string,
  months: number,
  payment: {
    amount: number;
    paymentId: string;
    subscriptionId: string | null;
    customerId: string | null;
  },
) {
  const { error } = await db.from("subscription_payments").insert({
    store_id: storeId,
    period_months: months,
    amount: payment.amount,
    currency: "USD",
    method: "stripe",
    reference: payment.paymentId,
    stripe_payment_id: payment.paymentId,
    stripe_subscription_id: payment.subscriptionId,
    status: "approved",
    reviewed_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505") return; // ya procesado
    throw new Error(`no se pudo registrar el pago del plan: ${error.message}`);
  }

  const { data: store } = await db
    .from("stores")
    .select("name, plan_expires_at")
    .eq("id", storeId)
    .maybeSingle();

  // Después del insert: si el cobro venía repetido ya se cortó arriba, así
  // que acá cada pago avisa una sola vez.
  await recordPlatformEvent({
    type: "plan.paid",
    storeId,
    amount: payment.amount,
    title: `Plan pagado: ${store?.name ?? "tienda"}`,
    detail: `${monthsLabel(months)} con tarjeta${
      payment.subscriptionId ? " · se renueva sola" : ""
    }`,
    url: `/super/tiendas/${storeId}`,
  });

  await db
    .from("stores")
    .update({
      plan: "pro",
      plan_source: "paid",
      plan_expires_at: extendExpiry(store?.plan_expires_at ?? null, months),
      ...(payment.subscriptionId
        ? {
            stripe_subscription_id: payment.subscriptionId,
            stripe_subscription_status: "active" as SubscriptionState,
          }
        : {}),
      ...(payment.customerId ? { stripe_customer_id: payment.customerId } : {}),
    })
    .eq("id", storeId);
}
