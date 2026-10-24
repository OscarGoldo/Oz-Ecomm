import { Bike, Mail, MapPin, Phone, Store as StoreIcon } from "lucide-react";

import { OrderActions } from "@/components/admin/order-actions";
import { ProofCheck } from "@/components/admin/proof-check";
import { ProofViewer } from "@/components/admin/proof-viewer";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import { formatBs, formatUSD } from "@/lib/format";
import {
  buildOrderMessageData,
  orderReceiptCustomerMessage,
} from "@/lib/order-messages";
import { loadProofCheck, proofReadingAvailable } from "@/lib/proof-check";
import type { ProofCheckView } from "@/lib/proof-rules";
import { PAYMENT_PROOFS_BUCKET } from "@/lib/storage";
import { storeUrl } from "@/lib/store-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Order, OrderItem, PaymentMethodType, Store } from "@/types/database";

/**
 * El detalle de un pedido. Lo usan la página del pedido (/panel/pedidos/[id],
 * la que se abre en el teléfono o desde un enlace) y el panel que se abre al
 * lado de la lista en pantallas anchas, para confirmar un pago sin salir de
 * Pedidos. Mismo contenido, mismas acciones: solo cambia el envoltorio.
 */

export interface OrderDetailData {
  order: Order;
  items: OrderItem[];
  proofUrl: string | null;
  paymentLabel: string;
  /** Recibo de 1 tap para WhatsApp, ya armado. */
  receiptMessage: string;
  /** Lo que la IA leyó en la captura, si ya la leyó. */
  proofCheck: ProofCheckView | null;
  /** Pedir la lectura al abrir: hay captura, IA y el pago está por confirmar. */
  proofAutoRead: boolean;
}

/** Trae el pedido de esta tienda con todo lo que muestra el detalle. */
export async function loadOrderDetail(
  orderId: string,
  store: Store,
): Promise<OrderDetailData | null> {
  const supabase = createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!order) return null;

  const { data: itemsData } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at");
  const items = (itemsData ?? []) as OrderItem[];

  let proofUrl: string | null = null;
  let proofCheck: ProofCheckView | null = null;
  if (order.payment_proof_url) {
    const [{ data }, check] = await Promise.all([
      createAdminClient()
        .storage.from(PAYMENT_PROOFS_BUCKET)
        // Una hora: con 10 minutos, dejar el pedido abierto y volver dejaba la
        // imagen rota sin ningún mensaje que lo explicara.
        .createSignedUrl(order.payment_proof_url, 3600),
      loadProofCheck(order.id, store.id),
    ]);
    proofUrl = data?.signedUrl ?? null;
    proofCheck = check;
  }
  const proofAutoRead =
    Boolean(order.payment_proof_url) &&
    order.status === "pending_confirmation" &&
    proofReadingAvailable();

  const paymentLabel = order.payment_method_type
    ? (PAYMENT_METHOD_META[order.payment_method_type as PaymentMethodType]?.label ??
      order.payment_method_type)
    : "—";

  // Recibo de 1 tap para WhatsApp. Se arma aquí (server) y viaja como texto ya
  // listo, así el componente cliente no necesita los ítems ni los totales.
  const receiptMessage = orderReceiptCustomerMessage(
    buildOrderMessageData({
      order,
      items,
      storeName: store.name,
      pickupAddress: store.pickup_address,
      orderUrl: storeUrl(store, `/pedido/${order.id}`),
    }),
  );

  return {
    order: order as Order,
    items,
    proofUrl,
    paymentLabel,
    receiptMessage,
    proofCheck,
    proofAutoRead,
  };
}

/** Rótulo de cada bloque: en mono y versalitas, como en el resto del panel. */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-landing-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
      {children}
    </h2>
  );
}

/**
 * Los bloques del detalle. En `page` cada uno es una tarjeta; en `panel` van
 * todos dentro de una sola, separados por líneas (el contenedor pone el
 * `divide-y`).
 */
export function OrderDetail({
  data,
  storeName,
  variant,
}: {
  data: OrderDetailData;
  storeName: string;
  variant: "page" | "panel";
}) {
  const { order, items, proofUrl, paymentLabel, receiptMessage, proofCheck, proofAutoRead } = data;
  const block = variant === "page" ? "rounded-2xl border bg-card p-5" : "px-5 py-5";

  return (
    <>
      {/* Verificación del pago, arriba de todo y solo cuando hay algo que
          verificar: el monto que tiene que decir el comprobante al lado de la
          captura, para no tener que memorizar una cifra y bajar a buscarla.
          Es la tarea más repetida del día del comerciante. */}
      {order.status === "pending_confirmation" && (
        <section
          className={cn(
            block,
            "bg-sol/[0.12]",
            variant === "page" && "border-sol/70",
          )}
        >
          <p className="font-display text-lg font-bold tracking-[-0.02em]">Verifica el pago</p>
          <p className="mt-0.5 text-sm text-ink-600">
            Compara el comprobante con lo que te llegó al banco.
          </p>

          <div className="mt-3.5 rounded-xl border bg-card p-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-sm text-ink-600">Tiene que decir</span>
              <div className="text-right">
                <p className="font-landing-mono text-2xl font-semibold leading-tight tracking-[-0.02em] tabular-nums">
                  {order.total_bs ? formatBs(order.total_bs) : formatUSD(order.total)}
                </p>
                {order.total_bs && (
                  <p className="font-landing-mono text-xs text-ink-500">
                    {formatUSD(order.total)} · {paymentLabel}
                  </p>
                )}
              </div>
            </div>
            {order.payment_reference && (
              <p className="mt-2.5 border-t border-dashed pt-2.5 text-sm">
                <span className="text-ink-600">Referencia </span>
                <span className="font-landing-mono font-semibold">{order.payment_reference}</span>
              </p>
            )}
          </div>

          {proofUrl && (proofCheck || proofAutoRead) && (
            <div className="mt-3.5">
              <ProofCheck
                key={order.id}
                orderId={order.id}
                initial={proofCheck}
                autoRead={proofAutoRead}
              />
            </div>
          )}

          <div className="mt-3.5">
            {proofUrl ? (
              <ProofViewer url={proofUrl} />
            ) : (
              <p className="rounded-xl border border-dashed bg-card p-4 text-center text-sm text-ink-600">
                El cliente no adjuntó comprobante. Confírmalo solo si verificaste
                el pago por tu cuenta.
              </p>
            )}
          </div>
        </section>
      )}

      <section className={block} aria-label="Acciones del pedido">
        <OrderActions
          orderId={order.id}
          status={order.status}
          orderNumber={order.order_number}
          customerName={order.customer_name}
          customerPhone={order.customer_phone}
          storeName={storeName}
          receiptMessage={receiptMessage}
        />
      </section>

      <section className={cn(block, "grid gap-5 sm:grid-cols-2")}>
        <div>
          <Label>Cliente</Label>
          <p className="mt-2 font-semibold">{order.customer_name}</p>
          <div className="mt-1 space-y-1 text-sm text-ink-600">
            <p className="flex items-center gap-2">
              <Phone className="size-4 shrink-0" />
              <span className="font-landing-mono text-[13px]">{order.customer_phone}</span>
            </p>
            {order.customer_email && (
              <p className="flex min-w-0 items-center gap-2">
                <Mail className="size-4 shrink-0" />
                <span className="truncate">{order.customer_email}</span>
              </p>
            )}
          </div>
        </div>
        <div>
          <Label>Entrega</Label>
          {order.fulfillment_type === "delivery" ? (
            <div className="mt-2 space-y-1 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <Bike className="size-4" /> Delivery
              </p>
              <p className="flex items-start gap-2 text-ink-600">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                {order.delivery_address}
              </p>
              {order.delivery_notes && (
                <p className="text-ink-600">Nota: {order.delivery_notes}</p>
              )}
            </div>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold">
              <StoreIcon className="size-4" /> Retiro en tienda
            </p>
          )}
        </div>
      </section>

      <section className={block}>
        <Label>Productos</Label>
        <ul className="mt-2 divide-y divide-ink-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.product_name}</p>
                {item.variant_name && (
                  <p className="text-xs font-medium text-brand-700">{item.variant_name}</p>
                )}
                <p className="font-landing-mono text-xs text-ink-500">
                  {item.quantity} × {formatUSD(item.unit_price)}
                </p>
              </div>
              <span className="font-landing-mono text-sm font-semibold tabular-nums">
                {formatUSD(item.subtotal)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-1 space-y-1.5 border-t border-dashed border-ink-300 pt-3 text-sm">
          {(order.shipping_cost > 0 || order.discount_total > 0) && (
            <div className="flex justify-between text-ink-600">
              <span>Subtotal</span>
              <span className="font-landing-mono tabular-nums">{formatUSD(order.subtotal)}</span>
            </div>
          )}
          {order.discount_total > 0 && (
            <div className="flex justify-between text-success-text">
              <span>Descuento{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
              <span className="font-landing-mono tabular-nums">−{formatUSD(order.discount_total)}</span>
            </div>
          )}
          {order.shipping_cost > 0 && (
            <div className="flex justify-between text-ink-600">
              <span>Envío</span>
              <span className="font-landing-mono tabular-nums">{formatUSD(order.shipping_cost)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-1">
            <span className="font-bold">Total</span>
            <div className="text-right font-landing-mono tabular-nums">
              <p className="text-lg font-semibold">{formatUSD(order.total)}</p>
              {order.total_bs && (
                <p className="text-xs text-ink-500">{formatBs(order.total_bs)}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={block}>
        <Label>Pago</Label>
        <p className="mt-2 text-sm">
          <span className="text-ink-600">Método: </span>
          <span className="font-semibold">{paymentLabel}</span>
        </p>
        {order.payment_reference && (
          <p className="text-sm">
            <span className="text-ink-600">Referencia: </span>
            <span className="font-landing-mono font-semibold">{order.payment_reference}</span>
          </p>
        )}
        {proofUrl ? (
          // Ya se muestra grande arriba mientras está por confirmar; acá abajo
          // queda solo como registro del pedido una vez resuelto.
          order.status !== "pending_confirmation" && (
            <div className="mt-3 space-y-3">
              {proofCheck?.status === "done" && (
                <ProofCheck key={order.id} orderId={order.id} initial={proofCheck} autoRead={false} />
              )}
              <ProofViewer url={proofUrl} />
            </div>
          )
        ) : (
          order.payment_method_type &&
          order.payment_method_type !== "cash" && (
            <p className="mt-2 text-sm text-ink-600">Sin comprobante adjunto.</p>
          )
        )}
      </section>

      {order.notes && (
        <section className={block}>
          <Label>Nota del cliente</Label>
          <p className="mt-2 text-sm text-ink-600">{order.notes}</p>
        </section>
      )}
    </>
  );
}
