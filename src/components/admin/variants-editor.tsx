"use client";

import { useEffect } from "react";
import { Plus, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { cleanVariantOptions, variantCombos, variantKey, variantLabel } from "@/lib/variants";
import type { ProductVariant, VariantOption } from "@/types/database";

const MAX_AXES = 2;

export interface VariantRowDraft {
  key: string;
  values: string[];
  price: string;
  stock: string;
  active: boolean;
}

export interface VariantState {
  enabled: boolean;
  options: VariantOption[];
  rows: VariantRowDraft[];
}

export function initialVariantState(
  variantOptions: VariantOption[] | null | undefined,
  variants: ProductVariant[] | undefined,
): VariantState {
  const enabled = Boolean(variantOptions && variantOptions.length > 0);
  const rows: VariantRowDraft[] = (variants ?? []).map((v) => ({
    key: variantKey(v.option_values),
    values: v.option_values,
    price: v.price != null ? String(v.price) : "",
    stock: String(v.stock),
    active: v.active,
  }));
  return {
    enabled,
    options: enabled ? variantOptions! : [{ name: "", values: [] }],
    rows,
  };
}

/** Regenerate combo rows from the axes, preserving existing stock/price by key. */
function regenerateRows(
  options: VariantOption[],
  prev: VariantRowDraft[],
): VariantRowDraft[] {
  const prevByKey = new Map(prev.map((r) => [r.key, r]));
  return variantCombos(options).map((values) => {
    const key = variantKey(values);
    const existing = prevByKey.get(key);
    return (
      existing ?? { key, values, price: "", stock: "0", active: true }
    );
  });
}

export function VariantsEditor({
  value,
  onChange,
  basePrice,
}: {
  value: VariantState;
  onChange: (next: VariantState) => void;
  basePrice: string;
}) {
  const { enabled, options, rows } = value;

  // Keep generated rows in sync with the axes.
  useEffect(() => {
    if (!enabled) return;
    const next = regenerateRows(options, rows);
    const changed =
      next.length !== rows.length ||
      next.some((r, i) => r.key !== rows[i]?.key);
    if (changed) onChange({ ...value, rows: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, JSON.stringify(options)]);

  function setOptions(next: VariantOption[]) {
    onChange({ ...value, options: next });
  }

  function setAxisName(i: number, name: string) {
    setOptions(options.map((o, idx) => (idx === i ? { ...o, name } : o)));
  }

  function addAxisValue(i: number, raw: string) {
    const token = raw.trim();
    if (!token) return;
    setOptions(
      options.map((o, idx) =>
        idx === i && !o.values.includes(token)
          ? { ...o, values: [...o.values, token] }
          : o,
      ),
    );
  }

  function removeAxisValue(i: number, valIdx: number) {
    setOptions(
      options.map((o, idx) =>
        idx === i ? { ...o, values: o.values.filter((_, k) => k !== valIdx) } : o,
      ),
    );
  }

  function addAxis() {
    if (options.length >= MAX_AXES) return;
    setOptions([...options, { name: "", values: [] }]);
  }

  function removeAxis(i: number) {
    const next = options.filter((_, idx) => idx !== i);
    setOptions(next.length ? next : [{ name: "", values: [] }]);
  }

  function setRow(key: string, patch: Partial<VariantRowDraft>) {
    onChange({
      ...value,
      rows: rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    });
  }

  const cleanAxes = cleanVariantOptions(options);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Este producto tiene variantes</p>
          <p className="text-xs text-muted-foreground">
            Ej. Talla y/o Color. Cada combinación lleva su propio stock.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => onChange({ ...value, enabled: v })}
        />
      </div>

      {enabled && (
        <>
          {/* Axes */}
          <div className="space-y-3">
            {options.map((axis, i) => (
              <div key={i} className="space-y-2 rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={axis.name}
                    onChange={(e) => setAxisName(i, e.target.value)}
                    placeholder={i === 0 ? "Tipo (ej. Talla)" : "Tipo (ej. Color)"}
                    className="h-9"
                  />
                  {options.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAxis(i)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Quitar tipo"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {axis.values.map((v, valIdx) => (
                    <span
                      key={valIdx}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      {v}
                      <button
                        type="button"
                        onClick={() => removeAxisValue(i, valIdx)}
                        aria-label={`Quitar ${v}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  <ValueInput onAdd={(raw) => addAxisValue(i, raw)} />
                </div>
              </div>
            ))}

            {options.length < MAX_AXES && (
              <button
                type="button"
                onClick={addAxis}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <Plus className="size-4" /> Agregar otro tipo (ej. Color)
              </button>
            )}
          </div>

          {/* Generated combinations */}
          {rows.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  Combinaciones ({rows.length})
                </Label>
                <span className="text-xs text-muted-foreground">
                  Precio vacío = usa ${basePrice || "0"}
                </span>
              </div>
              <div className="overflow-hidden rounded-lg border">
                <div className="grid grid-cols-[1fr_5rem_6rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                  <span>Combinación</span>
                  <span>Stock</span>
                  <span>Precio</span>
                </div>
                <ul className="divide-y">
                  {rows.map((r) => (
                    <li
                      key={r.key}
                      className={cn(
                        "grid grid-cols-[1fr_5rem_6rem] items-center gap-2 px-3 py-2",
                        !r.active && "opacity-50",
                      )}
                    >
                      <span className="truncate text-sm font-medium">
                        {variantLabel(r.values)}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={r.stock}
                        onChange={(e) => setRow(r.key, { stock: e.target.value })}
                        className="h-8"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={r.price}
                        onChange={(e) => setRow(r.key, { price: e.target.value })}
                        placeholder={basePrice || "0.00"}
                        className="h-8"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            cleanAxes.length === 0 && (
              <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                Poné un nombre al tipo (ej. “Talla”) y agregá sus valores (S, M,
                L) para generar las combinaciones.
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}

/** Small input that emits a value on Enter / comma / blur. */
function ValueInput({ onAdd }: { onAdd: (raw: string) => void }) {
  return (
    <input
      type="text"
      placeholder="Agregar valor…"
      className="h-7 min-w-[7rem] flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          onAdd((e.target as HTMLInputElement).value);
          (e.target as HTMLInputElement).value = "";
        }
      }}
      onBlur={(e) => {
        if (e.target.value.trim()) {
          onAdd(e.target.value);
          e.target.value = "";
        }
      }}
    />
  );
}
