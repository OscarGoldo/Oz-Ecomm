"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, X } from "lucide-react";

import { hideDashboardTask, showHiddenTasks } from "@/app/(admin)/panel/actions";

/**
 * Una tarea de "Para atender hoy" con su botón para ocultarla. Desaparece al
 * instante; la acción guarda en la cuenta qué había a la vista, y la tarea
 * vuelve sola cuando entra algo nuevo (ver lib/dashboard-tasks.ts).
 *
 * El botón va fuera del enlace de la tarjeta, no adentro: un botón dentro de
 * un <a> es HTML inválido y en el teléfono el toque se iba al enlace.
 */
export function DismissibleTask({
  taskId,
  itemIds,
  label,
  children,
}: {
  taskId: string;
  itemIds: string[];
  /** Para el lector de pantalla: "Ocultar 3 carritos sin terminar". */
  label: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  if (hidden) return null;

  return (
    // [&>a]:h-full: la tarjeta ocupa todo el alto de la fila, como cuando era
    // ella misma el elemento de la grilla.
    <div className="relative [&>a]:h-full">
      {children}
      <button
        type="button"
        onClick={() => {
          setHidden(true);
          startTransition(async () => {
            await hideDashboardTask(taskId, itemIds);
            router.refresh();
          });
        }}
        title="Ocultar hasta que haya algo nuevo"
        aria-label={`Ocultar ${label}`}
        className="absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-full text-ink-500 transition-colors hover:bg-ink-100 hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/** "Ocultaste 2 pendientes · Mostrar", debajo de las tareas. */
export function ShowHiddenTasks({ count }: { count: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-600">
      <EyeOff className="size-3.5 shrink-0" />
      {count === 1 ? "Ocultaste 1 pendiente." : `Ocultaste ${count} pendientes.`}{" "}
      Vuelven solos si hay algo nuevo.
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await showHiddenTasks();
            router.refresh();
          })
        }
        className="font-semibold text-brand-700 hover:underline disabled:opacity-60"
      >
        Mostrar
      </button>
    </p>
  );
}
