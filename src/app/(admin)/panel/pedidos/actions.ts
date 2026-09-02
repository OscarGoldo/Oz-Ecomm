"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth";
import { customerOrderStatusEmail, sendEmail } from "@/lib/email";
import {
  orderStatusClientMessage,
  shouldNotifyCustomer,
} from "@/lib/order-messages";
import { ORDER_STATUS_META } from "@/lib/constants";
import { maybeQualifyReferral } from "@/lib/referrals-server";
import { CONFIRMABLE_FROM, canTransition, isConfirmable } from "@/lib/order-status";
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
 *
 * Se llama desde TODA transición de estado del pedido: si mañana aparece otro
 * camino que toca `orders.status`, tiene que pasar por acá.
 */
async function notifyCustomerEmail(orderId: string, status: OrderStatus, store: Store) {
  if (!shouldNotifyCustomer(status)) return;
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
      store.name,
    );
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { subject, html } = customerOrderStatusEmail({
      storeName: store.name,
      orderNumber: order.order_number,
      statusLabel: ORDER_STATUS_META[status].label,
      message,
      orderUrl: `${appUrl}/${store.slug}/pedido/${orderId}`,
    });
    await sendEmail({ to: order.customer_email, subject, html });
  } catch {
    /* notifications must never break the status change */
  }
}

type Db = ReturnType<typeof createAdminClient>;

/** Índice de string para que encaje en el `Json` que esperan las RPC. */
interface StockOp {
  [key: string]: string | number | null;
  product_id: string;
  variant_id: string | null;
  qty: number;
}

/**
 * Movimientos de inventario que corresponden a un pedido, respetando
 * `track_stock` (un producto con stock libre no mueve nada).
 *
 * Sirve para los dos sentidos: descontar y devolver.
 */
async function stockOpsForOrder(
  db: Db,
  storeId: string,
  orderId: string,
): Promise<StockOp[]> {
  const { data: items } = await db
    .from("order_items")
    .select("product_id, variant_id, quantity")
    .eq("order_id", orderId);

  const lines = (items ?? []).filter(
    (i): i is { product_id: string; variant_id: string | null; quantity: number } =>
      Boolean(i.product_id),
  );
  if (lines.length === 0) return [];

  const { data: products } = await db
    .from("products")
    .select("id, track_stock")
    .in("id", [...new Set(lines.map((i) => i.product_id))])
    .eq("store_id", storeId);
  const trackedById = new Map((products ?? []).map((p) => [p.id, p.track_stock]));

  const ops: StockOp[] = [];
  for (const line of lines) {
    // El producto tiene que seguir existiendo y ser de esta tienda.
    if (!trackedById.has(line.product_id)) continue;
    // Una línea con variante siempre mueve stock; una simple, solo si el
    // producto lo lleva. Es el mismo criterio que usa buildOrderDraft().
    if (!line.variant_id && !trackedById.get(line.product_id)) continue;
    ops.push({
      product_id: line.product_id,
      variant_id: line.variant_id,
      qty: line.quantity,
    });
  }
  return ops;
}

/**
 * Confirmar el pago de un pedido que esperaba verificación:
 * pending_confirmation → confirmed.
 *
 * Ya NO descuenta stock en el caso normal: desde la migración 0021 el
 * inventario se reserva al crear el pedido. Lo único que queda acá es el
 * rescate de los pedidos viejos que quedaron sin reservar
 * (`stock_committed = false`).
 *
 * El candado de idempotencia es el UPDATE condicional por `status`: si el
 * dueño toca "Confirmar" dos veces con mala señal, las dos ejecuciones
 * compiten por la misma fila y solo una se la lleva. Antes esto era un
 * check-then-act con la lectura y la escritura separadas por todo el bloque de
 * stock, así que los dos taps descontaban.
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

  const { data: claimed, error: claimErr } = await db
    .from("orders")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("store_id", storeId)
    // Incluye "esperando pago": el pedido que el cliente dejó para pagar por
    // fuera y del que nunca subió comprobante. Si el comerciante cobró igual,
    // tiene que poder confirmarlo — el dropdown ya lo ofrecía y la acción lo
    // rechazaba, así que esos pedidos quedaban trabados.
    .in("status", CONFIRMABLE_FROM)
    .select("id, stock_committed")
    .maybeSingle();

  if (claimErr) return { ok: false, error: "No se pudo confirmar el pago" };
  if (!claimed) {
    // O no existe, o alguien más lo confirmó primero. Distinguirlo hace que el
    // mensaje sirva de algo.
    const { data: exists } = await db
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .eq("store_id", storeId)
      .maybeSingle();
    return exists
      ? { ok: false, error: "Este pedido ya fue procesado" }
      : { ok: false, error: "Pedido no encontrado" };
  }

  // Pedidos anteriores a la migración 0021: nacieron sin reservar inventario.
  // Se descuenta acá, sin guardia — el cliente ya pagó y el dueño ya vio el
  // comprobante, así que rechazar no es una opción; un faltante puntual se
  // concilia a mano.
  if (!claimed.stock_committed) {
    const ops = await stockOpsForOrder(db, storeId, orderId);
    if (ops.length > 0) {
      const { error: stockErr } = await db.rpc("commit_order_stock", {
        p_items: ops,
        p_enforce: false,
      });
      if (!stockErr) {
        await db
          .from("orders")
          .update({ stock_committed: true })
          .eq("id", orderId);
      }
    }
  }

  await notifyCustomerEmail(orderId, "confirmed", store);
  // Confirmar una venta es lo que puede activar el referido que trajo a esta
  // tienda. Sale en la primera consulta si no hay ninguno pendiente.
  await maybeQualifyReferral(storeId);
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

  // Si el pedido ya está en ese estado no se reescribe ni se le manda otro
  // correo al cliente: dos taps seguidos en "En camino" no son dos avisos.
  const { data: current } = await db
    .from("orders")
    .select("status, stock_committed")
    .eq("id", orderId)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!current) return { ok: false, error: "Pedido no encontrado" };
  if (current.status === status) return { ok: true };

  // La transición tiene que ser legal DESDE donde está el pedido, no solo un
  // destino de la lista manual. Sin esto se podía marcar "Entregado" un pedido
  // que todavía esperaba el pago: contaba como venta en Finanzas y el cobro
  // nunca se confirmaba ni se descontaba nada.
  if (!canTransition(current.status, status)) {
    if (isConfirmable(current.status)) {
      return { ok: false, error: "Primero confirma el pago de este pedido." };
    }
    return {
      ok: false,
      error:
        current.status === "completed" || current.status === "cancelled"
          ? "Este pedido ya está cerrado y no se puede cambiar."
          : "Ese cambio de estado no es válido.",
    };
  }

  // Cancelar devuelve el inventario que este pedido tenía reservado. Es la
  // contraparte obligatoria de reservar al crear (migración 0021): sin esto,
  // cada cancelación se comería stock para siempre y el inventario del panel
  // dejaría de parecerse al del depósito.
  //
  // El cambio de estado y el apagado de `stock_committed` van en el MISMO
  // UPDATE condicional, no en dos. Así el permiso para reponer se gana una
  // sola vez: si dos taps en "Cancelar" llegan juntos, el segundo no encuentra
  // `stock_committed = true` y no repone de nuevo. Separarlos dejaba una
  // ventana donde el stock volvía pero el pedido seguía activo.
  const mustRestore = status === "cancelled" && current.stock_committed;

  const { data: updated, error } = await db
    .from("orders")
    .update({
      status,
      ...(status === "completed" ? { completed_at: now } : {}),
      ...(status === "cancelled" ? { cancelled_at: now, stock_committed: false } : {}),
    })
    .eq("id", orderId)
    .eq("store_id", store.id)
    .eq("status", current.status)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "No se pudo actualizar el pedido" };
  // Otra ejecución se adelantó y ya dejó el pedido en otro estado.
  if (!updated) return { ok: true };

  if (mustRestore) {
    const ops = await stockOpsForOrder(db, store.id, orderId);
    if (ops.length > 0) {
      await db.rpc("restore_order_stock", { p_items: ops });
    }
  }

  await notifyCustomerEmail(orderId, status, store);
  revalidate(orderId);
  return { ok: true };
}
