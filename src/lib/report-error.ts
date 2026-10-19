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

/**
 * El texto de un error, sea lo que sea lo que llegó.
 *
 * Supabase no lanza: devuelve `{ error }` como un objeto suelto
 * (`{ message, code, details, hint }`), no como un `Error`, y medio proyecto
 * hace `if (error) throw error`. Con `String()` eso quedaba "[object Object]" y
 * el aviso no decía nada: pasó con el sitemap el 2026-10-19 y no hubo forma de
 * saber qué falló.
 */
function describeError(error: unknown): string {
  const code = (e: object) => {
    const c = (e as { code?: unknown }).code;
    return (typeof c === "string" && c) || typeof c === "number" ? ` [${c}]` : "";
  };

  if (error instanceof Error) return `${error.name}: ${error.message}${code(error)}`;

  if (error && typeof error === "object") {
    const { message, details, hint } = error as Record<string, unknown>;
    if (typeof message === "string" && message) {
      return [`${message}${code(error)}`, cleanDetails(details, message), hint]
        .filter((s): s is string => typeof s === "string" && s !== "")
        .join(" · ");
    }
    try {
      return JSON.stringify(error);
    } catch {
      // Circular o algo raro: queda el String() de abajo.
    }
  }

  return String(error);
}

/**
 * Cuando Supabase no llega a la base (`fetch failed`), `details` trae el stack
 * entero de undici. Lo que sirve es el "Caused by: …" (timeout, DNS, puerto);
 * el resto se comería los 500 caracteres del aviso.
 */
function cleanDetails(details: unknown, message: string): string | null {
  if (typeof details !== "string") return null;
  const kept: string[] = [];
  for (const raw of details.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("at ") || line === message) continue;
    if (kept.some((k) => k.includes(line))) continue;
    kept.push(line);
  }
  return kept.join(" ").slice(0, 200) || null;
}

export function reportError(
  where: string,
  error: unknown,
  context?: Record<string, unknown>,
): ErrorReport {
  const ref = shortRef();
  try {
    const detail = describeError(error);
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
          // Un objeto suelto de Supabase llegaría como "Object captured as
          // exception"; envuelto en un Error se agrupa por su mensaje.
          Sentry.captureException(error instanceof Error ? error : new Error(detail), {
            tags: { ref, where },
            extra: context,
          }),
        )
        .catch(() => {
          /* si ni Sentry carga, ya quedó en los logs de arriba */
        });
    }

    // Y al grupo de Telegram de los socios (máximo un aviso por lugar cada 30
    // minutos). Import dinámico: error-alerts usa la base y Telegram, y este
    // archivo lo importa medio proyecto. Corre después de la respuesta si hace
    // falta, sin demorar lo que se esté haciendo.
    void import("@/lib/error-alerts")
      .then(({ alertError, runInBackground }) =>
        runInBackground(
          alertError({
            source: "servidor",
            where,
            detail: `${detail}${context ? ` · ${JSON.stringify(context).slice(0, 200)}` : ""}`,
            ref,
          }),
        ),
      )
      .catch(() => {
        /* avisar nunca puede tumbar nada */
      });
  } catch {
    // Ni siquiera loguear puede tumbar la operación de arriba.
  }
  return { ref };
}
