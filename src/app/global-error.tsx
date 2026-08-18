"use client";

import { useEffect } from "react";

/**
 * Última red: se activa cuando el que revienta es el layout raíz, así que
 * tiene que traer su propio <html> y <body> y no puede usar nada de la app
 * (ni el logo, ni los tokens de Tailwind, porque puede que el CSS tampoco haya
 * cargado). De ahí los estilos en línea.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      `[global-error]${error.digest ? ` ${error.digest}` : ""}`,
      error,
    );
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "1.5rem",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>
            Tiendify no está respondiendo
          </h1>
          <p style={{ margin: "0 0 1.5rem", color: "#64748b" }}>
            Estamos con un problema técnico. Intenta de nuevo en unos minutos.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              border: 0,
              borderRadius: "0.5rem",
              background: "#0ea5e9",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 600,
              padding: "0.65rem 1.25rem",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
          {error.digest && (
            <p
              style={{
                marginTop: "1.5rem",
                fontSize: "0.75rem",
                color: "#94a3b8",
              }}
            >
              Código: <span style={{ fontFamily: "monospace" }}>{error.digest}</span>
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
