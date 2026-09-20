/**
 * Red de seguridad para los pedidos con tarjeta que quedaron colgados.
 *
 *   npx tsx --env-file=.env.local scripts/stripe-reconcile.ts          (solo mira)
 *   npx tsx --env-file=.env.local scripts/stripe-reconcile.ts --aplica (confirma)
 *
 * Para qué: el pedido con Stripe lo confirma el webhook. Si el webhook estuvo
 * caído, mal configurado o Stripe no pudo entregarlo, el cliente pagó y su
 * pedido se quedó en "esperando pago". Esto le pregunta a Stripe, pedido por
 * pedido, si la sesión está pagada — y si lo está, lo confirma igual que lo
 * habría hecho el webhook: mismo control de monto, misma comisión y neto.
 *
 * Lo primero que hay que hacer siempre es ARREGLAR el webhook y probar a
 * reenviar el evento desde el dashboard de Stripe, porque ese camino sí manda
 * los avisos (email al dueño, WhatsApp, recibo al cliente). Este script NO los
 * manda: solo pone el pedido en su lugar para que la venta no se pierda.
 *
 * Sin `--aplica` no escribe nada.
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const apply = process.argv.includes("--aplica");

const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

async function main() {
  if (!key || !url || !serviceRole) {
    console.error(
      "Faltan STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  const stripe = new Stripe(key, { typescript: true });
  const db = createClient(url, serviceRole, { auth: { persistSession: false } });

  const { data: orders, error } = await db
    .from("orders")
    .select("id, order_number, store_id, total, status, stripe_session_id")
    .eq("payment_method_type", "stripe")
    .eq("status", "pending_payment")
    .not("stripe_session_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("No se pudieron leer los pedidos:", error.message);
    process.exit(1);
  }
  if (!orders?.length) {
    console.log("No hay pedidos con tarjeta esperando pago. Todo en orden.");
    return;
  }

  console.log(
    `${orders.length} pedido(s) esperando pago${apply ? "" : " · modo lectura, no se escribe nada"}\n`,
  );

  for (const order of orders) {
    const label = `#${order.order_number} (${order.total} USD)`;

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(order.stripe_session_id!);
    } catch {
      console.log(`${label}: no se pudo leer la sesión en Stripe. ¿Clave de otro modo (test/live)?`);
      continue;
    }

    if (session.payment_status !== "paid") {
      console.log(`${label}: sin pagar (${session.status}/${session.payment_status}). Se deja como está.`);
      continue;
    }

    const expected = Math.round(Number(order.total) * 100);
    if (session.amount_total !== expected) {
      console.log(
        `${label}: ⚠ PAGADO pero por ${session.amount_total} centavos y el pedido dice ${expected}. Revisar a mano.`,
      );
      continue;
    }

    const intentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    let fee: number | null = null;
    let net: number | null = null;
    if (intentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(intentId, {
          expand: ["latest_charge.balance_transaction"],
        });
        const charge = pi.latest_charge;
        if (charge && typeof charge !== "string") {
          const bt = charge.balance_transaction;
          if (bt && typeof bt !== "string") {
            const rate = bt.currency !== "usd" && bt.exchange_rate ? bt.exchange_rate : 1;
            fee = Math.round((bt.fee / 100 / rate) * 100) / 100;
            net = Math.round((bt.net / 100 / rate) * 100) / 100;
          }
        }
      } catch {
        /* sin desglose: se confirma igual con net = total */
      }
    }

    if (!apply) {
      console.log(`${label}: PAGADO. Se confirmaría (comisión ${fee ?? "?"}, neto ${net ?? order.total}).`);
      continue;
    }

    const { data: claimed, error: updErr } = await db
      .from("orders")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        payment_reference: intentId,
        stripe_payment_intent: intentId,
        payment_fee: fee,
        payment_net: net ?? Number(order.total),
      })
      .eq("id", order.id)
      // El mismo candado que usa el webhook: si el webhook llegó primero, acá
      // ya no hay nada que hacer.
      .eq("status", "pending_payment")
      .select("id")
      .maybeSingle();

    if (updErr) {
      console.log(`${label}: error al confirmar — ${updErr.message}`);
    } else if (!claimed) {
      console.log(`${label}: ya lo había confirmado otro (el webhook, seguro).`);
    } else {
      console.log(`${label}: ✓ confirmado. Avísale al cliente a mano: no se mandó el recibo.`);
    }
  }

  if (!apply) {
    console.log("\nNada se escribió. Para aplicarlo: agregá --aplica al comando.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
