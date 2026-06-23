import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Bike,
  Mail,
  MapPin,
  Phone,
  Store as StoreIcon,
} from "lucide-react";

import { OrderStatusBadge } from "@/components/admin/status-badge";
import { OrderActions } from "@/components/admin/order-actions";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAYMENT_PROOFS_BUCKET } from "@/lib/storage";
import { formatBs, formatUSD } from "@/lib/format";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import type { OrderItem, PaymentMethodType } from "@/types/database";

export const metadata = { title: "Pedido" };

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { store } = await requireStoreUser();
  const supabase = createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", params.id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!order) notFound();

  const { data: itemsData } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at");
  const items = (itemsData ?? []) as OrderItem[];

  let proofUrl: string | null = null;
  if (order.payment_proof_url) {
    const { data } = await createAdminClient()
      .storage.from(PAYMENT_PROOFS_BUCKET)
      .createSignedUrl(order.payment_proof_url, 600);
    proofUrl = data?.signedUrl ?? null;
  }

  const paymentLabel = order.payment_method_type
    ? (PAYMENT_METHOD_META[order.payment_method_type as PaymentMethodType]?.label ??
      order.payment_method_type)
    : "—";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/panel/pedidos"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Pedidos
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            #{order.order_number} · {order.customer_name}
          </h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {format(new Date(order.created_at), "EEEE d 'de' MMMM, HH:mm", {
            locale: es,
          })}
        </p>
      </div>

      {/* Actions */}
      <div className="rounded-xl border bg-card p-4">
        <OrderActions
          orderId={order.id}
          status={order.status}
          orderNumber={order.order_number}
          customerName={order.customer_name}
          customerPhone={order.customer_phone}
          storeName={store.name}
        />
      </div>

      {/* Customer */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Cliente</h2>
        <p className="font-medium">{order.customer_name}</p>
        <div className="mt-1 space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Phone className="size-4" /> {order.customer_phone}
          </p>
          {order.customer_email && (
            <p className="flex items-center gap-2">
              <Mail className="size-4" /> {order.customer_email}
            </p>
          )}
        </div>
      </section>

      {/* Fulfillment */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Entrega</h2>
        {order.fulfillment_type === "delivery" ? (
          <div className="space-y-1 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Bike className="size-4" /> Delivery
            </p>
            <p className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              {order.delivery_address}
            </p>
            {order.delivery_notes && (
              <p className="text-muted-foreground">Nota: {order.delivery_notes}</p>
            )}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm font-medium">
            <StoreIcon className="size-4" /> Retiro en tienda
          </p>
        )}
      </section>

      {/* Items */}
      <section className="rounded-xl border bg-card">
        <h2 className="border-b p-4 text-sm font-semibold">Productos</h2>
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} × {formatUSD(item.unit_price)}
                </p>
              </div>
              <span className="text-sm font-semibold">{formatUSD(item.subtotal)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1.5 border-t p-4 text-sm">
          {(order.shipping_cost > 0 || order.discount_total > 0) && (
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatUSD(order.subtotal)}</span>
            </div>
          )}
          {order.discount_total > 0 && (
            <div className="flex justify-between text-success">
              <span>Descuento{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
              <span>−{formatUSD(order.discount_total)}</span>
            </div>
          )}
          {order.shipping_cost > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Envío</span>
              <span>{formatUSD(order.shipping_cost)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="font-medium">Total</span>
            <div className="text-right">
              <p className="text-lg font-bold">{formatUSD(order.total)}</p>
              {order.total_bs && (
                <p className="text-xs text-muted-foreground">{formatBs(order.total_bs)}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Payment */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Pago</h2>
        <p className="text-sm">
          <span className="text-muted-foreground">Método: </span>
          <span className="font-medium">{paymentLabel}</span>
        </p>
        {order.payment_reference && (
          <p className="text-sm">
            <span className="text-muted-foreground">Referencia: </span>
            <span className="font-medium">{order.payment_reference}</span>
          </p>
        )}
        {proofUrl ? (
          <a
            href={proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block overflow-hidden rounded-lg border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proofUrl}
              alt="Comprobante de pago"
              className="max-h-80 w-full bg-muted object-contain"
            />
          </a>
        ) : (
          order.payment_method_type &&
          order.payment_method_type !== "cash" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Sin comprobante adjunto.
            </p>
          )
        )}
      </section>

      {/* Notes */}
      {order.notes && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-1 text-sm font-semibold">Nota del cliente</h2>
          <p className="text-sm text-muted-foreground">{order.notes}</p>
        </section>
      )}
    </div>
  );
}
