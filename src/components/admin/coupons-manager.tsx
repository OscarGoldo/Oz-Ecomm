"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createCoupon,
  deleteCoupon,
  setCouponActive,
  updateCoupon,
} from "@/app/(admin)/panel/descuentos/actions";
import type { Coupon, CouponType } from "@/types/database";

const TYPE_LABEL: Record<CouponType, string> = {
  percentage: "Porcentaje",
  fixed: "Monto fijo",
  free_shipping: "Envío gratis",
};

function summary(c: Coupon): string {
  if (c.type === "free_shipping") return "Envío gratis";
  if (c.type === "percentage") return `${Number(c.value)}% de descuento`;
  return `$${Number(c.value).toFixed(2)} de descuento`;
}

interface FormState {
  code: string;
  type: CouponType;
  value: string;
  min_cart: string;
  max_discount: string;
  usage_limit: string;
  expires_at: string;
  active: boolean;
}

function emptyForm(): FormState {
  return {
    code: "",
    type: "percentage",
    value: "",
    min_cart: "",
    max_discount: "",
    usage_limit: "",
    expires_at: "",
    active: true,
  };
}

function toForm(c: Coupon): FormState {
  return {
    code: c.code,
    type: c.type,
    value: c.type === "free_shipping" ? "" : String(c.value),
    min_cart: c.min_cart != null ? String(c.min_cart) : "",
    max_discount: c.max_discount != null ? String(c.max_discount) : "",
    usage_limit: c.usage_limit != null ? String(c.usage_limit) : "",
    expires_at: c.expires_at ? c.expires_at.slice(0, 10) : "",
    active: c.active,
  };
}

export function CouponsManager({ initial }: { initial: Coupon[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function save() {
    setSaving(true);
    const res =
      editingId === "new"
        ? await createCoupon({
            code: form.code,
            type: form.type,
            value: form.value || 0,
            min_cart: form.min_cart === "" ? null : form.min_cart,
            max_discount: form.max_discount === "" ? null : form.max_discount,
            usage_limit: form.usage_limit === "" ? null : form.usage_limit,
            expires_at: form.expires_at || null,
            active: form.active,
          })
        : await updateCoupon(editingId!, {
            code: form.code,
            type: form.type,
            value: form.value || 0,
            min_cart: form.min_cart === "" ? null : form.min_cart,
            max_discount: form.max_discount === "" ? null : form.max_discount,
            usage_limit: form.usage_limit === "" ? null : form.usage_limit,
            expires_at: form.expires_at || null,
            active: form.active,
          });
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Cupón guardado");
    setEditingId(null);
    router.refresh();
  }

  async function toggle(id: string, active: boolean) {
    const res = await setCouponActive(id, active);
    if (!res.ok) toast.error(res.error ?? "Error");
    router.refresh();
  }

  async function remove(id: string) {
    const res = await deleteCoupon(id);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Cupón eliminado");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {initial.length === 0 && editingId === null ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-10 text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Ticket className="size-6" />
          </span>
          <p className="font-medium">Sin cupones</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Creá códigos de descuento para tus clientes.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {initial.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Ticket className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono font-semibold">{c.code}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {summary(c)}
                  {c.usage_limit != null && ` · ${c.times_used}/${c.usage_limit} usos`}
                  {!c.active && " · inactivo"}
                </p>
              </div>
              <Switch checked={c.active} onCheckedChange={(v) => toggle(c.id, v)} aria-label="Activo" />
              <Button
                size="icon"
                variant="ghost"
                className="size-9"
                onClick={() => {
                  setForm(toForm(c));
                  setEditingId(c.id);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="size-9 text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar “{c.code}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Los clientes ya no podrán usar este cupón.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => remove(c.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}

      {editingId === null ? (
        <Button onClick={() => { setForm(emptyForm()); setEditingId("new"); }} variant="outline" className="w-full">
          <Plus /> Crear cupón
        </Button>
      ) : (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">Código *</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => set("code", e.target.value.toUpperCase())}
                  placeholder="ENEROPROMO"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de descuento</Label>
                <Select value={form.type} onValueChange={(v) => set("type", v as CouponType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">{TYPE_LABEL.percentage}</SelectItem>
                    <SelectItem value="fixed">{TYPE_LABEL.fixed}</SelectItem>
                    <SelectItem value="free_shipping">{TYPE_LABEL.free_shipping}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.type !== "free_shipping" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="value">
                    {form.type === "percentage" ? "Porcentaje (%)" : "Monto ($)"}
                  </Label>
                  <Input
                    id="value"
                    type="number"
                    min="0"
                    step={form.type === "percentage" ? "1" : "0.01"}
                    value={form.value}
                    onChange={(e) => set("value", e.target.value)}
                    placeholder="0"
                  />
                </div>
                {form.type === "percentage" && (
                  <div className="space-y-2">
                    <Label htmlFor="max_discount">Tope de descuento ($)</Label>
                    <Input
                      id="max_discount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.max_discount}
                      onChange={(e) => set("max_discount", e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="min_cart">Compra mínima ($)</Label>
                <Input
                  id="min_cart"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.min_cart}
                  onChange={(e) => set("min_cart", e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="usage_limit">Límite de usos</Label>
                <Input
                  id="usage_limit"
                  type="number"
                  min="1"
                  value={form.usage_limit}
                  onChange={(e) => set("usage_limit", e.target.value)}
                  placeholder="Ilimitado"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expires_at">Vence el</Label>
                <Input
                  id="expires_at"
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => set("expires_at", e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <p className="text-sm font-medium">Activo</p>
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setEditingId(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={save} disabled={saving || form.code.trim().length < 2}>
                {saving && <Loader2 className="animate-spin" />}
                Guardar cupón
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
