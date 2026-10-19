import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { duePayments } from "@/lib/recurring-expenses";
import type { Database, RecurringExpense } from "@/types/database";

/**
 * Registra en `expenses` los pagos que ya tocan de cada gasto que se repite y
 * mueve su próximo pago. Lo usan el cron diario (con service role, todas las
 * tiendas) y la acción de crear o reanudar uno (con la sesión del comerciante,
 * solo los suyos), así un alquiler que empezó el 1 aparece apenas se carga.
 *
 * No duplica: si dos pasadas se cruzan, el índice único (gasto, fecha) deja
 * la segunda en nada. Primero se registran los pagos y después se mueve el
 * próximo: si lo segundo falla, la próxima pasada lo vuelve a intentar sin
 * repetir nada.
 */
export async function registerDuePayments(
  db: SupabaseClient<Database>,
  rows: RecurringExpense[],
  today: string,
): Promise<{ registered: number; failed: number }> {
  let registered = 0;
  let failed = 0;
  for (const r of rows) {
    if (!r.active || r.next_due_on > today) continue;
    const { dates, next } = duePayments(r.starts_on, r.next_due_on, r.frequency, today);
    if (dates.length === 0) continue;

    const { error } = await db.from("expenses").upsert(
      dates.map((day) => ({
        store_id: r.store_id,
        description: r.description,
        category: r.category,
        amount: r.amount,
        spent_at: day,
        recurring_expense_id: r.id,
      })),
      { onConflict: "recurring_expense_id,spent_at", ignoreDuplicates: true },
    );
    if (error) {
      failed += 1;
      continue;
    }
    const { error: moveError } = await db
      .from("recurring_expenses")
      .update({ next_due_on: next })
      .eq("id", r.id);
    if (moveError) failed += 1;
    else registered += dates.length;
  }
  return { registered, failed };
}
