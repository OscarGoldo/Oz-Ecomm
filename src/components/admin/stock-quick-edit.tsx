"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { setProductStock } from "@/app/(admin)/panel/productos/actions";
import { cn } from "@/lib/utils";

/**
 * -/+ de stock en la fila del listado.
 *
 * Optimista: el número cambia al toque y se guarda con retardo, así ajustar de
 * 12 a 8 es cuatro toques y una sola escritura. Si el guardado falla, vuelve al
 * valor real y lo dice.
 */
export function StockQuickEdit({
  productId,
  stock,
  lowThreshold,
}: {
  productId: string;
  stock: number;
  lowThreshold: number;
}) {
  const [value, setValue] = useState(stock);
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();

  // El servidor manda: si la fila se recarga con otro valor, se acompaña.
  useEffect(() => {
    if (!dirty) setValue(stock);
  }, [stock, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      startSaving(async () => {
        const res = await setProductStock(productId, value);
        if (!res.ok) {
          setValue(stock);
          toast.error(res.error ?? "No se pudo actualizar el stock");
        }
        setDirty(false);
      });
    }, 700);
    return () => clearTimeout(t);
  }, [value, dirty, productId, stock]);

  function bump(delta: number) {
    setValue((v) => Math.max(0, v + delta));
    setDirty(true);
  }

  const tone =
    value <= 0
      ? "text-destructive"
      : value <= lowThreshold
        ? "text-warning-foreground"
        : "text-foreground";

  return (
    // stopPropagation: la fila entera es un link al producto y sin esto tocar
    // el "+" abría el formulario en vez de sumar una unidad.
    <div
      className="flex items-center rounded-lg border bg-background"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        onClick={() => bump(-1)}
        disabled={value <= 0}
        className="grid size-9 place-items-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        aria-label="Quitar una unidad"
      >
        <Minus className="size-3.5" />
      </button>
      <span
        className={cn(
          "inline-flex w-9 items-center justify-center gap-1 text-sm font-semibold tabular-nums",
          tone,
        )}
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : value}
      </span>
      <button
        type="button"
        onClick={() => bump(1)}
        className="grid size-9 place-items-center text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Agregar una unidad"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
