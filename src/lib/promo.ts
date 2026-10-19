import type { PromoCode } from "@/types/database";

/**
 * Códigos promocionales: meses de Pro gratis para quien crea su tienda con uno.
 * Los crea el super admin para una campaña ("las primeras 10 personas") y se
 * canjean en el registro.
 *
 * Este archivo NO es "server-only": son funciones puras que usan el formulario
 * del registro y el panel del super admin. Lo que toca la base está en
 * `promo-server.ts`.
 */

/**
 * El código de la portada: un mes de Pro gratis. Lo crea la migración 0037 y
 * se maneja desde /super/codigos; si se apaga o se borra allá, hay que sacarlo
 * también de acá, porque la portada lo sigue mostrando.
 */
export const LAUNCH_PROMO_CODE = "USATIENDIFYYA";

/** El registro con el código de la portada ya puesto. */
export const LAUNCH_SIGNUP_HREF = `/crear-tienda?codigo=${LAUNCH_PROMO_CODE}`;

/** Largo de un código. Coincide con el CHECK de la tabla. */
export const PROMO_CODE_MIN = 3;
export const PROMO_CODE_MAX = 24;

/**
 * Deja un código como se guarda: mayúsculas, solo letras y números.
 *
 * Se aplica al crearlo, al escribirlo y al buscarlo, para que "influ 10",
 * "Influ-10" e "INFLU10" sean el mismo código. Quien lo copia de una historia
 * de Instagram no lo va a escribir igual que quien lo creó.
 */
export function normalizePromoCode(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, PROMO_CODE_MAX);
}

export type PromoState = "active" | "exhausted" | "expired" | "off";

/**
 * En qué está un código ahora mismo. Es la misma regla que aplica
 * `claim_promo_code` en la base; acá solo sirve para mostrarlo.
 */
export function promoState(
  p: Pick<PromoCode, "active" | "expires_at" | "max_uses" | "used_count">,
): PromoState {
  if (!p.active) return "off";
  if (p.expires_at && new Date(p.expires_at).getTime() <= Date.now()) {
    return "expired";
  }
  if (p.max_uses !== null && p.used_count >= p.max_uses) return "exhausted";
  return "active";
}

export function monthsLabel(months: number): string {
  return months === 1 ? "1 mes" : `${months} meses`;
}
