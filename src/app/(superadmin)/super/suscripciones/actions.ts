"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth";
import { extendExpiry } from "@/lib/plans";
import { PAYMENT_PROOFS_BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function requireSuperAdminId(): Promise<string> {
  const ctx = await getSessionContext();
  if (!ctx || ctx.user.role !== "super_admin") throw new Error("No autorizado");
  return ctx.user.id;
}

/**
 * Aprobar un comprobante: extiende el plan de la tienda.
 *
 * La extensión parte del vencimiento actual si todavía está vigente, así que
 * renovar antes de tiempo suma en vez de reiniciar. Se marca el pago primero
 * con una condición sobre `status`: si dos pestañas aprueban el mismo pago, la
 * segunda no encuentra la fila 'pending' y no vuelve a sumar meses.
 */
export async function approveSubscriptionPayment(
  paymentId: string,
): Promise<ActionResult> {
  let adminId: string;
  try {
    adminId = await requireSuperAdminId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const db = createAdminClient();

  const { data: payment, error: claimErr } = await db
    .from("subscription_payments")
    .update({
      status: "approved",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("store_id, period_months")
    .maybeSingle();

  if (claimErr) return { ok: false, error: "No se pudo aprobar el pago" };
  if (!payment) return { ok: false, error: "Ese pago ya fue revisado" };

  const { data: store } = await db
    .from("stores")
    .select("plan_expires_at")
    .eq("id", payment.store_id)
    .maybeSingle();

  const { error: planErr } = await db
    .from("stores")
    .update({
      plan: "pro",
      plan_source: "paid",
      plan_expires_at: extendExpiry(
        store?.plan_expires_at,
        payment.period_months,
      ),
    })
    .eq("id", payment.store_id);

  if (planErr) {
    // El pago quedó aprobado pero el plan no se extendió: se revierte para que
    // vuelva a la cola en vez de dejar a alguien pagando sin recibir nada.
    await db
      .from("subscription_payments")
      .update({ status: "pending", reviewed_by: null, reviewed_at: null })
      .eq("id", paymentId);
    return { ok: false, error: "No se pudo activar el plan. Intentá de nuevo." };
  }

  revalidatePath("/super/suscripciones");
  revalidatePath("/super");
  return { ok: true };
}

/** Rechazar un comprobante, con una nota que el comerciante ve en su panel. */
export async function rejectSubscriptionPayment(
  paymentId: string,
  note: string,
): Promise<ActionResult> {
  let adminId: string;
  try {
    adminId = await requireSuperAdminId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("subscription_payments")
    .update({
      status: "rejected",
      review_note: note.trim() || null,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .eq("status", "pending");

  if (error) return { ok: false, error: "No se pudo rechazar el pago" };

  revalidatePath("/super/suscripciones");
  return { ok: true };
}

const planSchema = z.object({
  storeId: z.string().uuid(),
  /** 'free' baja a gratis; 'months' suma meses; 'comp' regala Pro sin vencimiento. */
  action: z.enum(["free", "months", "comp"]),
  months: z.coerce.number().int().min(1).max(120).default(12),
  note: z.string().trim().max(200).optional(),
});

export type SetPlanInput = z.input<typeof planSchema>;

/**
 * Control manual del plan de una tienda. Es la palanca para los amigos:
 * `comp` deja Pro sin vencimiento, y la nota queda guardada para que en seis
 * meses se sepa por qué esa tienda no paga.
 */
export async function setStorePlan(input: SetPlanInput): Promise<ActionResult> {
  try {
    await requireSuperAdminId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const parsed = planSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  const db = createAdminClient();

  let patch: Database["public"]["Tables"]["stores"]["Update"];
  if (d.action === "free") {
    patch = { plan: "free", plan_source: "free", plan_expires_at: null };
  } else if (d.action === "comp") {
    patch = { plan: "pro", plan_source: "comp", plan_expires_at: null };
  } else {
    const { data: store } = await db
      .from("stores")
      .select("plan_expires_at")
      .eq("id", d.storeId)
      .maybeSingle();
    patch = {
      plan: "pro",
      plan_source: "paid",
      plan_expires_at: extendExpiry(store?.plan_expires_at, d.months),
    };
  }
  if (d.note !== undefined) patch.plan_note = d.note || null;

  const { error } = await db.from("stores").update(patch).eq("id", d.storeId);
  if (error) return { ok: false, error: "No se pudo actualizar el plan" };

  revalidatePath("/super");
  revalidatePath("/super/suscripciones");
  return { ok: true };
}

/** URL firmada del comprobante (el bucket es privado). */
export async function getProofUrl(path: string): Promise<string | null> {
  try {
    await requireSuperAdminId();
  } catch {
    return null;
  }
  const db = createAdminClient();
  const { data } = await db.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}
