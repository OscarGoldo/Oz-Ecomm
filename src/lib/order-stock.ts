// Los movimientos de inventario de un pedido, en un solo lugar.
//
// Vivía dentro de panel/pedidos/actions.ts, pero el webhook de Stripe también
// necesita devolver el stock cuando una sesión de pago vence sin pagarse, y dos
// copias de esta regla es exactamente la forma de que un día dejen de coincidir.

import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/** Índice de string para que encaje en el `Json` que esperan las RPC. */
export interface StockOp {
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
export async function stockOpsForOrder(
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
