"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth";
import type { OrderStatus } from "@/types/database";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function requireStoreId(): Promise<string> {
  const ctx = await getSessionContext();
  if (!ctx?.store) throw new Error("No autorizado");
  return ctx.store.id;
}

function revalidate(orderId: string) {
  revalidatePath("/panel/pedidos");
  revalidatePath(`/panel/pedidos/${orderId}`);
  revalidatePath("/panel");
}

/**
 * Confirm payment for an order awaiting verification: move
 * pending_confirmation → confirmed and decrement stock definitively
 * (tracked products only). Mirrors the cash-order decrement in createOrder.
 */
export async function confirmPayment(orderId: string): Promise<ActionResult> {
  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

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
    .select("product_id, quantity")
    .eq("order_id", orderId);

  const tracked = (items ?? []).filter(
    (i): i is { product_id: string; quantity: number } => Boolean(i.product_id),
  );

  if (tracked.length > 0) {
    const ids = tracked.map((i) => i.product_id);
    const { data: products } = await db
      .from("products")
      .select("id, stock, track_stock")
      .in("id", ids)
      .eq("store_id", storeId);
    const byId = new Map((products ?? []).map((p) => [p.id, p]));

    await Promise.all(
      tracked.map((item) => {
        const product = byId.get(item.product_id);
        if (!product || !product.track_stock) return Promise.resolve();
        const newStock = Math.max(0, product.stock - item.quantity);
        return db
          .from("products")
          .update({ stock: newStock })
          .eq("id", item.product_id)
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

  let storeId: string;
  try {
    storeId = await requireStoreId();
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
    .eq("store_id", storeId);
  if (error) return { ok: false, error: "No se pudo actualizar el pedido" };

  revalidate(orderId);
  return { ok: true };
}
