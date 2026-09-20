// Avisos de un pedido que se acaba de pagar online, sin depender del navegador.
//
// Existe por el checkout de Stripe: ahí el pedido se confirma desde el webhook,
// donde no hay cookies ni sesión ni nada del cliente. Todo lo que hace falta se
// lee de la base. En el checkout normal los mismos avisos salen inline (ver
// createOrder), porque ahí el cobro ya está resuelto cuando termina la acción.

import { formatUSD } from "@/lib/format";
import {
  customerOrderReceiptEmail,
  newOrderEmail,
  sendEmail,
} from "@/lib/email";
import { buildOrderMessageData } from "@/lib/order-messages";
import { reportError } from "@/lib/report-error";
import { notifyOwnerNewOrder } from "@/lib/whatsapp-cloud";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Avisa del pedido pagado: email al dueño, WhatsApp al dueño y recibo al
 * cliente.
 *
 * Nunca lanza. Un pedido ya cobrado y confirmado no se puede caer porque
 * Resend esté de mal humor.
 */
export async function notifyPaidOrder(db: Db, orderId: string): Promise<void> {
  try {
    const { data: order } = await db
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return;

    const [{ data: store }, { data: items }, { data: owners }] =
      await Promise.all([
        db
          .from("stores")
          .select("id, name, slug, whatsapp, pickup_address")
          .eq("id", order.store_id)
          .maybeSingle(),
        db
          .from("order_items")
          .select("product_name, variant_name, quantity, unit_price, subtotal")
          .eq("order_id", order.id),
        db
          .from("users")
          .select("email")
          .eq("store_id", order.store_id)
          .in("role", ["store_owner", "store_staff"])
          .eq("active", true),
      ]);
    if (!store) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const lines = (items ?? []).map((i) => ({
      product_name: i.product_name,
      variant_name: i.variant_name,
      quantity: i.quantity,
      unit_price: Number(i.unit_price),
      subtotal: Number(i.subtotal),
    }));

    const messageData = buildOrderMessageData({
      order: {
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        fulfillment_type: order.fulfillment_type,
        delivery_address: order.delivery_address,
        subtotal: Number(order.subtotal),
        shipping_cost: Number(order.shipping_cost ?? 0),
        discount_total: Number(order.discount_total ?? 0),
        coupon_code: order.coupon_code,
        total: Number(order.total),
        total_bs: order.total_bs != null ? Number(order.total_bs) : null,
        payment_method_type: order.payment_method_type,
        notes: order.notes,
      },
      items: lines,
      storeName: store.name,
      pickupAddress: store.pickup_address,
      orderUrl: `${appUrl}/${store.slug}/pedido/${order.id}`,
      panelUrl: `${appUrl}/panel/pedidos/${order.id}`,
    });

    const recipients = (owners ?? [])
      .map((o) => o.email)
      .filter((e): e is string => Boolean(e));

    if (recipients.length > 0) {
      const { subject, html } = newOrderEmail({
        storeName: store.name,
        orderNumber: order.order_number,
        customerName: order.customer_name,
        totalLabel: formatUSD(Number(order.total)),
        itemsCount: lines.reduce((s, i) => s + i.quantity, 0),
        fulfillmentLabel:
          order.fulfillment_type === "delivery" ? "Delivery" : "Retiro en tienda",
        orderUrl: `${appUrl}/panel/pedidos/${order.id}`,
      });
      await sendEmail({ to: recipients, subject, html });
    }

    await notifyOwnerNewOrder({
      toPhone: store.whatsapp,
      storeName: store.name,
      orderNumber: order.order_number,
      totalLabel: formatUSD(Number(order.total)),
    });

    if (order.customer_email) {
      const { subject, html } = customerOrderReceiptEmail(messageData, {
        state: "confirmed",
      });
      await sendEmail({ to: order.customer_email, subject, html });
    }
  } catch (e) {
    reportError("notifyPaidOrder", e, { orderId });
  }
}
