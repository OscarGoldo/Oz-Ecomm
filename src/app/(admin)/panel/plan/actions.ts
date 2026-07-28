"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth";
import { PLAN_PERIODS, priceFor } from "@/lib/plans";
import { getPlatformConfig } from "@/lib/platform";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const schema = z.object({
  period_months: z.coerce
    .number()
    .int()
    .refine((v) => (PLAN_PERIODS as readonly number[]).includes(v), "Período inválido"),
  method: z.enum(["pago_movil", "zelle", "binance", "paypal"]),
  reference: z.string().trim().max(120).optional(),
  proof_path: z.string().trim().max(400).nullable().optional(),
});

export type UpgradeInput = z.input<typeof schema>;

/**
 * El comerciante reporta que pagó su plan Pro y sube el comprobante.
 *
 * Se escribe con service role y `status` fijo en 'pending': la tabla no tiene
 * policy de INSERT para tenants, así que nadie puede aprobarse el plan a sí
 * mismo. El monto también se recalcula acá desde los precios configurados —
 * nunca se confía en el que mandó el cliente.
 */
export async function requestProUpgrade(
  input: UpgradeInput,
): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  const ctx = await getSessionContext();
  if (!ctx?.store) return { ok: false, error: "No autorizado" };

  if (!d.proof_path) {
    return { ok: false, error: "Subí la foto del comprobante" };
  }
  // El comprobante debe estar en la carpeta de la propia tienda: evita que se
  // referencie el archivo de otro tenant.
  if (!d.proof_path.startsWith(`${ctx.store.id}/`)) {
    return { ok: false, error: "Comprobante inválido" };
  }

  const db = createAdminClient();

  // Un solo pago en revisión a la vez, para no duplicar meses por doble envío.
  const { count: pending } = await db
    .from("subscription_payments")
    .select("id", { count: "exact", head: true })
    .eq("store_id", ctx.store.id)
    .eq("status", "pending");
  if ((pending ?? 0) > 0) {
    return {
      ok: false,
      error: "Ya tenés un comprobante en revisión. Te avisamos apenas lo confirmemos.",
    };
  }

  const { prices } = await getPlatformConfig();

  const { error } = await db.from("subscription_payments").insert({
    store_id: ctx.store.id,
    period_months: d.period_months,
    amount: priceFor(d.period_months, prices),
    currency: "USD",
    method: d.method,
    reference: d.reference?.trim() || null,
    proof_url: d.proof_path,
    status: "pending",
  });
  if (error) {
    return { ok: false, error: "No se pudo registrar el pago. Intentá de nuevo." };
  }

  revalidatePath("/panel/plan");
  revalidatePath("/panel");
  return { ok: true };
}
