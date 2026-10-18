import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { escapeTelegramHtml, sendTelegram } from "@/lib/telegram";

/**
 * Avisa por Telegram que algo se rompió.
 *
 * Existe por lo de octubre de 2026: los clientes no podían subir comprobantes
 * y nadie se enteró, porque el error quedaba en el teléfono del cliente y en
 * los logs de Vercel, donde nadie mira. Ahora todo error que pasa por
 * `reportError` (servidor), por `reportClientError` (navegador) o por la
 * revisión de cada hora (/api/cron/revision) llega al grupo de los socios.
 *
 * Sin spam: el mismo error (`where`) avisa una vez cada 30 minutos. La marca se
 * guarda en `platform_events` con un `dedupe_key` único, así que vale para
 * todas las instancias del servidor a la vez. Si la base no responde, queda un
 * segundo freno en memoria por instancia.
 *
 * Nunca lanza, y no llama a `reportError`: si avisar falla, solo queda en la
 * consola (si no, un error al avisar dispararía otro aviso, y otro…).
 */

export type ErrorSource = "servidor" | "navegador" | "revision";

const WINDOW_MS = 30 * 60 * 1000;
const lastSent = new Map<string, number>();

const SOURCE_LABEL: Record<ErrorSource, string> = {
  servidor: "Error en el servidor",
  navegador: "Error en el navegador de un usuario",
  revision: "Falló la revisión automática",
};

export async function alertError(input: {
  source: ErrorSource;
  /** Dónde pasó. Es la clave para no repetir el aviso. */
  where: string;
  /** Qué pasó, en una línea. */
  detail: string;
  /** Código corto que también quedó en los logs (TND-XXXX). */
  ref?: string;
  /** Página o ruta donde ocurrió, si se sabe. */
  path?: string;
}): Promise<void> {
  try {
    const key = `${input.source}:${input.where}`;
    const now = Date.now();
    const prev = lastSent.get(key);
    if (prev && now - prev < WINDOW_MS) return;
    lastSent.set(key, now);

    const bucket = Math.floor(now / WINDOW_MS);
    const title = `${SOURCE_LABEL[input.source]}: ${input.where}`;
    const detail = input.detail.slice(0, 500);

    const { error } = await createAdminClient()
      .from("platform_events")
      .insert({
        type: "system.error",
        title,
        detail,
        data: { source: input.source, where: input.where, ref: input.ref ?? null, path: input.path ?? null },
        dedupe_key: `error:${key}:${bucket}`,
      });
    // Otra instancia ya avisó de este mismo error en esta media hora.
    if (error?.code === "23505") return;
    if (error) console.error(`[error-alerts] no se pudo anotar: ${error.message}`);

    const lines = [
      `🚨 <b>${escapeTelegramHtml(title)}</b>`,
      escapeTelegramHtml(detail),
    ];
    const meta = [
      input.path ? `Página: ${escapeTelegramHtml(input.path.slice(0, 200))}` : null,
      input.ref ? `Código: ${escapeTelegramHtml(input.ref)}` : null,
    ].filter(Boolean);
    if (meta.length) lines.push(meta.join(" · "));
    lines.push("<i>Si se repite, el próximo aviso de este error llega en 30 minutos.</i>");

    await sendTelegram(lines.join("\n"));
  } catch (err) {
    console.error(`[error-alerts] el aviso reventó: ${String(err)}`);
  }
}

/**
 * Deja correr una tarea después de que la respuesta ya salió. En Vercel la
 * función se congela al responder; con esto espera a que el aviso termine. Es
 * lo mismo que hace `waitUntil` de @vercel/functions, sin sumar la dependencia.
 * Fuera de Vercel la promesa simplemente corre.
 */
export function runInBackground(task: Promise<unknown>): void {
  const ctx = (
    globalThis as unknown as Record<symbol, { get?: () => { waitUntil?: (p: Promise<unknown>) => void } } | undefined>
  )[Symbol.for("@vercel/request-context")]?.get?.();
  ctx?.waitUntil?.(task.catch(() => {}));
}
