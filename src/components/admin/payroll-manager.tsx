"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createEmployee,
  deleteEmployee,
  setEmployeeActive,
} from "@/app/(admin)/panel/finanzas/actions";
import { formatBs, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Employee, PayCurrency, PayFrequency } from "@/types/database";

const FREQ_LABEL: Record<PayFrequency, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
};

/** Small "≈ other currency" hint for a salary. */
function converted(
  amount: number,
  currency: PayCurrency,
  rate: number | null,
): string | null {
  if (!rate || rate <= 0) return null;
  return currency === "USD"
    ? `≈ ${formatBs(amount * rate)}`
    : `≈ ${formatUSD(amount / rate)}`;
}

export function PayrollManager({
  initial,
  exchangeRate,
}: {
  initial: Employee[];
  exchangeRate: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<PayCurrency>("USD");
  const [frequency, setFrequency] = useState<PayFrequency>("monthly");

  async function add() {
    if (name.trim().length < 2 || !(Number(amount) > 0)) return;
    setSaving(true);
    const res = await createEmployee({ name, role, amount, currency, frequency });
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Empleado agregado");
    setName("");
    setRole("");
    setAmount("");
    setCurrency("USD");
    setFrequency("monthly");
    setOpen(false);
    router.refresh();
  }

  async function toggle(id: string, active: boolean) {
    const res = await setEmployeeActive(id, active);
    if (!res.ok) toast.error(res.error ?? "Error");
    router.refresh();
  }

  async function remove(id: string) {
    const res = await deleteEmployee(id);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Empleado eliminado");
    router.refresh();
  }

  // Live preview of the conversion while typing.
  const amountNum = Number(amount);
  const livePreview =
    amountNum > 0 ? converted(amountNum, currency, exchangeRate) : null;

  return (
    <div className="space-y-3">
      {open ? (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="emp-name" className="text-xs">Nombre</Label>
              <Input id="emp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Juan Pérez" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-role" className="text-xs">Cargo (opcional)</Label>
              <Input id="emp-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ej. Vendedor" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-amount" className="text-xs">Sueldo</Label>
              <Input
                id="emp-amount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              {livePreview && (
                <p className="text-[11px] text-muted-foreground">{livePreview}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Moneda</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as PayCurrency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="VES">Bs (VES)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Frecuencia</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as PayFrequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="biweekly">Quincenal</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={add} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Agregar empleado
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
          <Plus /> Agregar empleado
        </Button>
      )}

      {initial.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
          <Users className="mb-2 size-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Sin empleados. Agregá tu nómina si tenés personal.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {initial.map((e) => {
            const conv = converted(Number(e.amount), e.currency, exchangeRate);
            return (
              <li
                key={e.id}
                className={cn("flex items-center gap-3 p-3", !e.active && "opacity-60")}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.role ? `${e.role} · ` : ""}
                    {FREQ_LABEL[e.frequency]}
                    {!e.active && " · inactivo"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">
                    {e.currency === "USD" ? formatUSD(Number(e.amount)) : formatBs(Number(e.amount))}
                  </p>
                  {conv && <p className="text-[11px] text-muted-foreground">{conv}</p>}
                </div>
                <Switch checked={e.active} onCheckedChange={(v) => toggle(e.id, v)} aria-label="Activo" />
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Eliminar"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
