import { Inbox } from "lucide-react";

import { SubscriptionReview } from "@/components/admin/subscription-review";
import { formatUSD } from "@/lib/format";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import { isPro } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import type {
  PaymentMethodType,
  Store,
  SubscriptionPayment,
} from "@/types/database";

export const metadata = { title: "Suscripciones" };

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SuperSubscriptionsPage() {
  const supabase = createClient();

  const [{ data: payments }, { data: stores }] = await Promise.all([
    supabase
      .from("subscription_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("stores").select("*"),
  ]);

  const list = (payments ?? []) as SubscriptionPayment[];
  const storeList = (stores ?? []) as Store[];
  const byId = new Map(storeList.map((s) => [s.id, s]));

  const pending = list.filter((p) => p.status === "pending");
  const reviewed = list.filter((p) => p.status !== "pending");

  // MRR: solo los que pagan. Las tiendas de cortesía no cuentan como ingreso.
  const paying = storeList.filter((s) => isPro(s) && s.plan_source === "paid");
  const comped = storeList.filter((s) => isPro(s) && s.plan_source === "comp");
  const approved = list.filter((p) => p.status === "approved");
  const collected = approved.reduce((s, p) => s + Number(p.amount), 0);
  // Lo que se llevó PayPal de lo cobrado por esa vía.
  const paypalFees = approved.reduce((s, p) => s + Number(p.fee ?? 0), 0);
  // Normalizado a mensual para que el anual no infle el número.
  const mrr = approved
    .filter((p) => {
      const store = byId.get(p.store_id);
      return store ? isPro(store) : false;
    })
    .reduce((s, p) => s + Number(p.amount) / p.period_months, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Suscripciones</h1>
        <p className="text-sm text-muted-foreground">
          Comprobantes del plan Pro. Al aprobar uno, el plan de esa tienda se
          extiende automáticamente.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Por revisar" value={String(pending.length)} />
        <Metric label="Tiendas pagando" value={String(paying.length)} />
        <Metric label="MRR estimado" value={formatUSD(mrr)} />
        <Metric
          label="Cobrado histórico"
          value={formatUSD(collected)}
          sub={
            paypalFees > 0
              ? `${formatUSD(paypalFees)} en comisiones PayPal`
              : comped.length > 0
                ? `${comped.length} de cortesía`
                : undefined
          }
        />
      </div>

      {/* Cola de revisión */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Por revisar</h2>
        {pending.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed bg-card p-10 text-center">
            <Inbox className="mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No hay comprobantes pendientes</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((p) => {
              const store = byId.get(p.store_id);
              return (
                <li key={p.id} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{store?.name ?? "Tienda"}</p>
                      <p className="text-xs text-muted-foreground">
                        /{store?.slug} · {fmtDateTime(p.created_at)}
                      </p>
                      <p className="mt-1 text-sm">
                        {PAYMENT_METHOD_META[p.method as PaymentMethodType]?.label ??
                          p.method}
                        {p.reference && (
                          <span className="text-muted-foreground">
                            {" "}
                            · ref {p.reference}
                          </span>
                        )}
                      </p>
                      {store && isPro(store) && store.plan_expires_at && (
                        <p className="text-xs text-muted-foreground">
                          Vence hoy el{" "}
                          {new Date(store.plan_expires_at).toLocaleDateString("es-VE")}{" "}
                          — se le suman los meses encima.
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">
                        {formatUSD(Number(p.amount))}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.period_months === 1 ? "1 mes" : `${p.period_months} meses`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 border-t pt-3">
                    <SubscriptionReview paymentId={p.id} proofPath={p.proof_url} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Historial */}
      {reviewed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Revisados</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {reviewed.map((p) => {
              const store = byId.get(p.store_id);
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{store?.name ?? "Tienda"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {fmtDateTime(p.created_at)} ·{" "}
                      {p.period_months === 1 ? "1 mes" : `${p.period_months} meses`}
                      {p.review_note ? ` · ${p.review_note}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-medium">
                    {formatUSD(Number(p.amount))}
                    {p.method === "paypal" && (
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        PayPal · neto {formatUSD(Number(p.net ?? p.amount))}
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      p.status === "approved"
                        ? "bg-success/15 text-success"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {p.status === "approved" ? "Aprobado" : "Rechazado"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
