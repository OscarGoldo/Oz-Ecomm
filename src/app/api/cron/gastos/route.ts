import { NextResponse, type NextRequest } from "next/server";

import { caracasToday } from "@/lib/report-period";
import { registerDuePayments } from "@/lib/recurring-expenses-run";
import { reportError } from "@/lib/report-error";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RecurringExpense } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Todos los días a las 12:15 a. m. de Caracas (vercel.json): registra en
 * `expenses` los pagos de los gastos que se repiten cuya fecha ya llegó (el
 * alquiler del 1, la quincena del 15…). Si un día no corrió, el siguiente se
 * pone al día con todo lo que quedó atrás. Ver lib/recurring-expenses.ts.
 *
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const today = caracasToday();
  const db = createAdminClient();
  const { data, error } = await db
    .from("recurring_expenses")
    .select("*")
    .eq("active", true)
    .lte("next_due_on", today);
  if (error) {
    // Sin la migración 0036 la tabla no existe: no hay nada que registrar.
    if (error.code === "42P01" || error.code === "PGRST205") {
      return NextResponse.json({ ok: true, registered: 0, skipped: "sin migración 0036" });
    }
    reportError("cron/gastos", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const result = await registerDuePayments(db, (data ?? []) as RecurringExpense[], today);
  if (result.failed > 0) {
    reportError("cron/gastos", new Error(`${result.failed} gastos que se repiten no se pudieron registrar`), {
      today,
    });
  }
  return NextResponse.json({ ok: result.failed === 0, today, ...result });
}
