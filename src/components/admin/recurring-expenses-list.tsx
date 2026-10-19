"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Pencil, Play, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteRecurringExpense,
  setRecurringExpenseActive,
  updateRecurringExpense,
} from "@/app/(admin)/panel/finanzas/actions";
import { CATEGORIES } from "@/components/admin/expenses-manager";
import { formatUSD } from "@/lib/format";
import { monthlyEquivalent, scheduleLabel, shortDueLabel } from "@/lib/recurring-expenses";
import { cn } from "@/lib/utils";
import type { RecurringExpense } from "@/types/database";

/**
 * Los gastos que se repiten: cuánto, cada cuánto y cuándo toca el próximo.
 * Pausar deja de registrarlo; editar cambia los próximos pagos (los ya
 * registrados quedan como estaban); borrar lo saca de acá, pero lo ya
 * registrado sigue en los gastos.
 */
export function RecurringExpensesList({ items }: { items: RecurringExpense[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<RecurringExpense | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const monthly = items
    .filter((r) => r.active)
    .reduce((s, r) => s + monthlyEquivalent(Number(r.amount), r.frequency), 0);

  async function toggle(r: RecurringExpense) {
    setBusy(r.id);
    const res = await setRecurringExpenseActive(r.id, !r.active);
    setBusy(null);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success(r.active ? "En pausa: no se registra más hasta que lo reanudes" : "Reanudado");
    router.refresh();
  }

  async function remove(r: RecurringExpense) {
    setBusy(r.id);
    const res = await deleteRecurringExpense(r.id);
    setBusy(null);
    setDeleting(null);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Gasto que se repite borrado");
    router.refresh();
  }

  return (
    <div className="space-y-2.5">
      <ul className="divide-y rounded-2xl border bg-card shadow-sm">
        {items.map((r) =>
          editing === r.id ? (
            <li key={r.id} className="p-3">
              <EditRow
                item={r}
                onDone={(saved) => {
                  setEditing(null);
                  if (saved) router.refresh();
                }}
              />
            </li>
          ) : (
            <li key={r.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 p-3", !r.active && "bg-ink-25")}>
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full",
                  r.active ? "bg-[#EEF0FB] text-[#4B3BB8]" : "bg-ink-100 text-ink-500",
                )}
              >
                <Repeat className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.description}</p>
                <p className="text-xs text-muted-foreground">
                  {r.category ? `${r.category} · ` : ""}
                  {scheduleLabel(r.starts_on, r.frequency)}
                </p>
                <p className={cn("text-xs", r.active ? "text-ink-600" : "font-medium text-[#92400E]")}>
                  {r.active ? `Próximo: ${shortDueLabel(r.next_due_on)}` : "En pausa"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{formatUSD(Number(r.amount))}</p>
                {r.frequency !== "monthly" && (
                  <p className="text-[11.5px] text-muted-foreground tabular-nums">
                    ≈ {formatUSD(monthlyEquivalent(Number(r.amount), r.frequency))}/mes
                  </p>
                )}
              </div>
              <div className="flex w-full shrink-0 justify-end gap-1 sm:w-auto">
                <IconButton label="Editar" onClick={() => setEditing(r.id)} disabled={busy === r.id}>
                  <Pencil className="size-4" />
                </IconButton>
                <IconButton label={r.active ? "Pausar" : "Reanudar"} onClick={() => toggle(r)} disabled={busy === r.id}>
                  {busy === r.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : r.active ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                </IconButton>
                <IconButton label="Borrar" onClick={() => setDeleting(r)} disabled={busy === r.id} danger>
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            </li>
          ),
        )}
      </ul>
      {monthly > 0 && (
        <p className="px-1 text-[12.5px] text-ink-500">
          Suman <b className="tabular-nums text-foreground">{formatUSD(monthly)}</b> al mes. Cuentan como gastos
          fijos: los pagas vendas o no.
        </p>
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar “{deleting?.description}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de registrarse solo. Los pagos que ya se registraron quedan en tus gastos; si
              solo quieres frenarlo un tiempo, mejor ponlo en pausa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && remove(deleting)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-ink-25 disabled:opacity-50",
        danger ? "hover:text-destructive" : "hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EditRow({ item, onDone }: { item: RecurringExpense; onDone: (saved: boolean) => void }) {
  const [description, setDescription] = useState(item.description);
  const [amount, setAmount] = useState(String(item.amount));
  const [category, setCategory] = useState(item.category || "Otros");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await updateRecurringExpense(item.id, { description, amount, category });
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Guardado: vale para los próximos pagos");
    onDone(true);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_160px]">
        <div className="space-y-1.5">
          <Label htmlFor={`rec-desc-${item.id}`} className="text-xs">Descripción</Label>
          <Input id={`rec-desc-${item.id}`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`rec-amount-${item.id}`} className="text-xs">Monto (USD)</Label>
          <Input
            id={`rec-amount-${item.id}`}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
      </div>
      <p className="text-xs text-ink-500">
        El cambio vale para los próximos pagos; los ya registrados quedan como estaban. Para cambiar
        cada cuánto se repite, bórralo y créalo de nuevo.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={() => onDone(false)}>
          Cancelar
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />} Guardar
        </Button>
      </div>
    </div>
  );
}
