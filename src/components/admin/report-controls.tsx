"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * En el teléfono las dos fechas van lado a lado y no caben con el ícono de
 * calendario de Chrome. Ahí sobra: tocar el campo ya abre el selector.
 */
const DATE_INPUT =
  "w-full min-w-0 px-2.5 max-sm:[&::-webkit-calendar-picker-indicator]:hidden sm:w-[10.5rem] sm:px-3";

/**
 * Rango de fechas a mano. Siempre muestra las fechas del período activo:
 * los atajos ("Mes pasado") la llenan, y desde ahí se puede ajustar un día.
 * La página le pasa `key` con el rango para que se reinicie al cambiar.
 */
export function ReportRangeForm({
  tipo,
  from,
  to,
}: {
  tipo: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [desde, setDesde] = useState(from);
  const [hasta, setHasta] = useState(to);

  return (
    <form
      // En el teléfono las dos fechas van lado a lado y el botón abajo a lo
      // ancho; desde sm, todo en una fila.
      className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (!desde || !hasta) return;
        const sp = new URLSearchParams({ tipo, desde, hasta });
        startTransition(() => router.push(`/panel/finanzas/reportes?${sp}`));
      }}
    >
      <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
        Desde
        <Input
          type="date"
          value={desde}
          max={hasta || undefined}
          onChange={(e) => setDesde(e.target.value)}
          required
          className={DATE_INPUT}
        />
      </label>
      <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
        Hasta
        <Input
          type="date"
          value={hasta}
          min={desde || undefined}
          onChange={(e) => setHasta(e.target.value)}
          required
          className={DATE_INPUT}
        />
      </label>
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="col-span-2 sm:col-span-1"
      >
        {pending && <Loader2 className="animate-spin" />}
        Ver estas fechas
      </Button>
    </form>
  );
}

export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer /> Imprimir / PDF
    </Button>
  );
}
