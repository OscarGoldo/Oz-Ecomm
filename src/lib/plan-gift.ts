/**
 * Meses de Pro regalados desde /super, y el aviso que el comerciante ve la
 * próxima vez que entra al panel.
 *
 * El regalo en sí es el plan (`stores.plan_expires_at`). Lo que va acá es solo
 * el aviso: el super admin lo deja en el `user_metadata` del dueño y el panel
 * lo muestra hasta que lo cierra. Mismo mecanismo que el aviso del cambio de
 * dominio (domain-notice.ts): viaja con la cuenta y no pide migración.
 *
 * El comerciante puede escribir su propio `user_metadata`, así que lo más que
 * podría hacer es inventarse un aviso para sí mismo. Por eso el aviso solo sale
 * si la tienda tiene Pro vigente de verdad: nunca da acceso a nada.
 */

/** Clave en el `user_metadata`: el último regalo que se le hizo. */
export const PLAN_GIFT_KEY = "plan_gift";

/** Clave en el `user_metadata`: cuándo cerró el aviso del regalo. */
export const PLAN_GIFT_SEEN_KEY = "plan_gift_seen_at";

export interface PlanGift {
  months: number;
  /** Unas líneas del equipo para el comerciante. null = el texto de siempre. */
  message: string | null;
  /** Cuándo se regaló. Un regalo nuevo vuelve a mostrar el aviso. */
  at: string;
}

/** El regalo que todavía no vio, o null si no hay nada que mostrar. */
export function pendingPlanGift(
  metadata: Record<string, unknown>,
  pro: boolean,
): PlanGift | null {
  if (!pro) return null;
  const raw = metadata[PLAN_GIFT_KEY];
  if (!raw || typeof raw !== "object") return null;

  const { months, message, at } = raw as Record<string, unknown>;
  if (typeof months !== "number" || months < 1 || typeof at !== "string") {
    return null;
  }

  const seen = metadata[PLAN_GIFT_SEEN_KEY];
  if (typeof seen === "string" && seen >= at) return null;

  return {
    months,
    message: typeof message === "string" && message.trim() ? message : null,
    at,
  };
}
