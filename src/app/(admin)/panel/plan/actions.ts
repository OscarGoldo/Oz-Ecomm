"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth";
import { PLAN_PERIODS, priceFor } from "@/lib/plans";
import { getPlatformConfig } from "@/lib/platform";
import { reportError } from "@/lib/report-error";
import { appUrl, getStripe, stripePriceFor, toCents } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const schema = z.object({
  period_months: z.coerce
    .number()
    .int()
    .refine((v) => (PLAN_PERIODS as readonly number[]).includes(v), "Período inválido"),
  method: z.enum(["pago_movil", "zelle", "binance"]),
  reference: z.string().trim().max(120).optional(),
  proof_path: z.string().trim().max(400).nullable().optional(),
});

export type UpgradeInput = z.input<typeof schema>;

/**
 * El comerciante reporta que pagó su plan Pro y sube el comprobante.
 *
 * Se escribe con service role y `status` fijo en 'pending': la tabla no tiene
 * policy de INSERT para tenants, así que nadie puede aprobarse el plan a sí
 * mismo. El monto también se recalcula aquí desde los precios configurados —
 * nunca se confía en el que mandó el cliente.
 */
export async function requestProUpgrade(
  input: UpgradeInput,
): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  const ctx = await getSessionContext();
  if (!ctx?.store) return { ok: false, error: "No autorizado" };

  if (!d.proof_path) {
    return { ok: false, error: "Sube la foto del comprobante" };
  }
  // El comprobante debe estar en la carpeta de la propia tienda: evita que se
  // referencie el archivo de otro tenant.
  if (!d.proof_path.startsWith(`${ctx.store.id}/`)) {
    return { ok: false, error: "Comprobante inválido" };
  }

  const db = createAdminClient();

  // Un solo pago en revisión a la vez, para no duplicar meses por doble envío.
  const { count: pending } = await db
    .from("subscription_payments")
    .select("id", { count: "exact", head: true })
    .eq("store_id", ctx.store.id)
    .eq("status", "pending");
  if ((pending ?? 0) > 0) {
    return {
      ok: false,
      error: "Ya tienes un comprobante en revisión. Te avisamos apenas lo confirmemos.",
    };
  }

  const { prices } = await getPlatformConfig();

  const { error } = await db.from("subscription_payments").insert({
    store_id: ctx.store.id,
    period_months: d.period_months,
    amount: priceFor(d.period_months, prices),
    currency: "USD",
    method: d.method,
    reference: d.reference?.trim() || null,
    proof_url: d.proof_path,
    status: "pending",
  });
  if (error) {
    return { ok: false, error: "No se pudo registrar el pago. Intenta de nuevo." };
  }

  revalidatePath("/panel/plan");
  revalidatePath("/panel");
  return { ok: true };
}

/** Los meses que se pueden comprar de una vez. El monto nunca viene del cliente. */
const periodSchema = z.coerce
  .number()
  .int()
  .refine((v) => (PLAN_PERIODS as readonly number[]).includes(v), "Período inválido");

// ── Plan Pro por Stripe ─────────────────────────────────────────────────────
// Una sola pantalla para las dos formas de cobrar: si el período tiene precio
// recurrente creado en Stripe, se contrata la suscripción (se renueva sola); si
// no —hoy el trimestre—, se cobra una vez. Lo decide `stripePriceFor`, no la UI.

export interface StripeCheckoutUrl extends ActionResult {
  url?: string;
}

/**
 * Abre el checkout de Stripe para el plan Pro.
 *
 * El cliente manda SOLO los meses; el monto sale de los precios configurados.
 * Nunca se acepta un precio que venga del navegador — si no, cualquiera pagaría
 * un centavo por doce meses de Pro.
 *
 * Esto NO activa nada: el plan se extiende cuando el webhook confirma el cobro.
 */
export async function createProStripeCheckout(
  months: number,
): Promise<StripeCheckoutUrl> {
  const parsed = periodSchema.safeParse(months);
  if (!parsed.success) return { ok: false, error: "Período inválido" };
  const period = parsed.data;

  const ctx = await getSessionContext();
  if (!ctx?.store) return { ok: false, error: "No autorizado" };
  const store = ctx.store;

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Stripe no está configurado" };

  const { prices } = await getPlatformConfig();
  const amount = priceFor(period, prices);
  const recurring = stripePriceFor(period);
  const base = `${appUrl()}/panel/plan`;
  const metadata = {
    kind: "plan",
    store_id: store.id,
    months: String(period),
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: recurring ? "subscription" : "payment",
      locale: "es",
      client_reference_id: store.id,
      // Se reusa el cliente de Stripe de la tienda si ya lo tiene, así no se
      // acumula un cliente nuevo por cada renovación manual.
      ...(store.stripe_customer_id
        ? { customer: store.stripe_customer_id }
        : { customer_email: ctx.user.email ?? undefined }),
      line_items: [
        recurring
          ? { price: recurring, quantity: 1 }
          : {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: toCents(amount),
                product_data: {
                  name: `Tiendify Pro — ${period} ${period === 1 ? "mes" : "meses"}`,
                },
              },
            },
      ],
      metadata,
      // La metadata tiene que viajar también en el objeto que va a generar los
      // cobros: las renovaciones llegan como factura, sin rastro de la sesión.
      ...(recurring
        ? { subscription_data: { metadata } }
        : { payment_intent_data: { metadata } }),
      success_url: `${base}?pago=ok`,
      cancel_url: `${base}?pago=cancelado`,
    });

    if (!session.url) return { ok: false, error: "No se pudo iniciar el pago" };
    return { ok: true, url: session.url };
  } catch (e) {
    reportError("createProStripeCheckout", e, { storeId: store.id });
    return { ok: false, error: "No se pudo iniciar el pago con tarjeta" };
  }
}

/**
 * Cancela la renovación automática de Stripe.
 *
 * No se toca `plan_expires_at`: lo que ya pagó corre hasta su vencimiento y
 * recién ahí cae a Gratis solo. Cobrarle y cortarle antes sería robarle.
 */
export async function cancelProStripeSubscription(): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx?.store) return { ok: false, error: "No autorizado" };

  const subId = ctx.store.stripe_subscription_id;
  if (!subId) return { ok: false, error: "No tienes una suscripción activa" };

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Stripe no está configurado" };

  try {
    const sub = await stripe.subscriptions.retrieve(subId);
    // Que la suscripción sea de ESTA tienda, no de otra que alguien adivinó.
    if (sub.metadata?.store_id && sub.metadata.store_id !== ctx.store.id) {
      return { ok: false, error: "Esa suscripción no es de esta tienda" };
    }
    await stripe.subscriptions.cancel(subId);
  } catch (e) {
    reportError("cancelProStripeSubscription", e, { storeId: ctx.store.id });
    return { ok: false, error: "No se pudo cancelar. Intenta de nuevo." };
  }

  const db = createAdminClient();
  await db
    .from("stores")
    .update({ stripe_subscription_status: "cancelled" })
    .eq("id", ctx.store.id);

  revalidatePath("/panel/plan");
  return { ok: true };
}
