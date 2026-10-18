"use client";

import { reportClientError } from "@/lib/client-error-actions";

/**
 * Avisa a Telegram que alguien vio una pantalla de error (error.tsx,
 * global-error.tsx). La llaman las tres pantallas, una vez por error.
 *
 * Se salta el error de las pestañas viejas después de un deploy ("Loading
 * chunk… failed"): el navegador pide archivos de la versión anterior que ya no
 * existen, se arregla recargando y no es una falla nuestra.
 */
export function reportErrorScreen(error: Error & { digest?: string }): void {
  if (error.name === "ChunkLoadError" || /Loading (CSS )?chunk/i.test(error.message)) return;
  void reportClientError({
    place: "pagina",
    message: `${error.name}: ${error.message}`.slice(0, 300),
    digest: error.digest,
    path: window.location.pathname,
  }).catch(() => {});
}
