"use client";

import { useEffect, useState } from "react";
import { RotateCw, X, ZoomIn } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * El comprobante, en grande y girable.
 *
 * Es el momento más repetido del día del comerciante: mirar una captura de Pago
 * Móvil y decidir si el monto coincide. Antes se renderizaba con `max-h-80`
 * dentro de la página y el único zoom era abrir la URL firmada en otra pestaña,
 * lo que lo sacaba del panel. Una captura vertical dentro de 320 px de alto deja
 * ilegible justo el dato que hay que verificar.
 */
export function ProofViewer({ url, alt = "Comprobante de pago" }: { url: string; alt?: string }) {
  const [open, setOpen] = useState(false);
  const [rotation, setRotation] = useState(0);

  // Escape para cerrar y bloqueo del scroll de fondo mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full overflow-hidden rounded-lg border bg-muted"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          className="max-h-[420px] w-full object-contain transition-transform group-hover:scale-[1.02]"
        />
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg bg-foreground/80 px-2.5 py-1.5 text-xs font-medium text-background">
          <ZoomIn className="size-3.5" /> Ver en grande
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <div className="flex items-center justify-between gap-2 p-3">
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-white hover:bg-white/10"
            >
              <RotateCw className="size-5" /> Girar
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10"
              aria-label="Cerrar"
            >
              <X className="size-6" />
            </button>
          </div>
          {/* overflow-auto + touch-pinch-zoom: el gesto de pellizcar del sistema
              funciona acá adentro, que es como se hace zoom en un celular. */}
          <div className="flex-1 overflow-auto [touch-action:pinch-zoom]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={alt}
              className={cn(
                "mx-auto min-h-full w-auto max-w-none object-contain p-2 transition-transform",
                rotation % 180 === 0 ? "max-h-full" : "max-h-[100vw]",
              )}
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          </div>
        </div>
      )}
    </>
  );
}
