"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth";
import { SALES_STATUSES } from "@/lib/metrics";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Mark a tenant's outstanding PayPal earnings as paid out. Stamps every
 * not-yet-settled PayPal sale of that store with the payout date + proof.
 */
export async function settleStorePayout(
  storeId: string,
  proofPath: string | null,
  reference: string | null,
): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("orders")
    .update({
      paid_out_at: new Date().toISOString(),
      payout_proof_url: proofPath,
      payout_reference: reference,
    })
    .eq("store_id", storeId)
    .eq("payment_method_type", "paypal")
    .is("paid_out_at", null)
    .in("status", SALES_STATUSES);

  if (error) return { ok: false, error: "No se pudo registrar el pago" };

  revalidatePath("/super/pagos");
  return { ok: true };
}
