"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/auth";
import { grantReferralReward, rejectReferral } from "@/lib/referrals-server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function requireSuperAdmin(): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx || ctx.user.role !== "super_admin") throw new Error("No autorizado");
}

function revalidate() {
  revalidatePath("/super/referidos");
}

/**
 * Acreditar a mano un referido que quedó esperando: el que superó el tope
 * automático, o uno que quieres premiar igual.
 *
 * `grantReferralReward` reclama la fila antes de tocar el plan, así que dos
 * clics seguidos no suman dos veces.
 */
export async function approveReferral(referralId: string): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const granted = await grantReferralReward(referralId);
  revalidate();
  if (!granted) return { ok: false, error: "Ese referido ya fue resuelto" };
  return { ok: true };
}

/** Descartar un referido (granja de tiendas falsas, prueba interna, etc.). */
export async function discardReferral(
  referralId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const done = await rejectReferral(referralId, reason);
  revalidate();
  if (!done) return { ok: false, error: "Ese referido ya fue resuelto" };
  return { ok: true };
}
