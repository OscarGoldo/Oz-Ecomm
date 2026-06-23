import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BellRing, ChevronRight, Inbox } from "lucide-react";

import { OrderQuickStatus } from "@/components/admin/order-quick-status";
import { OrdersFilters } from "@/components/admin/orders-filters";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/format";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import type { Order, OrderStatus, PaymentMethodType } from "@/types/database";

export const metadata = { title: "Pedidos" };

const VALID_STATUSES: OrderStatus[] = [
  "pending_payment",
  "pending_confirmation",
  "confirmed",
  "preparing",
  "in_delivery",
  "completed",
  "cancelled",
];

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const { store } = await requireStoreUser();
  const supabase = createClient();

  const [{ data: allOrders }, filtered] = await Promise.all([
    supabase.from("orders").select("status").eq("store_id", store.id),
    (async () => {
      let query = supabase
        .from("orders")
        .select("*")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false });
      if (
        searchParams.status &&
        VALID_STATUSES.includes(searchParams.status as OrderStatus)
      ) {
        query = query.eq("status", searchParams.status as OrderStatus);
      }
      const { data } = await query;
      return (data ?? []) as Order[];
    })(),
  ]);

  const counts: Partial<Record<OrderStatus, number>> = {};
  for (const o of allOrders ?? []) {
    counts[o.status as OrderStatus] = (counts[o.status as OrderStatus] ?? 0) + 1;
  }
  const unattended = counts.pending_confirmation ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "pedido" : "pedidos"}
        </p>
      </div>

      {unattended > 0 && (
        <Link
          href="/panel/pedidos?status=pending_confirmation"
          className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          <BellRing className="size-5 text-warning-foreground" />
          <span className="flex-1 font-medium">
            Tenés {unattended}{" "}
            {unattended === 1 ? "pago por confirmar" : "pagos por confirmar"}
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      )}

      <OrdersFilters counts={counts} />

      {filtered.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-12 text-center">
          <Inbox className="mb-3 size-9 text-muted-foreground" />
          <p className="font-medium">No hay pedidos</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando entren pedidos van a aparecer acá.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((order) => {
            const isNew = order.status === "pending_confirmation";
            const payment = order.payment_method_type
              ? (PAYMENT_METHOD_META[order.payment_method_type as PaymentMethodType]
                  ?.label ?? order.payment_method_type)
              : "—";
            return (
              <li
                key={order.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/50"
              >
                {isNew && (
                  <span className="size-2 shrink-0 rounded-full bg-warning" />
                )}
                <Link href={`/panel/pedidos/${order.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    #{order.order_number} · {order.customer_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {payment} ·{" "}
                    {format(new Date(order.created_at), "d 'de' MMM, HH:mm", {
                      locale: es,
                    })}
                  </p>
                </Link>
                <span className="shrink-0 font-semibold">
                  {formatUSD(order.total)}
                </span>
                <OrderQuickStatus
                  orderId={order.id}
                  orderNumber={order.order_number}
                  status={order.status}
                  customerName={order.customer_name}
                  customerPhone={order.customer_phone}
                  storeName={store.name}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
