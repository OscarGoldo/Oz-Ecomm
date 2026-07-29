"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth";
import type { AbandonedCart } from "@/types/database";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Todas las escrituras pasan por aquí con el store_id de la sesión: la tabla no
 * tiene policy de UPDATE para el dueño, así que el filtro es la seguridad.
 */
async function updateCart(
  cartId: string,
  patch: Partial<Pick<AbandonedCart, "last_contacted_at" | "dismissed_at">>,
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx?.store) return { ok: false, error: "No autorizado" };

  const { error } = await createAdminClient()
    .from("abandoned_carts")
    .update(patch)
    .eq("id", cartId)
    .eq("store_id", ctx.store.id);
  if (error) return { ok: false, error: "No se pudo actualizar el carrito" };

  revalidatePath("/panel/carritos");
  return { ok: true };
}

/** El comerciante le escribió: se registra para que no lo persiga. */
export async function markCartContacted(cartId: string): Promise<ActionResult> {
  return updateCart(cartId, { last_contacted_at: new Date().toISOString() });
}

/** Archiva el carrito sin comprar (cliente que no responde, pedido duplicado…). */
export async function dismissCart(cartId: string): Promise<ActionResult> {
  return updateCart(cartId, { dismissed_at: new Date().toISOString() });
}
