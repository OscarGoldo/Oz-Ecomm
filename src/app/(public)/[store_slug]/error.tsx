"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Error dentro de una tienda. Es la pantalla comercialmente más importante de
 * las tres: acá hay un cliente con plata en la mano y un comerciante que se
 * entera de la caída por WhatsApp.
 *
 * Se renderiza dentro del layout de la tienda, así que el header con el logo y
 * el botón de WhatsApp del comerciante siguen visibles: el cliente tiene por
 * dónde salir aunque el catálogo no cargue.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      `[storefront-error]${error.digest ? ` ${error.digest}` : ""}`,
      error,
    );
  }, [error]);

  return (
    <main className="container grid min-h-[60vh] place-items-center py-12">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold tracking-tight">
          No pudimos cargar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Puede ser tu conexión o algo de nuestro lado. Si tenías un pedido a
          medias, no lo perdiste: tu carrito sigue guardado.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <RefreshCw className="size-4" /> Volver a intentar
        </button>
        <p className="mt-4 text-xs text-muted-foreground">
          ¿Sigue sin cargar? Escríbele a la tienda por WhatsApp desde el botón
          de arriba.
        </p>
        {error.digest && (
          <p className="mt-4 font-mono text-[11px] text-muted-foreground">
            {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
