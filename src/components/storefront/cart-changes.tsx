"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { reconcileCart } from "@/lib/cart-actions";
import { cn } from "@/lib/utils";
import type { CartChange } from "@/lib/cart";

/**
 * Avisa qué se ajustó del carrito y deja la cookie igual a lo que se ve.
 *
 * Las dos cosas van juntas a propósito. Sin corregir la cookie, lo que el
 * cliente ya no ve seguía sumando en el contador y trababa el checkout (ver
 * `reconcileCart`). Y corregirla implica refrescar la página, que vuelve sin
 * ajustes: por eso el aviso se guarda en estado y sobrevive al refresco — si
 * no, el cliente vería desaparecer un producto sin ninguna explicación.
 */
export function CartChanges({
  storeId,
  changes,
  className,
}: {
  storeId: string;
  changes: CartChange[];
  className?: string;
}) {
  const router = useRouter();
  const [shown, setShown] = useState(changes);
  const stale = changes.length > 0;

  useEffect(() => {
    if (!stale) return;
    setShown(changes);
    let cancelled = false;
    reconcileCart(storeId)
      .then(() => {
        if (!cancelled) router.refresh();
      })
      .catch(() => {
        // Si falla, el checkout sigue avisando y el servidor sigue validando.
      });
    return () => {
      cancelled = true;
    };
    // Corre cuando aparece un ajuste nuevo, no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, storeId]);

  if (shown.length === 0) return null;

  return (
    <div className={cn("rounded-xl border border-warning/40 bg-warning/10 p-3", className)}>
      <p className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="size-4 shrink-0 text-warning-foreground" />
        Ajustamos tu pedido
      </p>
      <ul className="mt-1.5 space-y-0.5 pl-6 text-sm text-muted-foreground">
        {shown.map((c, i) => (
          <li key={`${c.name}-${i}`}>
            {c.kind === "clamped"
              ? `De ${c.name} quedaban ${c.available}, así que llevas esa cantidad.`
              : c.kind === "unavailable"
                ? `${c.name} ya no está disponible y lo quitamos.`
                : `${c.name} se agotó y lo quitamos.`}
          </li>
        ))}
      </ul>
    </div>
  );
}
