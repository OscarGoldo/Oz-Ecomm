import Link from "next/link";
import { ChevronRight, Inbox, Maximize2, MousePointerClick, X } from "lucide-react";

import { OrderDetail, loadOrderDetail } from "@/components/admin/order-detail";
import { OrderQuickStatus } from "@/components/admin/order-quick-status";
import { OrdersFilters } from "@/components/admin/orders-filters";
import { OrdersSearch } from "@/components/admin/orders-search";
import { OrderStatusBadge } from "@/components/admin/status-badge";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBs, formatUSD, orderDateLong, orderDateShort } from "@/lib/format";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus, PaymentMethodType } from "@/types/database";

export const metadata = { title: "Pedidos" };

// "Verifica el pago" lee el comprobante con IA desde esta página (ProofCheck),
// y la lectura tarda hasta 45 s en el peor caso.
export const maxDuration = 60;

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

function paymentLabel(order: Order): string {
  return order.payment_method_type
    ? (PAYMENT_METHOD_META[order.payment_method_type as PaymentMethodType]?.label ??
        order.payment_method_type)
    : "—";
}

/**
 * Pedidos. En escritorio ancho (xl) la lista y el pedido elegido van lado a
 * lado: se abre con ?pedido=<id>, y desde ahí se revisa el comprobante y se
 * confirma sin perder la lista ni el filtro. Por debajo de xl no hay ancho
 * para las dos cosas, así que cada pedido abre su propia página.
 */
export default async function PedidosPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string; ver?: string; pedido?: string };
}) {
  const { store } = await requireStoreUser();
  const supabase = createClient();

  const q = searchParams.q?.trim();
  const status =
    searchParams.status && VALID_STATUSES.includes(searchParams.status as OrderStatus)
      ? (searchParams.status as OrderStatus)
      : null;
  const shown = Math.min(
    1000,
    Math.max(ORDERS_PAGE_SIZE, Number(searchParams.ver) || ORDERS_PAGE_SIZE),
  );

  // Los contadores por estado se piden con `head: true`: antes se traía la
  // tabla entera de pedidos solo para contarla en memoria, y después OTRA vez
  // completa para listarla. En una tienda con seis meses de actividad eso son
  // miles de filas en cada carga del panel.
  const countFor = async (s: OrderStatus) => {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("status", s);
    return [s, count ?? 0] as const;
  };

  const [countPairs, page, selected] = await Promise.all([
    Promise.all(VALID_STATUSES.map(countFor)),
    (async () => {
      let query = supabase
        .from("orders")
        .select("*")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false })
        // Uno de más para saber si hay página siguiente sin un COUNT aparte.
        .limit(shown + 1);
      if (status) query = query.eq("status", status);
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
    searchParams.pedido ? loadOrderDetail(searchParams.pedido, store) : Promise.resolve(null),
  ]);

  const counts: Partial<Record<OrderStatus, number>> = {};
  for (const [s, n] of countPairs) if (n > 0) counts[s] = n;

  const hasMore = page.length > shown;
  const filtered = hasMore ? page.slice(0, shown) : page;

  // Los enlaces conservan el filtro, la búsqueda y cuántos se están viendo.
  const listParams = {
    ...(status ? { status } : {}),
    ...(q ? { q } : {}),
    ...(searchParams.ver ? { ver: searchParams.ver } : {}),
  };
  const sideHref = (id: string) =>
    `/panel/pedidos?${new URLSearchParams({ ...listParams, pedido: id }).toString()}`;
  const closeHref = `/panel/pedidos?${new URLSearchParams(listParams).toString()}`;
  const selectedId = selected?.order.id ?? null;

  return (
    <div className="space-y-5">
      <header>
        <p className="font-landing-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          Ventas
        </p>
        <h1 className="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.028em]">
          Pedidos
        </h1>
        <p className="mt-1.5 text-[15px] text-ink-600">
          {q
            ? `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"} para “${q}”`
            : `${filtered.length}${hasMore ? "+" : ""} ${filtered.length === 1 ? "pedido" : "pedidos"}`}
        </p>
      </header>

      <div className="space-y-3">
        <OrdersFilters counts={counts} />
        <OrdersSearch />
      </div>

      {filtered.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-12 text-center">
          <Inbox className="mb-3 size-9 text-ink-400" />
          <p className="font-semibold">{q ? "Sin resultados" : "No hay pedidos aquí"}</p>
          <p className="mt-1 max-w-[42ch] text-sm text-ink-600">
            {q
              ? "Prueba con el número de pedido, otra parte del nombre o el teléfono."
              : status
                ? "Ningún pedido en este estado. Todo al día."
                : "Cuando entren pedidos van a aparecer aquí."}
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="min-w-0 space-y-3">
            {/* Teléfono y tableta: tarjetas apiladas, cómodas para el pulgar. */}
            <ul className="space-y-2.5 lg:hidden">
              {filtered.map((order) => (
                <li key={order.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/panel/pedidos/${order.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        <span className="font-landing-mono">#{order.order_number}</span>
                        <span className="text-ink-500"> · </span>
                        {order.customer_name}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-ink-500">
                        {paymentLabel(order)} · {orderDateShort(order.created_at)}
                      </p>
                    </Link>
                    <span className="shrink-0 text-right font-landing-mono text-sm font-semibold tabular-nums">
                      {formatUSD(order.total)}
                      {order.total_bs ? (
                        <span className="block text-[11px] font-normal text-ink-500">
                          {formatBs(order.total_bs)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <OrderQuickStatus
                      orderId={order.id}
                      orderNumber={order.order_number}
                      status={order.status}
                      customerName={order.customer_name}
                      customerPhone={order.customer_phone}
                      storeName={store.name}
                    />
                    <Link
                      href={`/panel/pedidos/${order.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"
                    >
                      Ver pedido <ChevronRight className="size-4" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            {/* Escritorio: tabla. Mismos datos, mismos componentes de acción
                (OrderQuickStatus), solo se acomodan distinto. El método de
                pago va bajo el cliente, y la fecha también hasta 2xl: con el
                detalle abierto al lado no hay ancho para una columna cada uno. */}
            <div className="hidden overflow-x-auto rounded-2xl border bg-card lg:block">
              {/* Columnas de ancho fijo: así el cliente y el método de pago se
                  recortan con "…" en vez de empujar el total fuera de la tarjeta. */}
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b bg-ink-25 text-left font-landing-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-500">
                    <th className="px-4 py-3">Pedido</th>
                    <th className="hidden w-[9.5rem] px-4 py-3 2xl:table-cell">Fecha</th>
                    <th className="w-[10.5rem] px-4 py-3">Estado</th>
                    <th className="w-[9.5rem] px-4 py-3 text-right">Total</th>
                    <th className="w-12 px-2 py-3">
                      <span className="sr-only">Abrir</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filtered.map((order) => {
                    const isSelected = order.id === selectedId;
                    const date = orderDateShort(order.created_at);
                    const cell = (
                      <>
                        <span className="block truncate font-semibold">
                          <span className="font-landing-mono">#{order.order_number}</span>
                          <span className="text-ink-500"> · </span>
                          {order.customer_name}
                        </span>
                        <span className="block truncate text-[13px] text-ink-500">
                          <span className="2xl:hidden">{date} · </span>
                          {paymentLabel(order)}
                        </span>
                      </>
                    );
                    return (
                      <tr
                        key={order.id}
                        className={cn(
                          "transition-colors",
                          isSelected ? "bg-brand-50" : "hover:bg-ink-25",
                        )}
                      >
                        <td className="px-4 py-3">
                          {/* Por debajo de xl abre la página del pedido; desde
                              xl, el detalle al lado de la lista. */}
                          <Link href={`/panel/pedidos/${order.id}`} className="block xl:hidden">
                            {cell}
                          </Link>
                          <Link
                            href={sideHref(order.id)}
                            scroll={false}
                            aria-current={isSelected ? "true" : undefined}
                            className="hidden xl:block"
                          >
                            {cell}
                          </Link>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-ink-600 2xl:table-cell">
                          {date}
                        </td>
                        <td className="px-4 py-3">
                          <OrderQuickStatus
                            orderId={order.id}
                            orderNumber={order.order_number}
                            status={order.status}
                            customerName={order.customer_name}
                            customerPhone={order.customer_phone}
                            storeName={store.name}
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-landing-mono font-semibold tabular-nums">
                          {formatUSD(order.total)}
                          {order.total_bs ? (
                            <span className="block text-xs font-normal text-ink-500">
                              {formatBs(order.total_bs)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <Link
                            href={`/panel/pedidos/${order.id}`}
                            className="grid size-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-foreground xl:hidden"
                            aria-label={`Ver pedido #${order.order_number}`}
                          >
                            <ChevronRight className="size-4" />
                          </Link>
                          <Link
                            href={sideHref(order.id)}
                            scroll={false}
                            className="hidden size-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-foreground xl:grid"
                            aria-label={`Ver pedido #${order.order_number} al lado`}
                          >
                            <ChevronRight className="size-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Link
                  href={`/panel/pedidos?${new URLSearchParams({
                    ...listParams,
                    ...(selectedId ? { pedido: selectedId } : {}),
                    ver: String(shown + ORDERS_PAGE_SIZE),
                  }).toString()}`}
                  prefetch={false}
                  scroll={false}
                  className="inline-flex h-11 items-center rounded-lg border bg-card px-5 text-sm font-semibold hover:bg-ink-50"
                >
                  Ver más pedidos
                </Link>
              </div>
            )}
          </div>

          {/* El pedido elegido, al lado. Solo desde xl. */}
          <aside
            aria-label="Detalle del pedido"
            className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border bg-card xl:block"
          >
            {selected ? (
              <>
                <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-card px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-landing-mono text-base font-semibold">
                      Pedido #{selected.order.order_number}
                    </p>
                    <p className="text-[13px] text-ink-600">
                      {orderDateLong(selected.order.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <OrderStatusBadge status={selected.order.status} />
                    <Link
                      href={`/panel/pedidos/${selected.order.id}`}
                      className="grid size-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-foreground"
                      aria-label="Abrir el pedido en su página"
                      title="Abrir en su página"
                    >
                      <Maximize2 className="size-4" />
                    </Link>
                    <Link
                      href={closeHref}
                      scroll={false}
                      className="grid size-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-foreground"
                      aria-label="Cerrar el detalle"
                    >
                      <X className="size-4" />
                    </Link>
                  </div>
                </div>
                <div className="divide-y divide-ink-100">
                  <OrderDetail data={selected} storeName={store.name} variant="panel" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center px-8 py-14 text-center">
                <span className="grid size-11 place-items-center rounded-xl bg-ink-100 text-ink-600">
                  <MousePointerClick className="size-5" />
                </span>
                <p className="mt-4 font-semibold">Elige un pedido</p>
                <p className="mt-1 max-w-[30ch] text-sm text-ink-600">
                  Se abre aquí al lado, con el comprobante, para revisarlo y
                  confirmarlo sin salir de la lista.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
