"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function requireStoreId(): Promise<string> {
  const ctx = await getSessionContext();
  if (!ctx?.store) throw new Error("No autorizado");
  return ctx.store.id;
}

const methodSchema = z.object({
  type: z.enum(["pago_movil", "zelle", "binance", "cash", "transfer", "other"]),
  label: z.string().trim().min(2, "Poné un nombre"),
  details: z.record(z.string(), z.string().trim()).default({}),
  requires_proof: z.boolean().default(true),
  instructions: z.string().trim().optional().nullable(),
});

export type PaymentMethodInput = z.input<typeof methodSchema>;

function cleanDetails(details: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(details).filter(([, v]) => v && v.trim().length > 0),
  );
}

export async function createPaymentMethod(
  input: PaymentMethodInput,
): Promise<ActionResult> {
  const parsed = methodSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createClient();
  const { data: last } = await supabase
    .from("payment_methods")
    .select("display_order")
    .eq("store_id", storeId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("payment_methods").insert({
    store_id: storeId,
    type: parsed.data.type,
    label: parsed.data.label,
    details: cleanDetails(parsed.data.details),
    requires_proof: parsed.data.requires_proof,
    instructions: parsed.data.instructions?.trim() || null,
    display_order: (last?.display_order ?? -1) + 1,
  });
  if (error) return { ok: false, error: "No se pudo crear el método" };

  revalidatePath("/panel/configuracion/pagos");
  return { ok: true };
}

export async function updatePaymentMethod(
  id: string,
  input: PaymentMethodInput,
): Promise<ActionResult> {
  const parsed = methodSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("payment_methods")
    .update({
      type: parsed.data.type,
      label: parsed.data.label,
      details: cleanDetails(parsed.data.details),
      requires_proof: parsed.data.requires_proof,
      instructions: parsed.data.instructions?.trim() || null,
    })
    .eq("id", id)
    .eq("store_id", storeId);
  if (error) return { ok: false, error: "No se pudo guardar el método" };

  revalidatePath("/panel/configuracion/pagos");
  return { ok: true };
}

export async function setPaymentMethodActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("payment_methods")
    .update({ active })
    .eq("id", id)
    .eq("store_id", storeId);
  if (error) return { ok: false, error: "No se pudo actualizar" };
  revalidatePath("/panel/configuracion/pagos");
  return { ok: true };
}

export async function deletePaymentMethod(id: string): Promise<ActionResult> {
  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("payment_methods")
    .delete()
    .eq("id", id)
    .eq("store_id", storeId);
  if (error) return { ok: false, error: "No se pudo eliminar" };
  revalidatePath("/panel/configuracion/pagos");
  return { ok: true };
}
