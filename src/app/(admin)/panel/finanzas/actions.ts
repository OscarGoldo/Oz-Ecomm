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
  description: z.string().trim().min(2, "Pon una descripción").max(160),
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

// ── Payroll (nómina) ─────────────────────────────────────────────────────────

const employeeSchema = z.object({
  name: z.string().trim().min(2, "Pon un nombre").max(80),
  role: z.string().trim().max(60).optional().nullable(),
  amount: z.coerce.number().positive("Monto inválido"),
  currency: z.enum(["USD", "VES"]).default("USD"),
  frequency: z.enum(["weekly", "biweekly", "monthly"]).default("monthly"),
});

export type EmployeeInput = z.input<typeof employeeSchema>;

export async function createEmployee(input: EmployeeInput): Promise<ActionResult> {
  const parsed = employeeSchema.safeParse(input);
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
  const { error } = await supabase.from("employees").insert({
    store_id: storeId,
    name: parsed.data.name,
    role: parsed.data.role?.trim() || null,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    frequency: parsed.data.frequency,
  });
  if (error) return { ok: false, error: "No se pudo agregar el empleado" };

  revalidatePath("/panel/finanzas");
  return { ok: true };
}

export async function setEmployeeActive(
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
    .from("employees")
    .update({ active })
    .eq("id", id)
    .eq("store_id", storeId);
  if (error) return { ok: false, error: "No se pudo actualizar" };
  revalidatePath("/panel/finanzas");
  return { ok: true };
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id)
    .eq("store_id", storeId);
  if (error) return { ok: false, error: "No se pudo eliminar" };
  revalidatePath("/panel/finanzas");
  return { ok: true };
}
