import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BellRing, ChevronRight, Inbox } from "lucide-react";

import { OrderQuickStatus } from "@/components/admin/order-quick-status";
import { OrdersFilters } from "@/components/admin/orders-filters";
import { OrdersSearch } from "@/components/admin/orders-search";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/format";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import type { Order, OrderStatus, PaymentMethodType } from "@/types/database";

export const metadata = { title: "Pedidos" };

/** Pedidos por página en el panel. */
const ORDERS_PAGE_SIZE = 30;

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
  searchParams: { status?: string; q?: string; ver?: string };
}) {
  const { store } = await requireStoreUser();
  const supabase = createClient();

  const q = searchParams.q?.trim();
  const shown = Math.min(
    1000,
    Math.max(ORDERS_PAGE_SIZE, Number(searchParams.ver) || ORDERS_PAGE_SIZE),
  );

  // Los contadores por estado se piden con `head: true`: antes se traía la
  // tabla entera de pedidos solo para contarla en memoria, y después OTRA vez
  // completa para listarla. En una tienda con seis meses de actividad eso son
  // miles de filas en cada carga del panel.
  const countFor = async (status: OrderStatus) => {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("status", status);
    return [status, count ?? 0] as const;
  };

  const [countPairs, page] = await Promise.all([
    Promise.all(VALID_STATUSES.map(countFor)),
    (async () => {
      let query = supabase
        .from("orders")
        .select("*")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false })
        // Uno de más para saber si hay página siguiente sin un COUNT aparte.
        .limit(shown + 1);
      if (
        searchParams.status &&
        VALID_STATUSES.includes(searchParams.status as OrderStatus)
      ) {
        query = query.eq("status", searchParams.status as OrderStatus);
      }
      if (q) {
        // Por número de pedido, nombre o teléfono: es lo que tiene a mano el
        // dueño cuando un cliente le escribe "¿qué pasó con mi pedido?".
        const digits = q.replace(/\D/g, "");
        const filters = [
          `customer_name.ilike.%${q.replace(/[,()]/g, "")}%`,
          ...(digits
            ? [`customer_phone.ilike.%${digits}%`, `order_number.eq.${digits}`]
            : []),
        ];
        query = query.or(filters.join(","));
      }
      const { data } = await query;
      return (data ?? []) as Order[];
    })(),
  ]);

  const counts: Partial<Record<OrderStatus, number>> = {};
  for (const [status, n] of countPairs) if (n > 0) counts[status] = n;
  const unattended = counts.pending_confirmation ?? 0;

  const hasMore = page.length > shown;
  const filtered = hasMore ? page.slice(0, shown) : page;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
        <p className="text-sm text-muted-foreground">
          {q
            ? `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"} para “${q}”`
            : `${filtered.length}${hasMore ? "+" : ""} ${filtered.length === 1 ? "pedido" : "pedidos"}`}
        </p>
      </div>

      {unattended > 0 && (
        <Link
          href="/panel/pedidos?status=pending_confirmation"
          className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          <BellRing className="size-5 text-warning-foreground" />
          <span className="flex-1 font-medium">
            Tienes {unattended}{" "}
            {unattended === 1 ? "pago por confirmar" : "pagos por confirmar"}
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      )}

      <OrdersSearch />
      <OrdersFilters counts={counts} />

      {filtered.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-12 text-center">
          <Inbox className="mb-3 size-9 text-muted-foreground" />
          <p className="font-medium">
            {q ? "Sin resultados" : "No hay pedidos"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {q
              ? "Prueba con el número de pedido, otra parte del nombre o el teléfono."
              : "Cuando entren pedidos van a aparecer aquí."}
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

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Link
            href={`/panel/pedidos?${new URLSearchParams({
              ...(searchParams.status ? { status: searchParams.status } : {}),
              ...(q ? { q } : {}),
              ver: String(shown + ORDERS_PAGE_SIZE),
            }).toString()}`}
            prefetch={false}
            className="inline-flex h-11 items-center rounded-lg border px-5 text-sm font-medium hover:bg-muted"
          >
            Ver más pedidos
          </Link>
        </div>
      )}
    </div>
  );
}
