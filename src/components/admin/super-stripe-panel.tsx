import Link from "next/link";
import {
  CircleCheck,
  ExternalLink,
  HandCoins,
  Landmark,
  Receipt,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type Stripe from "stripe";

import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { formatUSD } from "@/lib/format";
import { SALES_STATUSES } from "@/lib/metrics";
import {
  getStripePanel,
  isOpenDispute,
  stripeDashboardLink,
  stripeReadConfigured,
  stripeReadIsTestMode,
  type ChargeRow,
} from "@/lib/stripe-read";
import { createAdminClient } from "@/lib/supabase/admin";
import { agoTime, calendarDate, shortDate } from "@/lib/super-format";
import { cn } from "@/lib/utils";

/** Cualquier moneda; USD con el mismo formato que el resto del panel. */
function money(amount: number, currency: string): string {
  if (currency.toLowerCase() === "usd") return formatUSD(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

const DISPUTE_STATUS: Partial<Record<Stripe.Dispute.Status, string>> = {
  warning_needs_response: "hay que responder",
  needs_response: "hay que responder",
  warning_under_review: "en revisión",
  under_review: "en revisión",
  won: "ganada",
  lost: "perdida",
  warning_closed: "cerrada",
};

const PAYOUT_STATUS: Record<string, { label: string; variant: "success" | "info" | "neutral" | "danger" }> = {
  paid: { label: "Depositado", variant: "success" },
  in_transit: { label: "En camino", variant: "info" },
  pending: { label: "Pendiente", variant: "neutral" },
  failed: { label: "Falló", variant: "danger" },
  canceled: { label: "Cancelado", variant: "neutral" },
};

function chargeBadge(c: ChargeRow): {
  label: string;
  variant: "success" | "warning" | "danger" | "neutral";
} {
  if (c.disputed) return { label: "En disputa", variant: "danger" };
  if (c.refunded) return { label: "Reembolsado", variant: "neutral" };
  if (c.amountRefunded > 0) return { label: "Reembolso parcial", variant: "warning" };
  if (c.status === "failed") return { label: "Falló", variant: "warning" };
  if (c.status === "pending") return { label: "Pendiente", variant: "neutral" };
  return { label: "Pagado", variant: "success" };
}

/**
 * La plata de Tiendify en Stripe, separada como la necesita quien maneja el
 * negocio: lo que se ganó con planes, lo que se le debe a las tiendas, y lo
 * que hay que atender (disputas, cobros que fallan, cobros sin nada detrás).
 *
 * Ojo con un número que NO está acá a propósito: "saldo menos lo que se debe".
 * Stripe deposita solo todo su saldo en el banco, incluida la plata de las
 * tiendas, así que el saldo de Stripe casi siempre está cerca de cero y esa
 * resta daría negativo aunque el negocio vaya bien. Lo que se le debe a las
 * tiendas se paga desde el banco.
 *
 * Lee con service role y con la llave de Stripe: quien la renderiza tiene que
 * haber pasado antes por `requireSuperAdmin()` (ver /super/stripe).
 */
export async function SuperStripePanel() {
  if (!stripeReadConfigured()) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold tracking-tight">Stripe</h1>
        <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-medium">Falta la llave de lectura de Stripe</p>
          <p>
            Esta pantalla lee Stripe con una llave restringida de solo lectura,
            aparte de la que cobra. Créala en Stripe → API keys → Crear clave
            restringida (plantilla &quot;Reporting, analytics, and
            accounting&quot;) y cárgala en Vercel como{" "}
            <code className="font-mono text-xs">STRIPE_READ_KEY</code>.
          </p>
        </div>
      </div>
    );
  }

  const [panel, { data: unpaid }] = await Promise.all([
    getStripePanel(),
    createAdminClient()
      .from("orders")
      .select("payment_method_type, total, payment_net")
      .in("payment_method_type", ["stripe", "paypal"])
      .in("status", SALES_STATUSES)
      .is("paid_out_at", null),
  ]);
  if (!panel) return null;

  const now = new Date();

  // Lo que se le debe a las tiendas, separado por dónde entró la plata. Lo de
  // PayPal no está en Stripe: son ventas viejas que cobró la cuenta de PayPal.
  let owedCard = 0;
  let owedPaypal = 0;
  for (const o of unpaid ?? []) {
    const net = Number(o.payment_net ?? o.total);
    if (o.payment_method_type === "stripe") owedCard += net;
    else owedPaypal += net;
  }

  const balanceUsd = panel.balance.ok
    ? {
        available:
          panel.balance.data.available.find((m) => m.currency === "usd")?.amount ?? 0,
        pending:
          panel.balance.data.pending.find((m) => m.currency === "usd")?.amount ?? 0,
      }
    : null;
  // La cuenta es canadiense: puede quedar algo en CAD aunque se cobre en USD.
  const otherBalances = panel.balance.ok
    ? [...panel.balance.data.available, ...panel.balance.data.pending]
        .filter((m) => m.currency !== "usd" && m.amount !== 0)
        .reduce<Record<string, number>>((acc, m) => {
          acc[m.currency] = (acc[m.currency] ?? 0) + m.amount;
          return acc;
        }, {})
    : {};

  const inTransit = panel.payouts.ok
    ? panel.payouts.data.filter((p) => p.status === "in_transit" || p.status === "pending")
    : [];
  const nextArrival = inTransit
    .map((p) => p.arrival)
    .sort()[0];

  const charges = panel.charges.ok ? panel.charges.data : [];
  const settled = charges.filter((c) => c.status === "succeeded" && !c.refunded);
  const usdPlans = settled.filter((c) => c.kind === "plan" && c.currency === "usd");
  const planGross = usdPlans.reduce((s, c) => s + c.amount, 0);
  const planFees = usdPlans.reduce(
    (s, c) => s + (c.settleCurrency === "usd" ? (c.fee ?? 0) : 0),
    0,
  );
  const orphans = settled.filter((c) => c.kind === "unknown");

  const openDisputes = panel.disputes.ok
    ? panel.disputes.data.filter((d) => isOpenDispute(d.status))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            Stripe
            {stripeReadIsTestMode() && <Badge variant="warning">Modo de prueba</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            Lo cobrado con tarjeta: planes, ventas de las tiendas y lo que hay
            que atender.
          </p>
        </div>
        <a
          href={stripeDashboardLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-muted"
        >
          Abrir Stripe <ExternalLink className="size-4" />
        </a>
      </div>

      {openDisputes.map((d) => (
        <a
          key={d.id}
          href={stripeDashboardLink(`/disputes/${d.id}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 rounded-xl border border-destructive-border bg-destructive-surface p-4 text-destructive-text transition-colors hover:bg-destructive-surface/70"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              Contracargo abierto · {money(d.amount, d.currency)}
            </span>
            <span className="block text-sm">
              {d.label} · motivo: {d.reason} ·{" "}
              {DISPUTE_STATUS[d.status] ?? d.status}
              {d.dueBy ? ` · responder antes del ${shortDate(d.dueBy, now)}` : ""}
            </span>
          </span>
          <ExternalLink className="mt-0.5 size-4 shrink-0" />
        </a>
      ))}
      {!panel.disputes.ok && <SectionError error={panel.disputes.error} />}

      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={<Wallet className="size-4" />}
            label="En Stripe ahora"
            value={balanceUsd ? formatUSD(balanceUsd.available + balanceUsd.pending) : "—"}
            sub={
              balanceUsd
                ? `${formatUSD(balanceUsd.available)} disponible · ${formatUSD(balanceUsd.pending)} por liquidar${
                    Object.keys(otherBalances).length
                      ? ` · ${Object.entries(otherBalances)
                          .map(([cur, amt]) => money(amt, cur))
                          .join(" · ")}`
                      : ""
                  }`
                : undefined
            }
          />
          <StatCard
            icon={<Landmark className="size-4" />}
            label="En camino al banco"
            value={
              panel.payouts.ok
                ? formatUSD(
                    inTransit
                      .filter((p) => p.currency === "usd")
                      .reduce((s, p) => s + p.amount, 0),
                  )
                : "—"
            }
            sub={
              nextArrival
                ? `llega el ${calendarDate(nextArrival, now)}`
                : panel.payouts.ok
                  ? "nada en camino"
                  : undefined
            }
          />
          <StatCard
            icon={<Receipt className="size-4" />}
            label="Planes cobrados, 30 días"
            value={panel.charges.ok ? formatUSD(planGross) : "—"}
            sub={
              panel.charges.ok && planGross > 0
                ? `${formatUSD(planGross - planFees)} neto tras ${formatUSD(planFees)} de comisión`
                : undefined
            }
          />
          <StatCard
            icon={<HandCoins className="size-4" />}
            label="Se le debe a tiendas"
            value={formatUSD(owedCard)}
            sub={
              owedPaypal > 0
                ? `por tarjeta · más ${formatUSD(owedPaypal)} de PayPal`
                : "por ventas con tarjeta"
            }
            hint={owedCard + owedPaypal > 0 ? "Registrar pagos" : undefined}
            href="/super/pagos"
            highlight={owedCard > 0}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Stripe deposita solo su saldo en el banco, incluida la plata de las
          tiendas. Lo que se les debe se paga desde ahí, por eso no se resta del
          saldo de Stripe.
        </p>
        {!panel.balance.ok && <SectionError error={panel.balance.error} />}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-5">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Cobros de los últimos 30 días</h2>
          {!panel.charges.ok ? (
            <SectionError error={panel.charges.error} />
          ) : charges.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
              Ningún cobro con tarjeta en los últimos 30 días.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {charges.map((c) => {
                const badge = chargeBadge(c);
                return (
                  <li key={c.id}>
                    <a
                      href={stripeDashboardLink(
                        c.paymentIntentId ? `/payments/${c.paymentIntentId}` : "/payments",
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-sm font-medium",
                            c.kind === "unknown" && "text-destructive-text",
                          )}
                        >
                          {c.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {agoTime(c.created, now)}
                          {c.fee != null && c.settleCurrency
                            ? ` · comisión ${money(c.fee, c.settleCurrency)}`
                            : ""}
                          {c.kind === "order" ? " · de la tienda" : ""}
                        </span>
                      </span>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      <span className="w-20 shrink-0 text-right text-sm tabular-nums">
                        {money(c.amount, c.currency)}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Suscripciones</h2>
            {!panel.subscriptions.ok ? (
              <SectionError error={panel.subscriptions.error} />
            ) : (
              <div className="space-y-2.5 rounded-xl border border-border bg-card p-4 text-sm">
                <Line label="Activas, se renuevan solas">
                  {panel.subscriptions.data.active - panel.subscriptions.data.cancelAtPeriodEnd}
                </Line>
                <Line label="Cancelan al vencer">
                  {panel.subscriptions.data.cancelAtPeriodEnd}
                </Line>
                <Line
                  label="En mora, Stripe reintenta"
                  tone={panel.subscriptions.data.pastDue > 0 ? "warning" : undefined}
                >
                  {panel.subscriptions.data.pastDue}
                </Line>
                {panel.subscriptions.data.pastDueStores.length > 0 && (
                  <p className="text-xs text-warning-text">
                    {panel.subscriptions.data.pastDueStores
                      .map((s) => s.label)
                      .join(", ")}
                  </p>
                )}
                <Line label="Se cobran en 7 días">
                  {panel.subscriptions.data.renewingSoon}
                  {panel.subscriptions.data.renewingSoonAmount > 0 &&
                    ` · ${formatUSD(panel.subscriptions.data.renewingSoonAmount)}`}
                </Line>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Conciliación</h2>
            {!panel.charges.ok ? (
              <SectionError error={panel.charges.error} />
            ) : orphans.length === 0 ? (
              <p className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-sm">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success-text" />
                <span>
                  {settled.length === 0
                    ? "No hubo cobros en los últimos 30 días."
                    : `${settled.length === 1 ? "El cobro" : `Los ${settled.length} cobros`} de los últimos 30 días ${
                        settled.length === 1 ? "tiene" : "tienen"
                      } su pedido o su plan en Tiendify.`}
                </span>
              </p>
            ) : (
              <div className="space-y-1.5 rounded-xl border border-destructive-border bg-destructive-surface p-4 text-sm text-destructive-text">
                <p className="font-semibold">
                  {orphans.length === 1
                    ? "1 cobro sin nada detrás en Tiendify"
                    : `${orphans.length} cobros sin nada detrás en Tiendify`}
                </p>
                <p className="text-xs">
                  Entró la plata pero no hay pedido ni plan que lo respalde. Hay
                  que revisarlo en Stripe: o se crea el pedido a mano, o se
                  reembolsa.
                </p>
                <ul className="pt-1 text-xs">
                  {orphans.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      {shortDate(c.created, now)} · {money(c.amount, c.currency)} ·{" "}
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Depósitos al banco</h2>
            {!panel.payouts.ok ? (
              <SectionError error={panel.payouts.error} />
            ) : panel.payouts.data.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
                Todavía no hubo depósitos.
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {panel.payouts.data.map((p) => {
                  const st = PAYOUT_STATUS[p.status] ?? {
                    label: p.status,
                    variant: "neutral" as const,
                  };
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 tabular-nums">
                        {calendarDate(p.arrival, now)}
                      </span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                      <span className="w-20 shrink-0 text-right tabular-nums">
                        {money(p.amount, p.currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Los pagos por Pago Móvil, Zelle y Binance no pasan por Stripe: están en{" "}
        <Link href="/super/suscripciones" className="underline underline-offset-2">
          Suscripciones
        </Link>
        .
      </p>
    </div>
  );
}

function Line({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "warning";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn("font-semibold tabular-nums", tone === "warning" && "text-warning-text")}
      >
        {children}
      </span>
    </div>
  );
}

function SectionError({ error }: { error: string }) {
  return (
    <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">{error}</p>
  );
}

