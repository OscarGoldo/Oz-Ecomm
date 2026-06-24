import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Store as StoreIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/admin/status-badge";
import { getStoreBySlug } from "@/lib/storefront";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBs, formatUSD } from "@/lib/format";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import { whatsappUrl } from "@/lib/whatsapp";
import type { OrderItem, PaymentMethodType } from "@/types/database";

export const metadata: Metadata = { title: { absolute: "Tu pedido" } };

export default async function OrderConfirmationPage({
  params,
}: {
  params: { store_slug: string; order_id: string };
}) {
  const store = await getStoreBySlug(params.store_slug);
  if (!store) notFound();

  const db = createAdminClient();
  const { data: order } = await db
    .from("orders")
    .select("*")
    .eq("id", params.order_id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!order) notFound();

  const { data: items } = await db
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at");
  const orderItems = (items ?? []) as OrderItem[];

  const isPendingProof = order.status === "pending_confirmation";
  const paymentLabel = order.payment_method_type
    ? (PAYMENT_METHOD_META[order.payment_method_type as PaymentMethodType]?.label ??
      order.payment_method_type)
    : null;

  const waMessage = `¡Hola ${store.name}! 👋\nHice el pedido *#${order.order_number}* a nombre de ${order.customer_name}.\nTotal: ${formatUSD(order.total)}${
    order.total_bs ? ` (${formatBs(order.total_bs)})` : ""
  }.\n¿Me confirman? ¡Gracias!`;
  const waUrl = whatsappUrl(store.whatsapp, waMessage);

  return (
    <main className="container max-w-2xl py-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <span
          className={`mb-3 grid size-14 place-items-center rounded-full ${
            isPendingProof ? "bg-warning/15 text-warning-foreground" : "bg-success/15 text-success"
          }`}
        >
          {isPendingProof ? (
            <Clock className="size-7" />
          ) : (
            <CheckCircle2 className="size-7" />
          )}
        </span>
        <h1 className="text-2xl font-bold tracking-tight">
          Pedido #{order.order_number}
        </h1>
        <div className="mt-2">
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          {isPendingProof
            ? "Recibimos tu pedido y tu comprobante. La tienda va a verificar el pago y confirmarlo a la brevedad."
            : "¡Pedido recibido! La tienda ya lo está procesando. Te contactarán para coordinar la entrega."}
        </p>
      </div>

      {/* WhatsApp notify */}
      {waUrl && (
        <Button asChild size="lg" className="mt-6 w-full">
          <a href={waUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> Avisar a la tienda por WhatsApp
          </a>
        </Button>
      )}

      {/* Items */}
      <div className="mt-6 rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="text-sm font-semibold">Resumen</h2>
        </div>
        <ul className="divide-y">
          {orderItems.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.product_name}</p>
                {item.variant_name && (
                  <p className="text-xs font-medium text-primary">{item.variant_name}</p>
                )}
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
      </div>

      {/* Delivery + payment */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Entrega</h3>
          {order.fulfillment_type === "delivery" ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              {order.delivery_address}
            </p>
          ) : (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <StoreIcon className="mt-0.5 size-4 shrink-0" />
              Retiro en tienda
              {store.pickup_address ? ` · ${store.pickup_address}` : ""}
            </p>
          )}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Pago</h3>
          <p className="text-sm text-muted-foreground">{paymentLabel ?? "—"}</p>
          {order.payment_proof_url && (
            <p className="mt-1 text-xs text-success">Comprobante recibido ✓</p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-card p-4">
        <h3 className="mb-1 text-sm font-semibold">Tus datos</h3>
        <p className="text-sm text-muted-foreground">
          {order.customer_name} · {order.customer_phone}
        </p>
      </div>

      <Button asChild variant="ghost" className="mt-6 w-full">
        <Link href={`/${store.slug}`}>Seguir comprando</Link>
      </Button>
    </main>
  );
}
