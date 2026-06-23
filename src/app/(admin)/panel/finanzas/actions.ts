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

const expenseSchema = z.object({
  description: z.string().trim().min(2, "Poné una descripción").max(160),
  amount: z.coerce.number().positive("Monto inválido"),
  category: z.string().trim().max(40).optional().nullable(),
  spent_at: z.string().trim().optional(),
});

export type ExpenseInput = z.input<typeof expenseSchema>;

export async function createExpense(input: ExpenseInput): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
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
  const { error } = await supabase.from("expenses").insert({
    store_id: storeId,
    description: parsed.data.description,
    amount: parsed.data.amount,
    category: parsed.data.category?.trim() || null,
    spent_at: parsed.data.spent_at || new Date().toISOString().slice(0, 10),
  });
  if (error) return { ok: false, error: "No se pudo registrar el gasto" };

  revalidatePath("/panel/finanzas");
  revalidatePath("/panel");
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("store_id", storeId);
  if (error) return { ok: false, error: "No se pudo eliminar" };

  revalidatePath("/panel/finanzas");
  return { ok: true };
}
