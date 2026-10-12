import type { AppUser } from "@/types/database";

/** Clave en el `user_metadata` de Supabase Auth: cuándo cerró el aviso. */
export const DOMAIN_NOTICE_KEY = "domain_notice_seen_at";

/**
 * El día que Tiendify pasó de tiendifyapp.com a usatiendify.com. Quien se
 * registró después ya conoció la plataforma en el dominio nuevo: no hay nada
 * que avisarle.
 */
const DOMAIN_CHANGED_AT = new Date("2026-10-13T00:00:00Z");

/**
 * El aviso del cambio de dominio se muestra una sola vez por usuario. El "ya lo
 * vio" va en su `user_metadata` y no en una columna ni en el navegador: viaja
 * con la cuenta a cualquier dispositivo y no pide migración para algo que se
 * usa una vez.
 */
export function shouldShowDomainNotice(
  user: AppUser,
  metadata: Record<string, unknown>,
): boolean {
  return (
    new Date(user.created_at) < DOMAIN_CHANGED_AT && !metadata[DOMAIN_NOTICE_KEY]
  );
}
