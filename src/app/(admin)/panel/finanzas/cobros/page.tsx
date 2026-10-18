import type { Metadata } from "next";

import { FinanceHeader, FinanceTabs } from "@/components/admin/finance-tabs";
import { requireStoreUser } from "@/lib/auth";
import { formatUSD } from "@/lib/format";
import { SALES_STATUSES } from "@/lib/metrics";
import { shortDateTime } from "@/lib/report-period";
import { PAYMENT_PROOFS_BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cobros de Tiendify" };

/**
 * Lo que Tiendify cobró con tarjeta por la tienda y le transfiere: lo que
 * falta y cada pago que ya le hizo, con su comprobante.
 *
 * Incluye "paypal" por las ventas viejas: PayPal se quitó en septiembre de
 * 2026, pero lo que ya se cobró por ahí se sigue pagando y se tiene que ver.
 */
export default async function CobrosPage() {
  const { store } = await requireStoreUser();
  const supabase = createClient();
  const [{ data: dueRows }, { data: paidRows }] = await Promise.all([
    supabase
      .from("orders")
      .select("total, payment_net")
      .eq("store_id", store.id)
      .in("payment_method_type", ["stripe", "paypal"])
      .in("status", SALES_STATUSES)
      .is("paid_out_at", null),
    supabase
      .from("orders")
      .select("paid_out_at, payment_net, total, payout_proof_url, payout_reference")
      .eq("store_id", store.id)
      .in("payment_method_type", ["stripe", "paypal"])
      .not("paid_out_at", "is", null)
      .order("paid_out_at", { ascending: false }),
  ]);

  const due = dueRows ?? [];
  const dueUsd = due.reduce((s, o) => s + Number(o.payment_net ?? o.total), 0);

  // Un pago de Tiendify cubre varias ventas: se agrupan por el momento en que
  // se marcaron pagadas, que es el mismo para todas las de una transferencia.
  const groups = new Map<
    string,
    { date: string; amount: number; count: number; proof: string | null; reference: string | null }
  >();
  for (const o of paidRows ?? []) {
    const key = o.paid_out_at as string;
    const g = groups.get(key) ?? {
      date: key,
      amount: 0,
      count: 0,
      proof: o.payout_proof_url,
      reference: o.payout_reference,
    };
    g.amount += Number(o.payment_net ?? o.total);
    g.count += 1;
    groups.set(key, g);
  }
  const admin = createAdminClient();
  const payouts = await Promise.all(
    [...groups.values()].map(async (p) => {
      let proofUrl: string | null = null;
      if (p.proof) {
        const { data } = await admin.storage.from(PAYMENT_PROOFS_BUCKET).createSignedUrl(p.proof, 3600);
        proofUrl = data?.signedUrl ?? null;
      }
      return { ...p, proofUrl };
    }),
  );
  const receivedUsd = payouts.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <FinanceHeader
        eyebrow="Finanzas"
        title="Cobros de Tiendify"
        sub="Lo que cobramos con tarjeta por tu tienda y te transferimos, ya sin la comisión del procesador."
      />
      <FinanceTabs active="cobros" />

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <section className="rounded-2xl bg-[#E9F5FD] p-5 sm:p-6">
          <p className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-800">
            Por liquidar
          </p>
          <p className="mt-2 font-display text-[2rem] font-extrabold leading-tight tracking-[-0.025em] tabular-nums">
            {formatUSD(dueUsd)}
          </p>
          <p className="mt-1 text-[13px] text-brand-800">
            {due.length > 0
              ? `${due.length} ${due.length === 1 ? "venta" : "ventas"} con tarjeta esperando el próximo pago`
              : "No hay ventas con tarjeta esperando pago"}
          </p>
        </section>
        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <p className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            Ya recibiste
          </p>
          <p className="mt-2 font-display text-[2rem] font-extrabold leading-tight tracking-[-0.025em] tabular-nums">
            {formatUSD(receivedUsd)}
          </p>
          <p className="mt-1 text-[13px] text-ink-500">
            en {payouts.length} {payouts.length === 1 ? "pago" : "pagos"} de Tiendify
          </p>
        </section>
      </div>

      <section aria-labelledby="pagos" className="overflow-hidden rounded-2xl border bg-card">
        <h2 id="pagos" className="border-b px-5 py-4 font-display text-lg font-bold tracking-[-0.02em]">
          Pagos recibidos
        </h2>
        {payouts.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-500">
            Todavía no hay pagos. Cuando vendas con tarjeta, Tiendify te transfiere lo cobrado y aquí
            queda cada pago con su comprobante.
          </p>
        ) : (
          <ul className="divide-y">
            {payouts.map((p) => (
              <li key={p.date} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold tabular-nums">{formatUSD(p.amount)}</p>
                  <p className="text-xs text-ink-500">
                    {shortDateTime(p.date)} · {p.count} {p.count === 1 ? "venta" : "ventas"}
                    {p.reference ? ` · ref. ${p.reference}` : ""}
                  </p>
                </div>
                {p.proofUrl ? (
                  <a
                    href={p.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 shrink-0 items-center rounded-lg border px-3.5 text-sm font-medium hover:bg-muted"
                  >
                    Ver comprobante
                  </a>
                ) : (
                  <span className="shrink-0 text-xs text-ink-500">Sin comprobante</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
