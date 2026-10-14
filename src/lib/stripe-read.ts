import "server-only";

import Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lo que muestra /super/stripe, leído con una llave restringida de SOLO
 * LECTURA (STRIPE_READ_KEY) y no con la principal.
 *
 * La pantalla solo mira: saldo, cobros, disputas, depósitos y suscripciones.
 * Con una llave aparte, si alguna vez se filtra, con ella no se puede cobrar,
 * reembolsar ni cancelar nada. Por eso no cae a STRIPE_SECRET_KEY cuando falta:
 * sin la llave de lectura la pantalla lo dice y no muestra nada.
 *
 * En Stripe: API keys → Crear clave restringida → plantilla "Reporting,
 * analytics, and accounting", con Read en Balance, Charges, Disputes, Payouts,
 * PaymentIntents, Customers, Invoices, Subscriptions y Events.
 */

let cached: Stripe | null = null;

function readKey(): string {
  return (process.env.STRIPE_READ_KEY ?? "").trim();
}

function reader(): Stripe | null {
  const key = readKey();
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, {
      typescript: true,
      appInfo: { name: "Tiendify super admin" },
      // Es una pantalla, no un cobro: mejor un error rápido que una página
      // colgada esperando a Stripe.
      timeout: 10_000,
      maxNetworkRetries: 1,
    });
  }
  return cached;
}

export function stripeReadConfigured(): boolean {
  return Boolean(readKey());
}

export function stripeReadIsTestMode(): boolean {
  return /^(rk|sk)_test_/.test(readKey());
}

/** Enlace a algo en el dashboard de Stripe, respetando el modo de prueba. */
export function stripeDashboardLink(path = ""): string {
  return `https://dashboard.stripe.com${stripeReadIsTestMode() ? "/test" : ""}${path}`;
}

/** Cada bloque se lee por separado: que falle uno no deja la pantalla en blanco. */
export type Section<T> = { ok: true; data: T } | { ok: false; error: string };

export interface Money {
  currency: string;
  /** En unidades, no en centavos. */
  amount: number;
}

export type ChargeKind = "order" | "plan" | "unknown";

export interface ChargeRow {
  id: string;
  created: string;
  amount: number;
  currency: string;
  status: "succeeded" | "pending" | "failed";
  refunded: boolean;
  amountRefunded: number;
  disputed: boolean;
  /** Comisión y neto en la moneda en que liquidó Stripe (puede no ser USD). */
  fee: number | null;
  net: number | null;
  settleCurrency: string | null;
  paymentIntentId: string | null;
  /** De qué es este cobro en Tiendify. */
  kind: ChargeKind;
  storeId: string | null;
  label: string;
}

export interface DisputeRow {
  id: string;
  amount: number;
  currency: string;
  status: Stripe.Dispute.Status;
  reason: string;
  created: string;
  /** Fecha límite para mandar la evidencia, si está abierta. */
  dueBy: string | null;
  label: string;
  storeId: string | null;
}

export interface PayoutRow {
  id: string;
  amount: number;
  currency: string;
  status: Stripe.Payout["status"];
  arrival: string;
}

export interface SubscriptionsSummary {
  active: number;
  pastDue: number;
  cancelAtPeriodEnd: number;
  /** Las que se cobran en los próximos 7 días. */
  renewingSoon: number;
  renewingSoonAmount: number;
  /** Las que no se están pudiendo cobrar, con su tienda. */
  pastDueStores: { storeId: string | null; label: string }[];
}

export interface StripePanel {
  balance: Section<{ available: Money[]; pending: Money[] }>;
  payouts: Section<PayoutRow[]>;
  /** Últimos 30 días, del más nuevo al más viejo. */
  charges: Section<ChargeRow[]>;
  disputes: Section<DisputeRow[]>;
  subscriptions: Section<SubscriptionsSummary>;
}

const OPEN_DISPUTE: Stripe.Dispute.Status[] = [
  "warning_needs_response",
  "needs_response",
  "under_review",
  "warning_under_review",
];

function iso(unix: number): string {
  return new Date(unix * 1000).toISOString();
}

function idOf(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id;
}

/** Lo que se le dice al super admin cuando un bloque no se pudo leer. */
function explain(e: unknown, resource: string): string {
  const err = e as { type?: string; message?: string };
  if (err?.type === "StripePermissionError") {
    return `La llave de lectura no tiene permiso para ${resource}. Agrégalo en Stripe → API keys.`;
  }
  if (err?.type === "StripeAuthenticationError") {
    return "Stripe no reconoce la llave de lectura. Revisa STRIPE_READ_KEY en Vercel.";
  }
  return `No se pudo leer ${resource} de Stripe (${err?.message ?? "sin detalle"}).`;
}

async function section<T>(
  resource: string,
  run: () => Promise<T>,
): Promise<Section<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (e) {
    return { ok: false, error: explain(e, resource) };
  }
}

interface Attribution {
  kind: ChargeKind;
  storeId: string | null;
  label: string;
}

/**
 * De qué es cada cobro en Tiendify. Stripe solo sabe que entró plata; esto lo
 * cruza con la base:
 *
 *  1. Venta de una tienda: por el `order_id` que el checkout deja en la
 *     metadata, o por el payment intent guardado en el pedido.
 *  2. Plan: por el cliente de Stripe de la tienda (suscripciones), o por el
 *     payment intent guardado en el pago del plan (pago único).
 *
 * Lo que no cae en ninguno es un cobro sin nada detrás en Tiendify, y es lo
 * que la conciliación tiene que mostrar.
 */
async function attribute(
  items: {
    key: string;
    paymentIntentId: string | null;
    customerId: string | null;
    metadata: Record<string, string>;
  }[],
): Promise<Map<string, Attribution>> {
  const db = createAdminClient();
  const orderIds = [
    ...new Set(items.map((i) => i.metadata.order_id).filter(Boolean)),
  ];
  const intents = [
    ...new Set(items.map((i) => i.paymentIntentId).filter((v): v is string => !!v)),
  ];
  const customers = [
    ...new Set(items.map((i) => i.customerId).filter((v): v is string => !!v)),
  ];

  const empty = { data: [] as never[] };
  const [byId, byIntent, byCustomer, planPayments] = await Promise.all([
    orderIds.length
      ? db.from("orders").select("id, store_id, order_number, stripe_payment_intent").in("id", orderIds)
      : empty,
    intents.length
      ? db.from("orders").select("id, store_id, order_number, stripe_payment_intent").in("stripe_payment_intent", intents)
      : empty,
    customers.length
      ? db.from("stores").select("id, stripe_customer_id").in("stripe_customer_id", customers)
      : empty,
    intents.length
      ? db.from("subscription_payments").select("store_id, stripe_payment_id").in("stripe_payment_id", intents)
      : empty,
  ]);

  type OrderRef = { id: string; store_id: string; order_number: number; stripe_payment_intent: string | null };
  const orders = new Map<string, OrderRef>();
  const ordersByIntent = new Map<string, OrderRef>();
  for (const o of [...(byId.data ?? []), ...(byIntent.data ?? [])] as OrderRef[]) {
    orders.set(o.id, o);
    if (o.stripe_payment_intent) ordersByIntent.set(o.stripe_payment_intent, o);
  }
  const storeByCustomer = new Map(
    ((byCustomer.data ?? []) as { id: string; stripe_customer_id: string }[]).map(
      (s) => [s.stripe_customer_id, s.id],
    ),
  );
  const planByIntent = new Map(
    ((planPayments.data ?? []) as { store_id: string; stripe_payment_id: string }[]).map(
      (p) => [p.stripe_payment_id, p.store_id],
    ),
  );

  const storeIds = new Set<string>();
  const raw = new Map<string, { kind: ChargeKind; storeId: string | null; order?: OrderRef }>();
  for (const i of items) {
    const order =
      (i.metadata.order_id && orders.get(i.metadata.order_id)) ||
      (i.paymentIntentId && ordersByIntent.get(i.paymentIntentId)) ||
      undefined;
    let r: { kind: ChargeKind; storeId: string | null; order?: OrderRef };
    if (order) {
      r = { kind: "order", storeId: order.store_id, order };
    } else {
      const planStore =
        (i.customerId && storeByCustomer.get(i.customerId)) ||
        (i.paymentIntentId && planByIntent.get(i.paymentIntentId)) ||
        (i.metadata.kind === "plan" ? i.metadata.store_id : undefined);
      r = planStore
        ? { kind: "plan", storeId: planStore }
        : // Una venta con tarjeta cuyo pedido nunca se creó deja la tienda en
          // la metadata: sirve para decir de quién es, aunque no cuadre.
          { kind: "unknown", storeId: i.metadata.store_id ?? null };
    }
    if (r.storeId) storeIds.add(r.storeId);
    raw.set(i.key, r);
  }

  const { data: stores } = storeIds.size
    ? await db.from("stores").select("id, name").in("id", [...storeIds])
    : { data: [] };
  const storeName = new Map((stores ?? []).map((s) => [s.id, s.name]));

  const out = new Map<string, Attribution>();
  for (const [key, r] of raw) {
    const name = r.storeId ? (storeName.get(r.storeId) ?? "tienda borrada") : null;
    out.set(key, {
      kind: r.kind,
      storeId: r.storeId,
      label:
        r.kind === "order"
          ? `Venta #${r.order!.order_number} · ${name}`
          : r.kind === "plan"
            ? `Plan · ${name}`
            : name
              ? `Sin pedido en Tiendify · ${name}`
              : "Sin asociar en Tiendify",
    });
  }
  return out;
}

/** Todo lo de la pantalla. null si no hay llave de lectura. */
export async function getStripePanel(): Promise<StripePanel | null> {
  const s = reader();
  if (!s) return null;

  const since = Math.floor(Date.now() / 1000) - 30 * 86_400;

  const [balance, payouts, rawCharges, rawDisputes, rawSubs] = await Promise.all([
    section("ver el saldo (Balance)", async () => {
      const b = await s.balance.retrieve();
      const money = (list: Stripe.Balance.Available[] | Stripe.Balance.Pending[]) =>
        list.map((m) => ({ currency: m.currency, amount: m.amount / 100 }));
      return { available: money(b.available), pending: money(b.pending) };
    }),
    section("ver los depósitos (Payouts)", async () => {
      const list = await s.payouts.list({ limit: 6 });
      return list.data.map(
        (p): PayoutRow => ({
          id: p.id,
          amount: p.amount / 100,
          currency: p.currency,
          status: p.status,
          arrival: iso(p.arrival_date),
        }),
      );
    }),
    section("ver los cobros (Charges)", () =>
      s.charges
        .list({ created: { gte: since }, limit: 100, expand: ["data.balance_transaction"] })
        .autoPagingToArray({ limit: 300 }),
    ),
    section("ver las disputas (Disputes)", async () => (await s.disputes.list({ limit: 20 })).data),
    section("ver las suscripciones (Subscriptions)", () =>
      s.subscriptions.list({ status: "all", limit: 100 }).autoPagingToArray({ limit: 500 }),
    ),
  ]);

  // Un solo cruce con la base para cobros, disputas y suscripciones.
  const keys: Parameters<typeof attribute>[0] = [];
  if (rawCharges.ok) {
    for (const c of rawCharges.data) {
      keys.push({
        key: c.id,
        paymentIntentId: idOf(c.payment_intent),
        customerId: idOf(c.customer),
        metadata: c.metadata ?? {},
      });
    }
  }
  if (rawDisputes.ok) {
    for (const d of rawDisputes.data) {
      keys.push({
        key: d.id,
        paymentIntentId: idOf(d.payment_intent),
        customerId: null,
        metadata: d.metadata ?? {},
      });
    }
  }
  if (rawSubs.ok) {
    for (const sub of rawSubs.data) {
      keys.push({
        key: sub.id,
        paymentIntentId: null,
        customerId: idOf(sub.customer),
        metadata: sub.metadata ?? {},
      });
    }
  }
  const who = keys.length ? await attribute(keys) : new Map<string, Attribution>();
  const unknown: Attribution = { kind: "unknown", storeId: null, label: "Sin asociar en Tiendify" };

  const charges: Section<ChargeRow[]> = rawCharges.ok
    ? {
        ok: true,
        data: rawCharges.data.map((c): ChargeRow => {
          const bt =
            c.balance_transaction && typeof c.balance_transaction !== "string"
              ? c.balance_transaction
              : null;
          const a = who.get(c.id) ?? unknown;
          return {
            id: c.id,
            created: iso(c.created),
            amount: c.amount / 100,
            currency: c.currency,
            // Los tipos de Stripe dejan abierta la lista de estados: lo que no es
            // "succeeded" ni "failed" se muestra como pendiente.
            status:
              c.status === "succeeded"
                ? "succeeded"
                : c.status === "failed"
                  ? "failed"
                  : "pending",
            refunded: c.refunded,
            amountRefunded: c.amount_refunded / 100,
            disputed: c.disputed,
            fee: bt ? bt.fee / 100 : null,
            net: bt ? bt.net / 100 : null,
            settleCurrency: bt?.currency ?? null,
            paymentIntentId: idOf(c.payment_intent),
            kind: a.kind,
            storeId: a.storeId,
            label: a.label,
          };
        }),
      }
    : rawCharges;

  const disputes: Section<DisputeRow[]> = rawDisputes.ok
    ? {
        ok: true,
        data: rawDisputes.data.map((d): DisputeRow => {
          const a = who.get(d.id) ?? unknown;
          return {
            id: d.id,
            amount: d.amount / 100,
            currency: d.currency,
            status: d.status,
            reason: d.reason,
            created: iso(d.created),
            dueBy:
              OPEN_DISPUTE.includes(d.status) && d.evidence_details?.due_by
                ? iso(d.evidence_details.due_by)
                : null,
            label: a.label,
            storeId: a.storeId,
          };
        }),
      }
    : rawDisputes;

  let subscriptions: Section<SubscriptionsSummary>;
  if (rawSubs.ok) {
    const soon = Date.now() + 7 * 86_400_000;
    const summary: SubscriptionsSummary = {
      active: 0,
      pastDue: 0,
      cancelAtPeriodEnd: 0,
      renewingSoon: 0,
      renewingSoonAmount: 0,
      pastDueStores: [],
    };
    for (const sub of rawSubs.data) {
      if (sub.status === "active" || sub.status === "trialing") {
        summary.active += 1;
        if (sub.cancel_at_period_end) {
          summary.cancelAtPeriodEnd += 1;
          continue;
        }
        // Desde la API de 2025 el fin del período vive en cada ítem.
        const item = sub.items.data[0];
        const end = item?.current_period_end ? item.current_period_end * 1000 : null;
        if (end && end <= soon) {
          summary.renewingSoon += 1;
          summary.renewingSoonAmount +=
            ((item?.price?.unit_amount ?? 0) * (item?.quantity ?? 1)) / 100;
        }
      } else if (sub.status === "past_due" || sub.status === "unpaid") {
        summary.pastDue += 1;
        const a = who.get(sub.id) ?? unknown;
        summary.pastDueStores.push({
          storeId: a.storeId,
          label: a.kind === "plan" ? a.label.replace(/^Plan · /, "") : a.label,
        });
      }
    }
    subscriptions = { ok: true, data: summary };
  } else {
    subscriptions = rawSubs;
  }

  return { balance, payouts, charges, disputes, subscriptions };
}

export function isOpenDispute(status: Stripe.Dispute.Status): boolean {
  return OPEN_DISPUTE.includes(status);
}
