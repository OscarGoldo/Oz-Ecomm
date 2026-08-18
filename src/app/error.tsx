"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { TiendifyLogoMark } from "@/components/landing/tiendify-logo";

/**
 * Pantalla de error de toda la app. Sin esto, cualquier excepción del servidor
 * le mostraba al cliente el cartel pelado de Next ("Application error: a
 * server-side exception has occurred"), sin marca y sin salida.
 *
 * `digest` es el hash que Next le pone al error del servidor y que también
 * queda en los logs de Vercel: es lo que permite cruzar "el cliente me mandó
 * este código" con el stack real.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(`[app-error]${error.digest ? ` ${error.digest}` : ""}`, error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/30 px-4">
      <div className="w-full max-w-md text-center">
        <TiendifyLogoMark className="mx-auto mb-4 h-12 w-auto" />
        <h1 className="text-2xl font-bold tracking-tight">
          Algo se rompió de nuestro lado
        </h1>
        <p className="mt-2 text-muted-foreground">
          No es culpa tuya. Ya quedó registrado y lo estamos viendo. Prueba de
          nuevo en un momento.
        </p>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 sm:w-auto"
          >
            <RefreshCw className="size-4" /> Reintentar
          </button>
          <Link
            href="/"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg border px-5 text-sm font-medium hover:bg-muted sm:w-auto"
          >
            Ir al inicio
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-muted-foreground">
            Si nos escribes, pásanos este código:{" "}
            <span className="font-mono font-medium text-foreground">
              {error.digest}
            </span>
          </p>
        )}
      </div>
    </main>
  );
}
