"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createExpense,
  createRecurringExpense,
  deleteExpense,
} from "@/app/(admin)/panel/finanzas/actions";
import { formatUSD } from "@/lib/format";
import {
  addDays,
  duePayments,
  MAX_BACKFILL_DAYS,
  RECURRING_FREQUENCIES,
  scheduleLabel,
  shortDueLabel,
} from "@/lib/recurring-expenses";
import { caracasToday, shortDay } from "@/lib/report-period";
import { cn } from "@/lib/utils";
import type { Expense, RecurringFrequency } from "@/types/database";

export const CATEGORIES = [
  "Inventario",
  "Sueldos",
  "Alquiler",
  "Servicios",
  "Publicidad",
  "Envíos",
  "Otros",
];

type Kind = "once" | "repeat";

/**
 * Hoy en Caracas. Con `toISOString()` era el día de UTC: un gasto cargado a
 * las 9 de la noche quedaba con fecha de mañana.
 */
function todayStr() {
  return caracasToday();
}

/**
 * Registrar un gasto: una vez (la compra de mercadería) o uno que se repite
 * (el alquiler, los servicios), que después se registra solo cada vez que
 * toca. Debajo, los últimos gastos; los que se cargaron solos llevan la marca.
 */
export function ExpensesManager({
  initial,
  defaultOpen = false,
  defaultKind = "once",
}: {
  initial: Expense[];
  /** Llega abierto cuando se viene desde "Registrar gasto". */
  defaultOpen?: boolean;
  /** "repeat" cuando se viene desde "registra tus gastos fijos". */
  defaultKind?: Kind;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(defaultKind === "repeat" ? "Alquiler" : "Otros");
  const [spentAt, setSpentAt] = useState(todayStr());
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");

  const today = todayStr();
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(spentAt);
  // Los pagos que ya tocaron se registran apenas se guarda: se avisa antes.
  const pastDue =
    kind === "repeat" && validStart && spentAt <= today
      ? duePayments(spentAt, spentAt, frequency, today).dates
      : [];

  function resetForm() {
    setDescription("");
    setAmount("");
    setCategory("Otros");
    setSpentAt(todayStr());
    setFrequency("monthly");
    setKind("once");
  }

  async function add() {
    if (description.trim().length < 2) return toast.error("Pon una descripción");
    if (!(Number(amount) > 0)) return toast.error("Pon el monto");
    setSaving(true);
    if (kind === "once") {
      const res = await createExpense({ description, amount, category, spent_at: spentAt });
      setSaving(false);
      if (!res.ok) return toast.error(res.error ?? "Error");
      toast.success("Gasto registrado");
    } else {
      const res = await createRecurringExpense({
        description,
        amount,
        category,
        frequency,
        starts_on: spentAt,
      });
      setSaving(false);
      if (!res.ok) return toast.error(res.error ?? "Error");
      const n = res.registered ?? 0;
      toast.success("Gasto que se repite guardado", {
        description:
          n > 0
            ? `Ya se ${n === 1 ? "registró 1 pago" : `registraron ${n} pagos`}. Los próximos se registran solos.`
            : `El primer pago se registra solo el ${shortDueLabel(spentAt)}.`,
      });
    }
    resetForm();
    setOpen(false);
    router.refresh();
  }

  async function remove(id: string) {
    const res = await deleteExpense(id);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Gasto eliminado");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {open ? (
        <div className="space-y-4 rounded-2xl border bg-card shadow-sm p-4">
          <div role="radiogroup" aria-label="Cada cuánto" className="grid grid-cols-2 gap-1 rounded-xl border bg-ink-25 p-1">
            {(
              [
                { value: "once", label: "Una vez" },
                { value: "repeat", label: "Se repite" },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={kind === o.value}
                onClick={() => setKind(o.value)}
                className={cn(
                  "inline-flex h-10 items-center justify-center gap-1.5 rounded-[9px] text-sm font-semibold transition-colors",
                  kind === o.value ? "bg-card text-foreground shadow-sm" : "text-ink-600 hover:text-foreground",
                )}
              >
                {o.value === "repeat" && <Repeat className="size-3.5" />}
                {o.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="exp-desc" className="text-xs">Descripción</Label>
              <Input
                id="exp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={kind === "repeat" ? "Ej. Alquiler del local" : "Ej. Compra de mercadería"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-amount" className="text-xs">
                Monto (USD){kind === "repeat" && " de cada pago"}
              </Label>
              <Input
                id="exp-amount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {kind === "repeat" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Cada cuánto</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as RecurringFrequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECURRING_FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className={cn("space-y-1.5", kind === "once" && "sm:col-span-2")}>
              <Label htmlFor="exp-date" className="text-xs">
                {kind === "repeat" ? "Primer pago" : "Fecha"}
              </Label>
              <Input
                id="exp-date"
                type="date"
                value={spentAt}
                min={kind === "repeat" ? addDays(today, -MAX_BACKFILL_DAYS) : undefined}
                max={kind === "repeat" ? addDays(today, MAX_BACKFILL_DAYS) : undefined}
                onChange={(e) => setSpentAt(e.target.value)}
              />
            </div>
          </div>

          {kind === "repeat" && validStart && (
            <div className="space-y-1 rounded-xl bg-[#EEF0FB] px-3.5 py-3 text-[13px] leading-snug text-[#2F2580]">
              <p>
                Se registra solo {scheduleLabel(spentAt, frequency)}. Cuenta como gasto fijo y lo
                puedes pausar o borrar cuando quieras.
              </p>
              {pastDue.length > 0 && (
                <p className="font-semibold">
                  {pastDue.length === 1
                    ? pastDue[0] === today
                      ? "El primero toca hoy: se registra apenas guardes."
                      : `El del ${shortDueLabel(pastDue[0])} ya pasó: se registra apenas guardes.`
                    : `Ya tocaron ${pastDue.length} pagos, desde el ${shortDueLabel(pastDue[0])}: se registran apenas guardes.`}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={add} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {kind === "repeat" ? "Guardar gasto que se repite" : "Registrar gasto"}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
          <Plus /> Registrar gasto
        </Button>
      )}

      {initial.length > 0 && (
        <ul className="divide-y rounded-2xl border bg-card shadow-sm">
          {initial.map((e) => (
            <li key={e.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.description}</p>
                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  <span>
                    {e.category ? `${e.category} · ` : ""}
                    {/* `spent_at` es un día sin hora: con `new Date()` se leía
                        como medianoche UTC y en Caracas salía el día anterior. */}
                    {shortDay(e.spent_at)} {e.spent_at.slice(0, 4)}
                  </span>
                  {e.recurring_expense_id && (
                    <span className="inline-flex items-center gap-1 font-medium text-[#4B3BB8]">
                      <Repeat className="size-3" /> se repite
                    </span>
                  )}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-destructive">
                −{formatUSD(Number(e.amount))}
              </span>
              <button
                type="button"
                onClick={() => remove(e.id)}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:text-destructive"
                aria-label="Eliminar"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
