"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { readCartForStore } from "@/lib/cart";
import { clearCart } from "@/lib/cart-actions";
import { formatUSD, usdToBs } from "@/lib/format";
import { newOrderEmail, sendEmail } from "@/lib/email";
import type { OrderStatus } from "@/types/database";

const checkoutSchema = z.object({
  store_id: z.string().uuid(),
  customer_name: z.string().trim().min(2, "Ingresá tu nombre"),
  customer_phone: z.string().trim().min(6, "Ingresá un teléfono válido"),
  customer_email: z
    .string()
    .trim()
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  fulfillment_type: z.enum(["delivery", "pickup"]),
  delivery_address: z.string().trim().optional(),
  delivery_notes: z.string().trim().optional(),
  payment_method_id: z.string().uuid("Elegí un método de pago"),
  payment_reference: z.string().trim().optional(),
  payment_proof_path: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;

export interface CheckoutResult {
  ok: boolean;
  error?: string;
  orderId?: string;
}

export async function createOrder(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const db = createAdminClient();

  // Store (and its delivery options + rate snapshot).
  // select("*") so the new delivery-fee columns degrade gracefully if migration
  // 0004 hasn't been applied yet (they read as undefined → no shipping).
  const { data: store } = await db
    .from("stores")
    .select("*")
    .eq("id", data.store_id)
    .maybeSingle();
  if (!store || !store.active) {
    return { ok: false, error: "La tienda no está disponible" };
  }

  // Fulfillment validation.
  if (data.fulfillment_type === "delivery") {
    if (!store.offers_delivery) {
      return { ok: false, error: "La tienda no ofrece delivery" };
    }
    if (!data.delivery_address || data.delivery_address.length < 5) {
      return { ok: false, error: "Ingresá la dirección de entrega" };
    }
  } else if (!store.offers_pickup) {
    return { ok: false, error: "La tienda no ofrece retiro" };
  }

  // Payment method.
  const { data: method } = await db
    .from("payment_methods")
    .select("id, type, requires_proof, active")
    .eq("id", data.payment_method_id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!method || !method.active) {
    return { ok: false, error: "Método de pago no válido" };
  }
  if (method.requires_proof && !data.payment_proof_path) {
    return { ok: false, error: "Subí el comprobante de pago" };
  }

  // Cart (server-side source of truth).
  const cart = readCartForStore(store.id);
  if (cart.items.length === 0) {
    return { ok: false, error: "Tu carrito está vacío" };
  }

  const { data: products } = await db
    .from("products")
    .select("id, name, price, track_stock, stock, status")
    .eq("store_id", store.id)
    .in(
      "id",
      cart.items.map((i) => i.id),
    );
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const orderItems: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[] = [];
  const stockUpdates: { id: string; newStock: number }[] = [];

  for (const item of cart.items) {
    const product = byId.get(item.id);
    if (!product || product.status !== "active") {
      return { ok: false, error: "Un producto ya no está disponible. Revisá tu carrito." };
    }
    const qty = item.qty;
    if (product.track_stock && product.stock < qty) {
      return {
        ok: false,
        error: `Stock insuficiente de "${product.name}" (quedan ${product.stock}).`,
      };
    }
    orderItems.push({
      product_id: product.id,
      product_name: product.name,
      quantity: qty,
      unit_price: product.price,
      subtotal: product.price * qty,
    });
    if (product.track_stock) {
      stockUpdates.push({ id: product.id, newStock: product.stock - qty });
    }
  }

  const subtotal = orderItems.reduce((s, i) => s + i.subtotal, 0);

  // Shipping: flat delivery_fee for delivery orders, waived if subtotal reaches
  // the free-delivery threshold. Pickup is always free.
  const deliveryFee = Number(store.delivery_fee ?? 0);
  const freeMin = store.free_delivery_min;
  const shipping =
    data.fulfillment_type === "delivery" &&
    deliveryFee > 0 &&
    !(freeMin != null && subtotal >= Number(freeMin))
      ? deliveryFee
      : 0;

  const total = subtotal + shipping;
  const totalBs = store.show_bs_prices
    ? usdToBs(total, store.exchange_rate)
    : null;

  // Cash → accepted immediately; proof methods → wait for owner confirmation.
  const status: OrderStatus = method.requires_proof
    ? "pending_confirmation"
    : "confirmed";

  const { data: order, error: orderErr } = await db
    .from("orders")
    .insert({
      store_id: store.id,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_email: data.customer_email ? data.customer_email : null,
      fulfillment_type: data.fulfillment_type,
      delivery_address:
        data.fulfillment_type === "delivery" ? data.delivery_address! : null,
      delivery_notes: data.delivery_notes || null,
      subtotal,
      shipping_cost: shipping,
      total,
      currency: "USD",
      total_bs: totalBs,
      exchange_rate: store.exchange_rate,
      payment_method_type: method.type,
      payment_proof_url: data.payment_proof_path || null,
      payment_reference: data.payment_reference || null,
      status,
      notes: data.notes || null,
      confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
    })
    .select("id, order_number")
    .single();

  if (orderErr || !order) {
    return { ok: false, error: "No se pudo crear el pedido. Intentá de nuevo." };
  }

  const { error: itemsErr } = await db
    .from("order_items")
    .insert(orderItems.map((i) => ({ ...i, order_id: order.id })));
  if (itemsErr) {
    await db.from("orders").delete().eq("id", order.id);
    return { ok: false, error: "No se pudo crear el pedido. Intentá de nuevo." };
  }

  // Decrement stock now only for immediately-confirmed (cash) orders.
  // Proof orders decrement when the owner confirms payment (Phase 5).
  if (status === "confirmed") {
    await Promise.all(
      stockUpdates.map((u) =>
        db.from("products").update({ stock: Math.max(0, u.newStock) }).eq("id", u.id),
      ),
    );
  }

  // Notify the store owner(s) by email (no-op if Resend isn't configured).
  try {
    const { data: owners } = await db
      .from("users")
      .select("email")
      .eq("store_id", store.id)
      .in("role", ["store_owner", "store_staff"])
      .eq("active", true);
    const recipients = (owners ?? [])
      .map((o) => o.email)
      .filter((e): e is string => Boolean(e));
    if (recipients.length > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const { subject, html } = newOrderEmail({
        storeName: store.name,
        orderNumber: order.order_number,
        customerName: data.customer_name,
        totalLabel: formatUSD(total),
        itemsCount: orderItems.reduce((s, i) => s + i.quantity, 0),
        fulfillmentLabel:
          data.fulfillment_type === "delivery" ? "Delivery" : "Retiro en tienda",
        orderUrl: `${appUrl}/panel/pedidos/${order.id}`,
      });
      await sendEmail({ to: recipients, subject, html });
    }
  } catch {
    // Never fail the order because of a notification problem.
  }

  await clearCart(store.id);
  return { ok: true, orderId: order.id };
}
