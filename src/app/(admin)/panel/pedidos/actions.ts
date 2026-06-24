"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth";
import { customerOrderStatusEmail, sendEmail } from "@/lib/email";
import { orderStatusClientMessage } from "@/lib/order-messages";
import { ORDER_STATUS_META } from "@/lib/constants";
import type { OrderStatus, Store } from "@/types/database";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function requireStore(): Promise<Store> {
  const ctx = await getSessionContext();
  if (!ctx?.store) throw new Error("No autorizado");
  return ctx.store;
}

function revalidate(orderId: string) {
  revalidatePath("/panel/pedidos");
  revalidatePath(`/panel/pedidos/${orderId}`);
  revalidatePath("/panel");
}

/**
 * Automatically email the customer about a status change. No-op if the order
 * has no email or Resend isn't configured. Never fails the action.
 */
async function notifyCustomerEmail(
  orderId: string,
  status: OrderStatus,
  storeName: string,
) {
  try {
    const db = createAdminClient();
    const { data: order } = await db
      .from("orders")
      .select("customer_email, customer_name, order_number")
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.customer_email) return;
    const message = orderStatusClientMessage(
      status,
      order.customer_name,
      order.order_number,
      storeName,
    );
    const { subject, html } = customerOrderStatusEmail({
      storeName,
      orderNumber: order.order_number,
      statusLabel: ORDER_STATUS_META[status].label,
      message,
    });
    await sendEmail({ to: order.customer_email, subject, html });
  } catch {
    /* notifications must never break the status change */
  }
}

/**
 * Confirm payment for an order awaiting verification: move
 * pending_confirmation → confirmed and decrement stock definitively
 * (tracked products only). Mirrors the cash-order decrement in createOrder.
 */
export async function confirmPayment(orderId: string): Promise<ActionResult> {
  let store: Store;
  try {
    store = await requireStore();
  } catch {
    return { ok: false, error: "No autorizado" };
  }
  const storeId = store.id;

  const db = createAdminClient();

  const { data: order } = await db
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Pedido no encontrado" };
  if (order.status !== "pending_confirmation") {
    return { ok: false, error: "Este pedido ya fue procesado" };
  }

  const { data: items } = await db
    .from("order_items")
    .select("product_id, variant_id, quantity")
    .eq("order_id", orderId);

  const lines = (items ?? []).filter(
    (i): i is { product_id: string; variant_id: string | null; quantity: number } =>
      Boolean(i.product_id),
  );

  // Per-variant stock.
  const variantLines = lines.filter((i) => i.variant_id) as {
    product_id: string;
    variant_id: string;
    quantity: number;
  }[];
  if (variantLines.length > 0) {
    const { data: vars } = await db
      .from("product_variants")
      .select("id, stock")
      .in("id", variantLines.map((i) => i.variant_id))
      .eq("store_id", storeId);
    const vById = new Map((vars ?? []).map((v) => [v.id, v]));
    await Promise.all(
      variantLines.map((i) => {
        const v = vById.get(i.variant_id);
        if (!v) return Promise.resolve();
        return db
          .from("product_variants")
          .update({ stock: Math.max(0, v.stock - i.quantity) })
          .eq("id", i.variant_id)
          .eq("store_id", storeId);
      }),
    );
  }

  // Product stock (direct for tracked simple products, mirrored for variant lines).
  const productIds = [...new Set(lines.map((i) => i.product_id))];
  if (productIds.length > 0) {
    const { data: products } = await db
      .from("products")
      .select("id, stock, track_stock")
      .in("id", productIds)
      .eq("store_id", storeId);
    const pById = new Map((products ?? []).map((p) => [p.id, p]));

    const decrement = new Map<string, number>();
    for (const i of lines) {
      const p = pById.get(i.product_id);
      if (!p) continue;
      if (i.variant_id || p.track_stock) {
        decrement.set(i.product_id, (decrement.get(i.product_id) ?? 0) + i.quantity);
      }
    }
    await Promise.all(
      [...decrement.entries()].map(([pid, dec]) => {
        const base = pById.get(pid)?.stock ?? 0;
        return db
          .from("products")
          .update({ stock: Math.max(0, base - dec) })
          .eq("id", pid)
          .eq("store_id", storeId);
      }),
    );
  }

  const { error } = await db
    .from("orders")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("store_id", storeId);
  if (error) return { ok: false, error: "No se pudo confirmar el pago" };

  await notifyCustomerEmail(orderId, "confirmed", store.name);
  revalidate(orderId);
  return { ok: true };
}

const MANUAL_STATUSES: OrderStatus[] = [
  "preparing",
  "in_delivery",
  "completed",
  "cancelled",
];

/** Manually advance/cancel an order (after it is confirmed). */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<ActionResult> {
  if (!MANUAL_STATUSES.includes(status)) {
    return { ok: false, error: "Estado no permitido" };
  }

  let store: Store;
  try {
    store = await requireStore();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const now = new Date().toISOString();
  const db = createAdminClient();
  const { error } = await db
    .from("orders")
    .update({
      status,
      ...(status === "completed" ? { completed_at: now } : {}),
      ...(status === "cancelled" ? { cancelled_at: now } : {}),
    })
    .eq("id", orderId)
    .eq("store_id", store.id);
  if (error) return { ok: false, error: "No se pudo actualizar el pedido" };

  await notifyCustomerEmail(orderId, status, store.name);
  revalidate(orderId);
  return { ok: true };
}
