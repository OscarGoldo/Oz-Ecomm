import { ArrowDown, Check, Clock, Minus, XCircle } from "lucide-react";

import { PlanCheckout } from "@/components/admin/plan-checkout";
import { SubscriptionStatus } from "@/components/admin/subscription-status";
import { TagOutline } from "@/components/landing/landing-ui";
import { Badge } from "@/components/ui/badge";
import { requireStoreUser } from "@/lib/auth";
import { getCachedBcvRates } from "@/lib/bcv";
import { formatUSD } from "@/lib/format";
import {
  FREE_MAX_PRODUCTS,
  PLAN_PERIODS,
  daysUntilExpiry,
  isPro,
  priceFor,
} from "@/lib/plans";
import { paypalClientId } from "@/lib/paypal";
import { planIdFor, subscriptionsConfigured } from "@/lib/paypal-subscriptions";
import { stripePriceFor } from "@/lib/stripe";
import { getPlatformConfig } from "@/lib/platform";
import { createClient } from "@/lib/supabase/server";
import { FREE_LAYOUTS, THEME_PRESETS } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { SubscriptionMethod, SubscriptionPayment } from "@/types/database";

export const metadata = { title: "Plan" };

/** `true` = incluido sin más detalle (se dibuja como un check). */
const FEATURES: { label: string; free: string | boolean; pro: string | boolean }[] = [
  {
    label: "Plantillas de diseño",
    free: `${FREE_LAYOUTS.length} estándar`,
    pro: `Las ${THEME_PRESETS.length}`,
  },
  { label: "Productos", free: String(FREE_MAX_PRODUCTS), pro: "Ilimitados" },
  // Ver src/lib/store-url.ts: en Gratis la tienda vive en usatiendify.com/tutienda.
  { label: "Dirección propia (tutienda.usatiendify.com)", free: false, pro: true },
  { label: "Pedidos y pagos", free: "Ilimitados", pro: "Ilimitados" },
  { label: "Finanzas y clientes", free: true, pro: true },
  { label: "Analítica de la tienda", free: false, pro: "Completa" },
  { label: "Cupones de descuento", free: false, pro: true },
  { label: 'Sello "Hecho con Tiendify"', free: "Visible", pro: "Se quita" },
];

const METHOD_LABEL: Record<SubscriptionMethod, string> = {
  pago_movil: "Pago Móvil",
  zelle: "Zelle",
  binance: "Binance",
  paypal: "PayPal",
  stripe: "Tarjeta",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Qué se cobra y cuándo toca de nuevo, deducido del último cobro que entró por
 * esa suscripción (los pagos vienen del más nuevo al más viejo).
 *
 * No sale de `plan_expires_at`: un mes de regalo por un referido corre el
 * vencimiento del plan, pero no la fecha en que se vuelve a cobrar.
 */
function nextCharge(payments: SubscriptionPayment[], subscriptionId: string) {
  const last = payments.find(
    (p) =>
      p.status === "approved" &&
      (p.stripe_subscription_id === subscriptionId ||
        p.paypal_subscription_id === subscriptionId),
  );
  if (!last) return null;
  const next = new Date(last.created_at);
  next.setMonth(next.getMonth() + last.period_months);
  return {
    label: `${formatUSD(Number(last.amount))} al ${
      last.period_months >= 12 ? "año" : "mes"
    }`,
    nextDate: fmtDate(next.toISOString()),
  };
}

/**
 * Tu plan. Arriba, en noche como la barra lateral, qué plan tiene la tienda y
 * cuánto le queda (o cuánto del cupo de productos va usado). Abajo, lado a
 * lado en escritorio, qué incluye cada plan y cómo activar Pro. Al final, los
 * pagos que ya hizo.
 */
export default async function PlanPage() {
  const { store } = await requireStoreUser();
  const pro = isPro(store);
  const daysLeft = daysUntilExpiry(store);

  const [
    { prices, payments, paypalEnabled, stripeEnabled },
    rates,
    { data: history },
    { count: productCount },
  ] = await Promise.all([
    getPlatformConfig(),
    getCachedBcvRates(),
    createClient()
      .from("subscription_payments")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(10),
    createClient()
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
  ]);

  // Suscripción vigente (con cualquiera de los dos): no se le vuelve a
  // ofrecer contratar.
  const subscribed =
    store.paypal_subscription_status === "active" ||
    store.stripe_subscription_status === "active";
  const recurringOn = paypalEnabled && subscriptionsConfigured();

  const payments_ = (history ?? []) as SubscriptionPayment[];
  const until = store.plan_expires_at ? fmtDate(store.plan_expires_at) : null;
  const pending = payments_.find((p) => p.status === "pending");
  const lastRejected =
    payments_[0]?.status === "rejected" ? payments_[0] : undefined;

  // El checkout se oculta con un comprobante en revisión, con la renovación
  // automática ya andando (no tiene sentido resuscribirse) o con un Pro sin
  // vencimiento, que no tiene nada que renovar.
  const lifetime = pro && !store.plan_expires_at;
  const showCheckout = !pending && !subscribed && !lifetime;
  const used = productCount ?? 0;
  const usedPct = Math.min(100, Math.round((used / FREE_MAX_PRODUCTS) * 100));
  const expiringSoon = pro && daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

  return (
    <div className="space-y-6">
      <header>
        <p className="font-landing-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          Negocio
        </p>
        <h1 className="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.028em]">
          Tu plan
        </h1>
        <p className="mt-1.5 text-[15px] text-ink-600">
          Lo que incluye tu plan y cómo pasar a Pro.
        </p>
      </header>

      {/* El plan de hoy */}
      <section
        aria-label="Tu plan hoy"
        className="relative isolate overflow-hidden rounded-2xl bg-noche p-6 text-white sm:p-7"
      >
        <TagOutline className="pointer-events-none absolute -right-14 -top-16 -z-10 w-72 text-white/[0.07]" />
        <p className="font-landing-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-niebla">
          Tu plan hoy
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="font-display text-[2.6rem] font-bold leading-none tracking-[-0.03em]">
              {pro ? "Pro" : "Gratis"}
            </p>
            <p className="mt-2.5 max-w-[46ch] text-[15px] leading-relaxed text-white/75">
              {!pro
                ? "Tienes lo esencial para vender. Activa Pro cuando quieras crecer."
                : until
                  ? `Vigente hasta el ${until}.`
                  : "Sin vencimiento. Gracias por estar desde el principio."}
            </p>
          </div>
          {pro && daysLeft !== null && daysLeft >= 0 && (
            <span
              className={cn(
                "inline-flex h-9 items-center rounded-full px-3.5 font-landing-mono text-[13px] font-semibold tabular-nums",
                expiringSoon ? "bg-sol text-noche" : "bg-white/[0.1] text-white",
              )}
            >
              Quedan {daysLeft} {daysLeft === 1 ? "día" : "días"}
            </span>
          )}
          {!pro && showCheckout && (
            <a
              href="#activar"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-sol px-5 text-sm font-bold text-noche transition-transform active:scale-[0.97]"
            >
              Activar Pro desde {formatUSD(prices.monthly)} al mes <ArrowDown className="size-4" />
            </a>
          )}
        </div>

        {!pro && (
          <div className="mt-6 max-w-md">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-white/75">Productos cargados</span>
              <span className="font-landing-mono font-semibold tabular-nums">
                {used} de {FREE_MAX_PRODUCTS}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/[0.12]">
              <div
                className={cn("h-2 rounded-full", usedPct >= 80 ? "bg-sol" : "bg-brand-400")}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            {usedPct >= 80 && (
              <p className="mt-2 text-[13px] text-white/75">
                Te quedan {Math.max(0, FREE_MAX_PRODUCTS - used)}. Con Pro no hay tope.
              </p>
            )}
          </div>
        )}
      </section>

      {store.stripe_subscription_id && store.stripe_subscription_status ? (
        <SubscriptionStatus
          provider="stripe"
          status={store.stripe_subscription_status}
          until={until}
          charge={nextCharge(payments_, store.stripe_subscription_id)}
        />
      ) : (
        store.paypal_subscription_id &&
        store.paypal_subscription_status && (
          <SubscriptionStatus
            status={store.paypal_subscription_status}
            until={until}
            charge={nextCharge(payments_, store.paypal_subscription_id)}
          />
        )
      )}

      {pending && (
        <div className="flex items-start gap-3 rounded-2xl border border-info-border bg-info-surface p-4 text-sm text-info-text">
          <Clock className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">Recibimos tu comprobante</span> por{" "}
            <span className="font-landing-mono font-semibold">
              {formatUSD(Number(pending.amount))}
            </span>{" "}
            el {fmtDate(pending.created_at)}. Lo estamos revisando y te activamos
            el plan apenas lo confirmemos.
          </p>
        </div>
      )}

      {lastRejected && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive-border bg-destructive-surface p-4 text-sm text-destructive-text">
          <XCircle className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">Tu último comprobante no pudo confirmarse</span>
            {lastRejected.review_note ? `: ${lastRejected.review_note}` : "."} Puedes
            enviarlo de nuevo.
          </p>
        </div>
      )}

      <div
        className={cn(
          "grid items-start gap-5",
          showCheckout && "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]",
        )}
      >
        <section
          aria-labelledby="incluye"
          className={cn("overflow-hidden rounded-2xl border bg-card", !showCheckout && "max-w-3xl")}
        >
          <div className="border-b px-5 py-4">
            <h2 id="incluye" className="font-display text-lg font-bold tracking-[-0.02em]">
              Qué incluye cada plan
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left font-landing-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-500">
                <th className="px-5 py-3">
                  <span className="sr-only">Función</span>
                </th>
                <th className="w-[5.5rem] px-2 py-3 text-center">Gratis</th>
                <th className="w-[6.5rem] bg-brand-50 px-2 py-3 text-center text-brand-700">
                  Pro
                  <span className="mt-0.5 block font-landing-body text-[13px] font-bold normal-case tracking-normal text-foreground">
                    {formatUSD(prices.monthly)}/mes
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {FEATURES.map((f) => (
                <tr key={f.label}>
                  <td className="px-5 py-3 font-medium [overflow-wrap:anywhere]">{f.label}</td>
                  <td className="px-2 py-3 text-center text-[13px] text-ink-600">
                    <FeatureValue value={f.free} />
                  </td>
                  <td className="bg-brand-50/60 px-2 py-3 text-center text-[13px] font-semibold">
                    <FeatureValue value={f.pro} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t bg-ink-25 px-5 py-3 text-[13px] text-ink-600">
            El anual equivale a{" "}
            <span className="font-landing-mono font-semibold text-foreground">
              {formatUSD(priceFor(12, prices) / 12)}
            </span>{" "}
            por mes.
          </p>
        </section>

        {showCheckout && (
          <div id="activar" className="scroll-mt-24 space-y-3 xl:sticky xl:top-24">
            <PlanCheckout
              renewing={pro}
              storeId={store.id}
              prices={prices}
              payments={payments}
              bcvRate={rates?.usd ?? null}
              paypalClientId={paypalEnabled ? paypalClientId() : null}
              stripeEnabled={stripeEnabled}
              stripeRecurringPeriods={PLAN_PERIODS.filter(
                (m) => stripePriceFor(m) !== null,
              )}
              planIds={
                recurringOn
                  ? // Solo los períodos que tienen plan recurrente creado en
                    // PayPal. El que no esté se cobra una sola vez.
                    Object.fromEntries(
                      PLAN_PERIODS.map(
                        (m) => [m, planIdFor(m)] as [number, string | null],
                      ).filter((e): e is [number, string] => e[1] !== null),
                    )
                  : null
              }
            />
            {pro && (
              <p className="text-center text-[13px] text-ink-600">
                Si renuevas antes de que venza, los meses se suman a lo que ya tienes.
              </p>
            )}
          </div>
        )}
      </div>

      {payments_.length > 0 && (
        <section aria-labelledby="tus-pagos" className="overflow-hidden rounded-2xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 id="tus-pagos" className="font-display text-lg font-bold tracking-[-0.02em]">
              Tus pagos
            </h2>
          </div>
          <ul className="divide-y divide-ink-100">
            {payments_.map((p) => (
              <li
                key={p.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
              >
                <span className="font-landing-mono text-[15px] font-semibold tabular-nums">
                  {formatUSD(Number(p.amount))}
                </span>
                <span className="order-last col-span-2 min-w-0 text-[13px] text-ink-600 sm:order-none sm:col-span-1">
                  {p.period_months === 1
                    ? "1 mes"
                    : p.period_months === 12
                      ? "1 año"
                      : `${p.period_months} meses`}{" "}
                  · {METHOD_LABEL[p.method] ?? p.method} · {fmtDate(p.created_at)}
                </span>
                <PaymentBadge status={p.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FeatureValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <>
        <Check className="mx-auto size-4 text-success-text" strokeWidth={2.5} />
        <span className="sr-only">Sí</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus className="mx-auto size-4 text-ink-400" />
        <span className="sr-only">No</span>
      </>
    );
  }
  return <>{value}</>;
}

function PaymentBadge({ status }: { status: SubscriptionPayment["status"] }) {
  if (status === "approved") {
    return (
      <Badge variant="success">
        <Check className="size-3" /> Confirmado
      </Badge>
    );
  }
  if (status === "rejected") return <Badge variant="danger">No confirmado</Badge>;
  return <Badge variant="warning">En revisión</Badge>;
}
