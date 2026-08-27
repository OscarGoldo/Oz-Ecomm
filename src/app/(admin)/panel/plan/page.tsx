import { Check, Clock, Minus, Sparkles } from "lucide-react";

import { PlanCheckout } from "@/components/admin/plan-checkout";
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
import { SubscriptionStatus } from "@/components/admin/subscription-status";
import { paypalClientId } from "@/lib/paypal";
import { planIdFor, subscriptionsConfigured } from "@/lib/paypal-subscriptions";
import { getPlatformConfig } from "@/lib/platform";
import { createClient } from "@/lib/supabase/server";
import { FREE_LAYOUTS, THEME_PRESETS } from "@/lib/theme";
import type { SubscriptionPayment } from "@/types/database";

export const metadata = { title: "Plan" };

const FEATURES: { label: string; free: string | false; pro: string }[] = [
  {
    label: "Plantillas de diseño",
    free: `${FREE_LAYOUTS.length} estándar`,
    pro: `Las ${THEME_PRESETS.length}`,
  },
  { label: "Productos", free: String(FREE_MAX_PRODUCTS), pro: "Ilimitados" },
  { label: "Pedidos y pagos", free: "Ilimitados", pro: "Ilimitados" },
  { label: "Finanzas y clientes", free: "Sí", pro: "Sí" },
  { label: "Analítica de la tienda", free: false, pro: "Completa" },
  { label: "Cupones de descuento", free: false, pro: "Sí" },
  { label: 'Badge "Hecho con Tiendify"', free: "Visible", pro: "Se quita" },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PlanPage() {
  const { store } = await requireStoreUser();
  const pro = isPro(store);
  const daysLeft = daysUntilExpiry(store);

  const [{ prices, payments, paypalEnabled }, rates, { data: history }] = await Promise.all([
    getPlatformConfig(),
    getCachedBcvRates(),
    createClient()
      .from("subscription_payments")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Suscripción vigente: no se le vuelve a ofrecer contratar.
  const subscribed = store.paypal_subscription_status === "active";
  const recurringOn = paypalEnabled && subscriptionsConfigured();

  const payments_ = (history ?? []) as SubscriptionPayment[];
  const pending = payments_.find((p) => p.status === "pending");
  const lastRejected =
    payments_[0]?.status === "rejected" ? payments_[0] : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tu plan</h1>
        <p className="text-sm text-muted-foreground">
          Lo que incluye tu plan actual y cómo activar Pro.
        </p>
      </div>

      {/* Estado actual */}
      <div
        className={`rounded-2xl border p-4 ${
          pro ? "border-primary/40 bg-primary/5" : "bg-card"
        }`}
      >
        <div className="flex items-center gap-2">
          {pro && <Sparkles className="size-4 text-primary" />}
          <p className="font-semibold">{pro ? "Plan Pro" : "Plan Gratis"}</p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {!pro
            ? "Tienes lo esencial para vender. Activa Pro cuando quieras crecer."
            : store.plan_expires_at
              ? `Vigente hasta el ${fmtDate(store.plan_expires_at)}${
                  daysLeft !== null && daysLeft >= 0
                    ? ` · ${daysLeft} ${daysLeft === 1 ? "día" : "días"}`
                    : ""
                }`
              : "Sin vencimiento. Gracias por estar desde el principio 🙌"}
        </p>
      </div>

      {store.paypal_subscription_id && store.paypal_subscription_status && (
        <SubscriptionStatus
          status={store.paypal_subscription_status}
          expiresAt={store.plan_expires_at}
        />
      )}

      {pending && (
        <p className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <Clock className="size-4 shrink-0" />
          Recibimos tu comprobante por {formatUSD(Number(pending.amount))} el{" "}
          {fmtDate(pending.created_at)}. Lo estamos revisando.
        </p>
      )}

      {lastRejected && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          Tu último comprobante no pudo confirmarse
          {lastRejected.review_note ? `: ${lastRejected.review_note}` : "."} Puedes
          enviarlo de nuevo.
        </p>
      )}

      {/* Comparativa */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium">
          <span />
          <span className="w-20 text-center text-muted-foreground">Gratis</span>
          <span className="w-24 text-center text-primary">
            Pro · {formatUSD(prices.monthly)}/mes
          </span>
        </div>
        <ul>
          {FEATURES.map((f) => (
            <li
              key={f.label}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b px-4 py-2.5 text-sm last:border-0"
            >
              <span>{f.label}</span>
              <span className="w-20 text-center text-xs text-muted-foreground">
                {f.free === false ? (
                  <Minus className="mx-auto size-3.5" />
                ) : (
                  f.free
                )}
              </span>
              <span className="w-24 text-center text-xs font-medium">{f.pro}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Checkout — se oculta con un comprobante en revisión, o con la
          renovación automática ya andando (no tiene sentido resuscribirse). */}
      {!pending && !subscribed && (
        <PlanCheckout
          storeId={store.id}
          prices={prices}
          payments={payments}
          bcvRate={rates?.usd ?? null}
          paypalClientId={paypalEnabled ? paypalClientId() : null}
          planIds={
            recurringOn
              ? // Solo los períodos que tienen plan recurrente creado en
                // PayPal. El trimestre no está y por eso se cobra una vez.
                Object.fromEntries(
                  PLAN_PERIODS.map(
                    (m) => [m, planIdFor(m)] as [number, string | null],
                  ).filter((e): e is [number, string] => e[1] !== null),
                )
              : null
          }
        />
      )}

      {pro && !pending && !subscribed && (
        <p className="text-center text-xs text-muted-foreground">
          Si renuevas antes de que venza, los meses se suman a lo que ya tienes.
        </p>
      )}

      {/* Historial */}
      {payments_.length > 0 && (
        <div className="rounded-2xl border bg-card shadow-sm p-4">
          <h2 className="mb-3 text-sm font-semibold">Tus pagos</h2>
          <ul className="space-y-2">
            {payments_.map((p) => (
              <li key={p.id} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">
                    {formatUSD(Number(p.amount))}
                  </span>{" "}
                  <span className="text-xs text-muted-foreground">
                    · {p.period_months === 1 ? "1 mes" : `${p.period_months} meses`}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {fmtDate(p.created_at)}
                  </span>
                </span>
                <StatusPill status={p.status} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        El precio anual equivale a {formatUSD(priceFor(12, prices) / 12)} por mes.
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: SubscriptionPayment["status"] }) {
  const meta = {
    pending: { label: "En revisión", cls: "bg-warning/15 text-warning-foreground" },
    approved: { label: "Confirmado", cls: "bg-success/15 text-success" },
    rejected: { label: "No confirmado", cls: "bg-destructive/10 text-destructive" },
  }[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}
    >
      {status === "approved" && <Check className="size-3" />}
      {meta.label}
    </span>
  );
}
