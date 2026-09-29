import { Wallet } from "lucide-react";

import { PayoutSettle } from "@/components/admin/payout-settle";
import { createClient } from "@/lib/supabase/server";
import { SALES_STATUSES } from "@/lib/metrics";
import { formatUSD } from "@/lib/format";
import { PAYOUT_METHOD_LABELS, type PayoutMethod } from "@/lib/constants";
import type { Store } from "@/types/database";

export const metadata = { title: "Pagos a tiendas" };

interface StorePayout {
  store: Pick<Store, "id" | "name" | "slug">;
  owed: number;
  commission: number;
  gross: number;
  count: number;
  paidNet: number;
  payout: { method: string | null; holder: string | null; account: string | null };
}

export default async function SuperPayoutsPage() {
  const supabase = createClient();

  const [{ data: stores }, { data: orders }, { data: methods }] = await Promise.all([
    supabase.from("stores").select("id, name, slug").order("name"),
    supabase
      .from("orders")
      .select("store_id, total, payment_net, payment_fee, paid_out_at, status")
      // Lo que cobró la plataforma por el comerciante. "paypal" sigue acá solo
      // por las ventas viejas: PayPal se quitó en septiembre de 2026, pero esa
      // plata ya entró y se le sigue debiendo. Sacarlo escondería una deuda.
      .in("payment_method_type", ["stripe", "paypal"])
      .in("status", SALES_STATUSES),
    supabase
      .from("payment_methods")
      .select("store_id, details")
      // Los datos de cobro de las ventas viejas viven en el método PayPal.
      .in("type", ["stripe", "paypal"]),
  ]);

  const payoutByStore = new Map<
    string,
    { method: string | null; holder: string | null; account: string | null }
  >();
  for (const m of methods ?? []) {
    const d = (m.details ?? {}) as Record<string, string>;
    // Una tienda puede tener los dos métodos online configurados. Se combinan
    // en vez de pisarse: si uno tiene los datos de cobro y el otro quedó
    // vacío, lo que vale es el que los tiene.
    const prev = payoutByStore.get(m.store_id);
    payoutByStore.set(m.store_id, {
      method: d.payout_method || prev?.method || null,
      holder: d.payout_holder || prev?.holder || null,
      account: d.payout_account || prev?.account || null,
    });
  }

  const agg = new Map<string, Omit<StorePayout, "store" | "payout">>();
  for (const o of orders ?? []) {
    const cur =
      agg.get(o.store_id) ??
      { owed: 0, commission: 0, gross: 0, count: 0, paidNet: 0 };
    const net = o.payment_net != null ? Number(o.payment_net) : Number(o.total);
    const fee = o.payment_fee != null ? Number(o.payment_fee) : 0;
    if (o.paid_out_at) {
      cur.paidNet += net;
    } else {
      cur.owed += net;
      cur.commission += fee;
      cur.gross += Number(o.total);
      cur.count += 1;
    }
    agg.set(o.store_id, cur);
  }

  const rows: StorePayout[] = (stores ?? [])
    .map((s) => {
      const a = agg.get(s.id);
      return {
        store: s,
        owed: a?.owed ?? 0,
        commission: a?.commission ?? 0,
        gross: a?.gross ?? 0,
        count: a?.count ?? 0,
        paidNet: a?.paidNet ?? 0,
        payout: payoutByStore.get(s.id) ?? { method: null, holder: null, account: null },
      };
    })
    .filter((r) => r.owed > 0 || r.paidNet > 0)
    .sort((a, b) => b.owed - a.owed);

  const totalOwed = rows.reduce((s, r) => s + r.owed, 0);
  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pagos a tiendas</h1>
        <p className="text-sm text-muted-foreground">
          Lo cobrado con tarjeta entra a tu cuenta. Aquí ves cuánto le debes a
          cada tienda (neto, ya descontada la comisión del procesador) y
          registras el pago.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total por pagar</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{formatUSD(totalOwed)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Comisiones del procesador (pendientes)
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{formatUSD(totalCommission)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-12 text-center">
          <Wallet className="mb-3 size-9 text-muted-foreground" />
          <p className="font-medium">Todavía no hay ventas con tarjeta</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.store.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{r.store.name}</p>
                  <p className="text-xs text-muted-foreground">/{r.store.slug}</p>
                  {r.payout.method || r.payout.account || r.payout.holder ? (
                    <p className="mt-1 text-sm">
                      Pagar por{" "}
                      <span className="font-medium">
                        {PAYOUT_METHOD_LABELS[
                          (r.payout.method ?? "zelle") as PayoutMethod
                        ] ??
                          r.payout.method}
                      </span>
                      {r.payout.account ? ` · ${r.payout.account}` : ""}
                      {r.payout.holder ? ` · ${r.payout.holder}` : ""}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-warning-foreground">
                      La tienda no configuró cómo recibir el pago.
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Le debes</p>
                  <p className="text-xl font-bold">{formatUSD(r.owed)}</p>
                  {r.count > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {r.count} venta{r.count === 1 ? "" : "s"} · comisión{" "}
                      {formatUSD(r.commission)}
                    </p>
                  )}
                </div>
              </div>

              {r.paidNet > 0 && (
                <p className="mt-2 text-xs text-success">
                  Ya pagado histórico: {formatUSD(r.paidNet)}
                </p>
              )}

              {r.owed > 0 && (
                <div className="mt-3 border-t pt-3">
                  <PayoutSettle storeId={r.store.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
