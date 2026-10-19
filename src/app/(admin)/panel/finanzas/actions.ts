"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { addDays, firstDueFrom, MAX_BACKFILL_DAYS } from "@/lib/recurring-expenses";
import { registerDuePayments } from "@/lib/recurring-expenses-run";
import { caracasToday } from "@/lib/report-period";

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

  // "layout": el resumen y cada pestaña de Finanzas (gastos, reportes…).
  revalidatePath("/panel/finanzas", "layout");
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

  revalidatePath("/panel/finanzas", "layout");
  return { ok: true };
}

// ── Gastos que se repiten ───────────────────────────────────────────────────

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const recurringFields = {
  description: z.string().trim().min(2, "Pon una descripción").max(160),
  amount: z.coerce.number().positive("Monto inválido"),
  category: z.string().trim().max(40).optional().nullable(),
};

const recurringSchema = z.object({
  ...recurringFields,
  frequency: z.enum(["weekly", "biweekly", "monthly", "yearly"]),
  starts_on: z.string().trim().regex(DAY, "Fecha inválida"),
});

export type RecurringExpenseInput = z.input<typeof recurringSchema>;

const recurringUpdateSchema = z.object(recurringFields);

export type RecurringExpenseUpdate = z.input<typeof recurringUpdateSchema>;

/** La tabla no existe: la migración 0036 no corrió. */
function missingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

const NOT_READY = "Los gastos que se repiten todavía no están activos. Escríbenos y lo resolvemos.";

/**
 * Crea un gasto que se repite y registra de una vez los pagos que ya tocan:
 * si el alquiler empezó el 1 de agosto, quedan agosto, septiembre y octubre.
 */
export async function createRecurringExpense(
  input: RecurringExpenseInput,
): Promise<ActionResult & { registered?: number }> {
  const parsed = recurringSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const today = caracasToday();
  if (d.starts_on < addDays(today, -MAX_BACKFILL_DAYS)) {
    return { ok: false, error: "El primer pago puede ser de hasta un año atrás" };
  }
  if (d.starts_on > addDays(today, MAX_BACKFILL_DAYS)) {
    return { ok: false, error: "El primer pago tiene que ser dentro del próximo año" };
  }

  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("recurring_expenses")
    .insert({
      store_id: storeId,
      description: d.description,
      amount: d.amount,
      category: d.category?.trim() || null,
      frequency: d.frequency,
      starts_on: d.starts_on,
      next_due_on: d.starts_on,
    })
    .select("*")
    .single();
  if (error || !row) {
    return { ok: false, error: missingTable(error) ? NOT_READY : "No se pudo guardar el gasto" };
  }

  const { registered } = await registerDuePayments(supabase, [row], today);

  revalidatePath("/panel/finanzas", "layout");
  revalidatePath("/panel");
  return { ok: true, registered };
}

/** Lo nuevo vale de acá en adelante: los pagos ya registrados no se tocan. */
export async function updateRecurringExpense(
  id: string,
  input: RecurringExpenseUpdate,
): Promise<ActionResult> {
  const parsed = recurringUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }
  const { error } = await createClient()
    .from("recurring_expenses")
    .update({
      description: parsed.data.description,
      amount: parsed.data.amount,
      category: parsed.data.category?.trim() || null,
    })
    .eq("id", id)
    .eq("store_id", storeId);
  if (error) return { ok: false, error: "No se pudo guardar" };
  revalidatePath("/panel/finanzas", "layout");
  return { ok: true };
}

/**
 * Pausar deja de registrarlo; reanudar sigue desde el próximo pago que toque
 * a partir de hoy, sin cobrar lo que pasó durante la pausa.
 */
export async function setRecurringExpenseActive(
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
  const { data: row } = await supabase
    .from("recurring_expenses")
    .select("*")
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!row) return { ok: false, error: "No se encontró el gasto" };

  const today = caracasToday();
  const next_due_on = active ? firstDueFrom(row, today) : row.next_due_on;
  const { error } = await supabase
    .from("recurring_expenses")
    .update({ active, next_due_on })
    .eq("id", id)
    .eq("store_id", storeId);
  if (error) return { ok: false, error: "No se pudo actualizar" };
  if (active) await registerDuePayments(supabase, [{ ...row, active, next_due_on }], today);

  revalidatePath("/panel/finanzas", "layout");
  return { ok: true };
}

/** Los pagos ya registrados quedan como gastos normales (ON DELETE SET NULL). */
export async function deleteRecurringExpense(id: string): Promise<ActionResult> {
  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }
  const { error } = await createClient()
    .from("recurring_expenses")
    .delete()
    .eq("id", id)
    .eq("store_id", storeId);
  if (error) return { ok: false, error: "No se pudo eliminar" };
  revalidatePath("/panel/finanzas", "layout");
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

  revalidatePath("/panel/finanzas", "layout");
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
  revalidatePath("/panel/finanzas", "layout");
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
  revalidatePath("/panel/finanzas", "layout");
  return { ok: true };
}
