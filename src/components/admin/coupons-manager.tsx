"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Loader2, Pencil, Plus, RefreshCw, Ticket, Trash2, Truck, X } from "lucide-react";
import { toast } from "sonner";

import {
  createCoupon,
  deleteCoupon,
  setCouponActive,
  updateCoupon,
} from "@/app/(admin)/panel/descuentos/actions";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { COUPON_STATUS, COUPON_TYPE_TONE, couponFace, type CouponStatus } from "@/lib/coupon-status";
import { formatUSD } from "@/lib/format";
import { caracasToday } from "@/lib/report-period";
import { cn } from "@/lib/utils";
import type { Coupon, CouponType } from "@/types/database";

/**
 * Los cupones como tickets: el talón dice cuánto regala, el cuerpo el código,
 * en qué está y lo que vendió. El formulario va al lado en escritorio y a
 * pantalla completa en el teléfono, con la vista previa del ticket arriba.
 */

export type CouponRow = Coupon & { status: CouponStatus; sales: number; revenueUsd: number };

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const TYPES: { id: CouponType; title: string; sub: string }[] = [
  { id: "percentage", title: "Porcentaje", sub: "Ej. 15% menos" },
  { id: "fixed", title: "Monto fijo", sub: "Ej. $5 menos" },
  { id: "free_shipping", title: "Envío gratis", sub: "El delivery va por ti" },
];

const QUICK: Record<"percentage" | "fixed", string[]> = {
  percentage: ["10", "15", "20", "25"],
  fixed: ["3", "5", "10", "20"],
};

/** Sin letras que se confunden al dictarlas (O/0, I/1). */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** "31 de octubre", el día de Caracas de una fecha guardada. */
function dayLabel(iso: string): string {
  const [, m, d] = caracasToday(new Date(iso)).split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
}

function money(n: number | string): string {
  const v = Number(n);
  return Number.isInteger(v) ? `$${v}` : formatUSD(v);
}

/** Las condiciones del cupón en una línea. */
function conditions(c: CouponRow): string {
  const parts: string[] = [];
  parts.push(c.min_cart != null && Number(c.min_cart) > 0 ? `Compra mínima ${money(c.min_cart)}` : "Sin compra mínima");
  if (c.type === "percentage" && c.max_discount != null) parts.push(`hasta ${money(c.max_discount)}`);
  if (c.status === "scheduled" && c.starts_at) parts.push(`desde el ${dayLabel(c.starts_at)}`);
  if (c.expires_at) parts.push(`${c.status === "expired" ? "venció" : "vence"} el ${dayLabel(c.expires_at)}`);
  else if (c.status !== "scheduled") parts.push("sin vencimiento");
  return parts.join(" · ");
}

interface FormState {
  code: string;
  type: CouponType;
  value: string;
  min_cart: string;
  max_discount: string;
  usage_limit: string;
  starts_at: string;
  expires_at: string;
  active: boolean;
}

function emptyForm(): FormState {
  return {
    code: "",
    type: "percentage",
    value: "10",
    min_cart: "",
    max_discount: "",
    usage_limit: "",
    starts_at: "",
    expires_at: "",
    active: true,
  };
}

function toForm(c: Coupon): FormState {
  return {
    code: c.code,
    type: c.type,
    value: c.type === "free_shipping" ? "" : String(Number(c.value)),
    min_cart: c.min_cart != null ? String(c.min_cart) : "",
    max_discount: c.max_discount != null ? String(c.max_discount) : "",
    usage_limit: c.usage_limit != null ? String(c.usage_limit) : "",
    starts_at: c.starts_at ? caracasToday(new Date(c.starts_at)) : "",
    expires_at: c.expires_at ? caracasToday(new Date(c.expires_at)) : "",
    active: c.active,
  };
}

/** Un código propio de la tienda: "LUMI-7K2Q". */
function randomCode(storeName: string): string {
  const word =
    storeName
      .normalize("NFD")
      .replace(/[^\p{L}\s]/gu, "")
      .split(/\s+/)
      .find((w) => w.length >= 3) ?? "PROMO";
  const prefix = word.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "PROMO";
  const tail = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  return `${prefix}-${tail}`;
}

// ── Ticket ──────────────────────────────────────────────────────────────────

/** El talón: lo que regala el cupón, con el color de su tipo. */
function Stub({ type, value, size = "md" }: { type: CouponType; value: number | string; size?: "sm" | "md" }) {
  const face = couponFace(type, value);
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-l-[15px] border-r-2 border-dashed border-white px-2 py-3 text-center",
        size === "md" ? "w-[92px] sm:w-[118px]" : "w-[100px]",
        COUPON_TYPE_TONE[type],
      )}
    >
      <span
        className={cn(
          "font-display font-extrabold leading-none tracking-[-0.03em] [font-stretch:85%]",
          size === "md" ? "text-[1.55rem] sm:text-[1.9rem]" : "text-[1.6rem]",
        )}
      >
        {face.big}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-[0.05em] sm:text-[10.5px]">{face.small}</span>
    </div>
  );
}

/** Las dos mordidas del ticket, donde termina el talón. */
function Notches({ left }: { left: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn("absolute -top-2 z-[1] size-4 rounded-full border bg-surface [clip-path:inset(50%_0_0_0)]", left)}
      />
      <span
        aria-hidden="true"
        className={cn("absolute -bottom-2 z-[1] size-4 rounded-full border bg-surface [clip-path:inset(0_0_50%_0)]", left)}
      />
    </>
  );
}

function CouponTicket({
  c,
  onEdit,
  onToggle,
  onDelete,
}: {
  c: CouponRow;
  onEdit: () => void;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
}) {
  const status = COUPON_STATUS[c.status];
  const off = c.status === "expired" || c.status === "used_up";
  const usedPct = c.usage_limit ? Math.min(100, (c.times_used / c.usage_limit) * 100) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(c.code);
      toast.success(`Copiaste ${c.code}`);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <article className="relative flex rounded-2xl border bg-card">
      <Notches left="left-[84px] sm:left-[110px]" />
      <div className={cn("flex min-w-0 flex-1", off && "opacity-60")}>
        <Stub type={c.type} value={c.value} />
        <div className="flex min-w-0 flex-1 flex-col gap-2 py-3 pl-4 pr-2 sm:py-3.5 sm:pl-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-landing-mono text-[15px] font-semibold tracking-[0.04em] sm:text-[17px]">
              {c.code}
            </span>
            <button
              type="button"
              onClick={copy}
              aria-label={`Copiar ${c.code}`}
              title="Copiar"
              className="grid size-7 place-items-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-foreground"
            >
              <Copy className="size-3.5" />
            </button>
            <span
              className={cn(
                "inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-xs font-bold",
                status.className,
              )}
            >
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
              {status.label}
            </span>
          </div>
          <p className="text-[13px] leading-snug text-ink-600">{conditions(c)}</p>
          <div className="flex items-center gap-2.5 text-[12.5px] text-ink-500">
            {usedPct !== null && (
              <span className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-ink-100">
                <span
                  className={cn("block h-full rounded-full", usedPct >= 100 ? "bg-[#eb6834]" : "bg-brand-600")}
                  style={{ width: `${Math.max(2, usedPct)}%` }}
                />
              </span>
            )}
            <span className="shrink-0">
              {c.usage_limit ? `${c.times_used} de ${c.usage_limit} usos` : `${c.times_used} ${c.times_used === 1 ? "uso" : "usos"} · sin límite`}
            </span>
          </div>
          <p className="text-[12.5px] text-ink-500">
            {c.sales > 0
              ? `${c.sales} ${c.sales === 1 ? "venta" : "ventas"} · ${formatUSD(c.revenueUsd)} vendidos con este código`
              : c.status === "scheduled" && c.starts_at
                ? `Empieza el ${dayLabel(c.starts_at)}`
                : "Sin ventas todavía"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between gap-2 py-3 pr-3">
        <Switch checked={c.active} onCheckedChange={onToggle} aria-label={c.active ? "Pausar el cupón" : "Activar el cupón"} />
        <div className="flex">
          <Button type="button" size="icon" variant="ghost" className="size-9" onClick={onEdit} aria-label={`Editar ${c.code}`}>
            <Pencil className="size-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="size-9 text-ink-500 hover:text-destructive" aria-label={`Eliminar ${c.code}`}>
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar “{c.code}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  Los clientes ya no podrán usarlo. Si solo quieres frenarlo un tiempo, mejor páusalo con el
                  interruptor: así no pierdes lo que vendió.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </article>
  );
}

// ── Lista y formulario ──────────────────────────────────────────────────────

export function CouponsManager({ initial, storeName }: { initial: CouponRow[]; storeName: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  // En pantallas grandes el formulario está siempre al lado. En las medianas
  // se abre como panel desde la derecha y en el teléfono a pantalla completa,
  // solo cuando se pide: al lado de la lista no entra sin apretar los tickets.
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || window.matchMedia("(min-width: 1280px)").matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function startNew() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function startEdit(c: CouponRow) {
    setEditing(c);
    setForm(toForm(c));
    setOpen(true);
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function close() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(false);
  }

  function pickType(type: CouponType) {
    setForm((f) => ({
      ...f,
      type,
      value: type === "free_shipping" ? "" : f.type === type ? f.value : type === "fixed" ? "5" : "10",
    }));
  }

  const needsValue = form.type !== "free_shipping";
  const canSave = form.code.trim().length >= 2 && (!needsValue || Number(form.value) > 0);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const input = {
      code: form.code,
      type: form.type,
      value: form.value || 0,
      min_cart: form.min_cart === "" ? null : form.min_cart,
      max_discount: form.max_discount === "" ? null : form.max_discount,
      usage_limit: form.usage_limit === "" ? null : form.usage_limit,
      starts_at: form.starts_at || null,
      expires_at: form.expires_at || null,
      active: form.active,
    };
    const res = editing ? await updateCoupon(editing.id, input) : await createCoupon(input);
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "No se pudo guardar");
    toast.success(editing ? "Cupón guardado" : `Cupón ${form.code} creado`);
    close();
    router.refresh();
  }

  async function toggle(id: string, active: boolean) {
    const res = await setCouponActive(id, active);
    if (!res.ok) toast.error(res.error ?? "No se pudo actualizar");
    router.refresh();
  }

  async function remove(id: string) {
    const res = await deleteCoupon(id);
    if (!res.ok) return toast.error(res.error ?? "No se pudo eliminar");
    toast.success("Cupón eliminado");
    if (editing?.id === id) close();
    router.refresh();
  }

  const preview = form.code.trim() || "TUCODIGO";

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
      <section aria-labelledby="tus-cupones" className="flex min-w-0 flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="tus-cupones" className="font-display text-lg font-bold tracking-[-0.02em]">
            Tus cupones
          </h2>
          <Button type="button" onClick={startNew} className="xl:hidden">
            <Plus /> Nuevo cupón
          </Button>
        </div>
        {initial.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-10 text-center">
            <span className="mb-3 grid size-12 place-items-center rounded-full bg-brand-100 text-brand-700">
              <Ticket className="size-6" />
            </span>
            <p className="font-semibold">Todavía no tienes cupones</p>
            <p className="mt-1 max-w-sm text-sm text-ink-500">
              Crea el primero: un 10% de bienvenida para quien te escribe por primera vez es un buen comienzo.
            </p>
          </div>
        ) : (
          initial.map((c) => (
            <CouponTicket
              key={c.id}
              c={c}
              onEdit={() => startEdit(c)}
              onToggle={(v) => toggle(c.id, v)}
              onDelete={() => remove(c.id)}
            />
          ))
        )}
      </section>

      {open && (
        <div
          aria-hidden="true"
          onClick={close}
          className="fixed inset-0 z-40 hidden bg-ink-950/40 md:block xl:hidden"
        />
      )}
      <div
        ref={panelRef}
        className={cn(
          "xl:sticky xl:top-24 xl:block",
          open
            ? "fixed inset-0 z-50 overflow-y-auto bg-surface md:left-auto md:w-[440px] md:border-l md:shadow-pop xl:static xl:inset-auto xl:z-auto xl:w-auto xl:overflow-visible xl:border-0 xl:bg-transparent xl:shadow-none"
            : "hidden",
        )}
      >
        {/* Teléfono y pantallas medianas: barra con volver, como una pantalla propia. */}
        <div className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-card px-3 xl:hidden">
          <Button type="button" variant="ghost" size="icon" className="size-11" onClick={close} aria-label="Volver a tus cupones">
            <ArrowLeft className="size-5" />
          </Button>
          <p className="font-display text-lg font-extrabold tracking-[-0.015em]">{editing ? "Editar cupón" : "Nuevo cupón"}</p>
        </div>

        <section
          aria-labelledby="form-cupon"
          className="flex flex-col gap-5 p-4 pb-0 xl:rounded-2xl xl:border xl:bg-card xl:p-6"
        >
          <div className="hidden items-center justify-between gap-3 xl:flex">
            <h2 id="form-cupon" className="font-display text-lg font-bold tracking-[-0.02em]">
              {editing ? `Editar ${editing.code}` : "Nuevo cupón"}
            </h2>
            {editing && (
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                <X /> Cancelar
              </Button>
            )}
          </div>

          <div>
            <p className="mb-2 font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
              Así lo verá tu cliente
            </p>
            <div className="relative flex min-h-[92px] rounded-2xl border bg-card">
              <Notches left="left-[92px]" />
              <Stub type={form.type} value={form.value} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3">
                <span className="truncate font-landing-mono text-base font-semibold tracking-[0.04em]">{preview}</span>
                <span className="text-[12.5px] text-ink-600">
                  {form.type === "free_shipping" ? "Envío gratis en su pedido" : "Se descuenta del total al pagar"}
                </span>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="coupon-code" className="mb-1.5 block">
              Código
            </Label>
            <div className="flex gap-2">
              <Input
                id="coupon-code"
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s+/g, ""))}
                placeholder="VERANO15"
                autoComplete="off"
                maxLength={40}
                className="h-11 font-landing-mono font-semibold uppercase tracking-[0.05em]"
              />
              <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => set("code", randomCode(storeName))}>
                <RefreshCw /> Generar
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-ink-500">Corto y fácil de dictar por WhatsApp. Sin espacios.</p>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">Qué regala</p>
            <div role="group" aria-label="Tipo de descuento" className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => {
                const on = form.type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pickType(t.id)}
                    className={cn(
                      "flex min-h-[88px] flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-colors sm:items-start sm:text-left",
                      on
                        ? "border-brand-600 bg-brand-50 shadow-[inset_0_0_0_1px_hsl(var(--brand-600))]"
                        : "bg-card hover:border-ink-300",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn("grid size-8 place-items-center rounded-[9px] font-landing-mono text-[15px] font-bold", COUPON_TYPE_TONE[t.id])}
                    >
                      {t.id === "percentage" ? "%" : t.id === "fixed" ? "$" : <Truck className="size-4" />}
                    </span>
                    <span className="text-[13px] font-bold leading-tight">{t.title}</span>
                    <span className="hidden text-xs leading-snug text-ink-500 sm:block">{t.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {needsValue && (
            <div>
              <Label htmlFor="coupon-value" className="mb-1.5 block">
                {form.type === "percentage" ? "Cuánto descuenta" : "Cuántos dólares descuenta"}
              </Label>
              <div className="relative">
                {form.type === "fixed" && (
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-landing-mono font-semibold text-ink-500">
                    $
                  </span>
                )}
                <Input
                  id="coupon-value"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step={form.type === "percentage" ? "1" : "0.01"}
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                  className={cn("h-11 font-landing-mono text-base", form.type === "fixed" ? "pl-7" : "pr-9")}
                />
                {form.type === "percentage" && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-landing-mono font-semibold text-ink-500">
                    %
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap">
                {QUICK[form.type === "fixed" ? "fixed" : "percentage"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set("value", v)}
                    className={cn(
                      "h-10 rounded-full border px-3 font-landing-mono text-[13px] transition-colors sm:h-8",
                      form.value === v ? "border-noche bg-noche text-white" : "bg-card hover:border-brand-600 hover:text-brand-700",
                    )}
                  >
                    {form.type === "fixed" ? `$${v}` : `${v}%`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3.5 border-t pt-4">
            <p className="flex items-baseline justify-between text-sm font-bold">
              Condiciones <span className="text-xs font-medium text-ink-500">opcionales</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field id="coupon-min" label="Compra mínima" prefix="$">
                <Input
                  id="coupon-min"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.min_cart}
                  onChange={(e) => set("min_cart", e.target.value)}
                  placeholder="Sin mínimo"
                  className="h-11 pl-7 font-landing-mono"
                />
              </Field>
              {form.type === "percentage" ? (
                <Field id="coupon-cap" label="Descuento máximo" prefix="$">
                  <Input
                    id="coupon-cap"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form.max_discount}
                    onChange={(e) => set("max_discount", e.target.value)}
                    placeholder="Sin tope"
                    className="h-11 pl-7 font-landing-mono"
                  />
                </Field>
              ) : (
                <Field id="coupon-uses" label="Cuántas veces se usa">
                  <Input
                    id="coupon-uses"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={form.usage_limit}
                    onChange={(e) => set("usage_limit", e.target.value)}
                    placeholder="Sin límite"
                    className="h-11 font-landing-mono"
                  />
                </Field>
              )}
              {form.type === "percentage" && (
                <Field id="coupon-uses" label="Cuántas veces se usa" wide>
                  <Input
                    id="coupon-uses"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={form.usage_limit}
                    onChange={(e) => set("usage_limit", e.target.value)}
                    placeholder="Sin límite"
                    className="h-11 font-landing-mono"
                  />
                </Field>
              )}
              <Field id="coupon-start" label="Empieza el">
                <Input
                  id="coupon-start"
                  type="date"
                  value={form.starts_at}
                  onChange={(e) => set("starts_at", e.target.value)}
                  className="h-11"
                />
              </Field>
              <Field id="coupon-end" label="Vence el">
                <Input
                  id="coupon-end"
                  type="date"
                  min={form.starts_at || undefined}
                  value={form.expires_at}
                  onChange={(e) => set("expires_at", e.target.value)}
                  className="h-11"
                />
              </Field>
            </div>
            <p className="text-xs text-ink-500">
              Sin fechas, el cupón sirve desde ahora y no vence. El día de vencimiento cuenta completo.
            </p>
          </div>

          {/* Fuera de pantallas grandes, guardar queda siempre a mano abajo. */}
          <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t bg-card px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 xl:static xl:mx-0 xl:border-0 xl:bg-transparent xl:p-0">
            <label className="flex shrink-0 items-center gap-2 text-sm font-semibold">
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
              Activo
            </label>
            <Button type="button" onClick={save} disabled={saving || !canSave} className="h-11 flex-1 xl:ml-auto xl:flex-none">
              {saving && <Loader2 className="animate-spin" />}
              {editing ? "Guardar cambios" : "Crear cupón"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  prefix,
  wide,
  children,
}: {
  id: string;
  label: string;
  prefix?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <Label htmlFor={id} className="mb-1.5 block text-[13px]">
        {label}
      </Label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-landing-mono text-sm font-semibold text-ink-500">
            {prefix}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}
