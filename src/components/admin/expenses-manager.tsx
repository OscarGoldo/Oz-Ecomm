"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { createExpense, deleteExpense } from "@/app/(admin)/panel/finanzas/actions";
import { formatUSD } from "@/lib/format";
import type { Expense } from "@/types/database";

const CATEGORIES = [
  "Inventario",
  "Sueldos",
  "Alquiler",
  "Servicios",
  "Publicidad",
  "Envíos",
  "Otros",
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function ExpensesManager({ initial }: { initial: Expense[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Otros");
  const [spentAt, setSpentAt] = useState(todayStr());

  async function add() {
    if (description.trim().length < 2 || !(Number(amount) > 0)) return;
    setSaving(true);
    const res = await createExpense({
      description,
      amount,
      category,
      spent_at: spentAt,
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Gasto registrado");
    setDescription("");
    setAmount("");
    setCategory("Otros");
    setSpentAt(todayStr());
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
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="exp-desc" className="text-xs">Descripción</Label>
              <Input
                id="exp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Compra de mercadería"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-amount" className="text-xs">Monto (USD)</Label>
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="exp-date" className="text-xs">Fecha</Label>
              <Input
                id="exp-date"
                type="date"
                value={spentAt}
                onChange={(e) => setSpentAt(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={add} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Registrar gasto
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
          <Plus /> Registrar gasto
        </Button>
      )}

      {initial.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card">
          {initial.map((e) => (
            <li key={e.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.description}</p>
                <p className="text-xs text-muted-foreground">
                  {e.category ? `${e.category} · ` : ""}
                  {format(new Date(e.spent_at), "d MMM yyyy", { locale: es })}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-destructive">
                −{formatUSD(Number(e.amount))}
              </span>
              <button
                type="button"
                onClick={() => remove(e.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
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
