import "server-only";

/**
 * Punto único por donde sale todo error que valga la pena investigar.
 *
 * Existe para dos cosas:
 *
 *  1. Que haya UN lugar donde enchufar Sentry (o lo que sea) el día que se
 *     configure, en vez de tener que tocar 30 `catch`. Mientras no haya DSN,
 *     escribe a la consola, que en Vercel queda en los logs de la función.
 *
 *  2. Devolver un ID corto que se le pueda mostrar al usuario. Cuando un
 *     comerciante escriba "no me deja guardar", va a poder dictar "TND-4F2A"
 *     por WhatsApp y eso se busca en los logs. Sin esto, un reporte de soporte
 *     es una adivinanza.
 *
 * Nunca lanza: reportar un error jamás puede ser la causa de otro.
 */

export interface ErrorReport {
  /** Código corto para mostrarle al usuario y buscar en los logs. */
  ref: string;
}

function shortRef(): string {
  return `TND-${Math.random().toString(36).toUpperCase().slice(2, 6)}`;
}

export function reportError(
  where: string,
  error: unknown,
  context?: Record<string, unknown>,
): ErrorReport {
  const ref = shortRef();
  try {
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    // Una línea por error, con el ref adelante para poder grepear.
    console.error(
      `[${ref}] ${where} — ${detail}`,
      context ? JSON.stringify(context) : "",
      error instanceof Error && error.stack ? `\n${error.stack}` : "",
    );

    // Y a Sentry, si hay DSN configurado (ver src/instrumentation.ts). Import
    // dinámico y sin await: reportar no puede demorar un pedido en curso.
    if (process.env.SENTRY_DSN) {
      void import("@sentry/nextjs")
        .then((Sentry) =>
          Sentry.captureException(error, {
            tags: { ref, where },
            extra: context,
          }),
        )
        .catch(() => {
          /* si ni Sentry carga, ya quedó en los logs de arriba */
        });
    }
  } catch {
    // Ni siquiera loguear puede tumbar la operación de arriba.
  }
  return { ref };
}
