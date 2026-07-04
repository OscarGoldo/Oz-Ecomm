"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  createPaymentMethod,
  deletePaymentMethod,
  setPaymentMethodActive,
  updatePaymentMethod,
} from "@/app/(admin)/panel/configuracion/pagos/actions";
import {
  PAYMENT_METHOD_META,
  PAYMENT_TYPE_DEFAULT_PROOF,
  PAYMENT_TYPE_FIELDS,
  PAYOUT_METHODS,
  PAYOUT_METHOD_LABELS,
} from "@/lib/constants";
import type { PaymentMethod, PaymentMethodType } from "@/types/database";

const TYPES: PaymentMethodType[] = [
  "pago_movil",
  "zelle",
  "binance",
  "transfer",
  "cash",
  "paypal",
  "other",
];

interface FormState {
  type: PaymentMethodType;
  label: string;
  details: Record<string, string>;
  requires_proof: boolean;
  instructions: string;
}

function emptyForm(type: PaymentMethodType = "pago_movil"): FormState {
  return {
    type,
    label: PAYMENT_METHOD_META[type].label,
    details: {},
    requires_proof: PAYMENT_TYPE_DEFAULT_PROOF[type],
    instructions: "",
  };
}

function toForm(m: PaymentMethod): FormState {
  const details =
    m.details && typeof m.details === "object"
      ? (m.details as Record<string, string>)
      : {};
  return {
    type: m.type,
    label: m.label,
    details,
    requires_proof: m.requires_proof,
    instructions: m.instructions ?? "",
  };
}

export function PaymentMethodsManager({
  initial,
}: {
  initial: PaymentMethod[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  function openNew() {
    setForm(emptyForm());
    setEditingId("new");
  }
  function openEdit(m: PaymentMethod) {
    setForm(toForm(m));
    setEditingId(m.id);
  }
  function close() {
    setEditingId(null);
  }

  function changeType(type: PaymentMethodType) {
    setForm((f) => ({
      ...f,
      type,
      requires_proof: PAYMENT_TYPE_DEFAULT_PROOF[type],
      label:
        f.label && f.label !== PAYMENT_METHOD_META[f.type].label
          ? f.label
          : PAYMENT_METHOD_META[type].label,
    }));
  }

  async function save() {
    setSaving(true);
    // For PayPal, persist the payout method even if the dropdown was left on
    // its default (otherwise it's never written and the super admin sees it
    // as "not configured").
    const details =
      form.type === "paypal"
        ? { payout_method: form.details.payout_method || "zelle", ...form.details }
        : form.details;
    const input = {
      type: form.type,
      label: form.label,
      details,
      requires_proof: form.requires_proof,
      instructions: form.instructions || null,
    };
    const res =
      editingId === "new"
        ? await createPaymentMethod(input)
        : await updatePaymentMethod(editingId!, input);
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Método guardado");
    close();
    router.refresh();
  }

  async function toggle(id: string, active: boolean) {
    const res = await setPaymentMethodActive(id, active);
    if (!res.ok) toast.error(res.error ?? "Error");
    router.refresh();
  }

  async function remove(id: string) {
    const res = await deletePaymentMethod(id);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Método eliminado");
    router.refresh();
  }

  const fields = PAYMENT_TYPE_FIELDS[form.type];

  return (
    <div className="space-y-4">
      {/* List */}
      {initial.length === 0 && editingId === null ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-10 text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <CreditCard className="size-6" />
          </span>
          <p className="font-medium">Sin métodos de pago</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Agrega Pago Móvil, Zelle, Binance o efectivo.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {initial.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-xl border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.label}</p>
                <p className="text-xs text-muted-foreground">
                  {PAYMENT_METHOD_META[m.type].label}
                  {m.requires_proof ? " · pide comprobante" : " · sin comprobante"}
                  {!m.active && " · oculto"}
                </p>
              </div>
              <Switch
                checked={m.active}
                onCheckedChange={(v) => toggle(m.id, v)}
                aria-label="Activo"
              />
              <Button
                size="icon"
                variant="ghost"
                className="size-9"
                onClick={() => openEdit(m)}
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
                    <AlertDialogTitle>¿Eliminar “{m.label}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Los clientes ya no podrán elegir este método.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => remove(m.id)}
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
        <Button onClick={openNew} variant="outline" className="w-full">
          <Plus /> Agregar método de pago
        </Button>
      ) : (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => changeType(v as PaymentMethodType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {PAYMENT_METHOD_META[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pm-label">Nombre visible</Label>
                <Input
                  id="pm-label"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                />
              </div>
            </div>

            {fields.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={`pm-${field.key}`}>{field.label}</Label>
                    <Input
                      id={`pm-${field.key}`}
                      value={form.details[field.key] ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          details: { ...f.details, [field.key]: e.target.value },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {form.type === "paypal" && (
              <div className="space-y-4">
                <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  Los pagos con PayPal y tarjeta se procesan de forma segura a
                  través de la plataforma. El cliente paga el total online y el
                  pedido se confirma al instante. Aplican comisiones del
                  procesador de pago, que se descuentan de lo que recibís.
                </p>
                <div className="space-y-1">
                  <p className="text-sm font-medium">¿Cómo quieres que te paguemos?</p>
                  <p className="text-xs text-muted-foreground">
                    La plataforma te transfiere lo recaudado por PayPal por este
                    medio.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Método de cobro</Label>
                  <Select
                    value={form.details.payout_method ?? "zelle"}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        details: { ...f.details, payout_method: v },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYOUT_METHODS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PAYOUT_METHOD_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="po-holder">Titular</Label>
                    <Input
                      id="po-holder"
                      value={form.details.payout_holder ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          details: { ...f.details, payout_holder: e.target.value },
                        }))
                      }
                      placeholder="Nombre del titular"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="po-account">
                      {form.details.payout_method === "pago_movil"
                        ? "Teléfono / Cédula / Banco"
                        : form.details.payout_method === "binance"
                          ? "Email o ID de Binance"
                          : "Email de Zelle"}
                    </Label>
                    <Input
                      id="po-account"
                      value={form.details.payout_account ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          details: { ...f.details, payout_account: e.target.value },
                        }))
                      }
                      placeholder="Datos para recibir el pago"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pm-instructions">Instrucciones (opcional)</Label>
              <Textarea
                id="pm-instructions"
                rows={2}
                value={form.instructions}
                onChange={(e) =>
                  setForm((f) => ({ ...f, instructions: e.target.value }))
                }
                placeholder="Ej. Indicá el número de pedido en la referencia."
              />
            </div>

            {form.type !== "paypal" && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Pedir comprobante</p>
                  <p className="text-xs text-muted-foreground">
                    El cliente sube la foto del pago al finalizar.
                  </p>
                </div>
                <Switch
                  checked={form.requires_proof}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, requires_proof: v }))}
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close} type="button">
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving} type="button">
                {saving && <Loader2 className="animate-spin" />}
                Guardar método
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
