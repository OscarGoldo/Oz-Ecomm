"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth";
import { SALES_STATUSES } from "@/lib/metrics";
import { recordPlatformEvent } from "@/lib/platform-events";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Marca como pagado lo que se le debía a una tienda por sus ventas online.
 * Estampa cada venta sin liquidar de esa tienda con la fecha y el comprobante.
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
  const { data: settled, error } = await db
    .from("orders")
    .update({
      paid_out_at: new Date().toISOString(),
      payout_proof_url: proofPath,
      payout_reference: reference,
    })
    .eq("store_id", storeId)
    // Todo lo cobrado online por la plataforma. "paypal" queda por las ventas
    // anteriores a septiembre de 2026, que también hay que liquidar.
    .in("payment_method_type", ["stripe", "paypal"])
    .is("paid_out_at", null)
    .in("status", SALES_STATUSES)
    .select("total, payment_net");

  if (error) return { ok: false, error: "No se pudo registrar el pago" };

  if (settled && settled.length > 0) {
    const { data: store } = await db
      .from("stores")
      .select("name")
      .eq("id", storeId)
      .maybeSingle();
    // Mismo criterio que /super/pagos: sin neto guardado vale el total.
    const paid = settled.reduce(
      (s, o) => s + Number(o.payment_net ?? o.total),
      0,
    );
    await recordPlatformEvent({
      type: "payout.sent",
      storeId,
      amount: paid,
      title: `Pago a tienda registrado: ${store?.name ?? "tienda"}`,
      detail: `${settled.length} ${settled.length === 1 ? "venta" : "ventas"}${
        reference ? ` · ref ${reference}` : ""
      }`,
      url: "/super/pagos",
    });
  }

  // Lo que se le debe a las tiendas también sale en Inicio.
  revalidatePath("/super", "layout");
  return { ok: true };
}
