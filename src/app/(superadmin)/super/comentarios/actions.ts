"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Marca como leídos uno o todos los comentarios pendientes.
 *
 * `id` null = todos. El filtro `read_at IS NULL` hace que repetirlo no pise la
 * fecha en que se leyó de verdad.
 */
export async function markFeedbackRead(id: string | null): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx || ctx.user.role !== "super_admin") {
    return { ok: false, error: "No autorizado" };
  }

  let query = createAdminClient()
    .from("feedback")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (id) query = query.eq("id", id);

  const { error } = await query;
  if (error) return { ok: false, error: "No se pudo marcar como leído" };

  revalidatePath("/super", "layout");
  return { ok: true };
}
