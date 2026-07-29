import type { ReferralStatus } from "@/types/database";

/**
 * Referidos comerciante-a-comerciante. Fuente única de las reglas del programa.
 *
 * La lógica que ejecuta el premio vive en `referrals-server.ts`; aquí van solo
 * constantes y funciones puras, para que el panel (cliente) pueda armar links y
 * etiquetas sin arrastrar código de servidor.
 *
 * Ver el encabezado de supabase/migrations/0020_referrals.sql para el porqué de
 * cada regla.
 */

/** Meses de Pro que gana quien refiere, por cada referido que se activa. */
export const REFERRAL_REWARD_MONTHS = 1;

/**
 * Qué tiene que lograr la tienda referida para que el premio se acredite.
 * Las dos condiciones juntas: con una sola, se farmea.
 */
export const QUALIFY_MIN_PRODUCTS = 3;
export const QUALIFY_MIN_ORDERS = 1;

/**
 * Tope de referidos premiados automáticamente por tienda cada 30 días. Lo que
 * pase de aquí queda en 'qualified' esperando aprobación manual en /super.
 */
export const REWARD_CAP_PER_30D = 10;
export const REWARD_CAP_WINDOW_DAYS = 30;

/** Cookie que recuerda quién trajo al visitante mientras se decide a registrarse. */
export const REFERRAL_COOKIE = "tf_ref";
export const REFERRAL_COOKIE_MAX_AGE = 90 * 24 * 60 * 60; // 90 días

/** Campo oculto del formulario de registro, por si la cookie no sobrevivió. */
export const REFERRAL_FIELD = "ref";

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://www.tiendifyapp.com"
  ).replace(/\/+$/, "");
}

/** El link corto que comparte el comerciante. */
export function referralLink(code: string): string {
  return `${appUrl()}/r/${code}`;
}

/** Mensaje sugerido para compartir por WhatsApp. */
export function referralShareText(code: string): string {
  return (
    "Estoy vendiendo online con Tiendify. Creas tu tienda gratis en un minuto " +
    `y vendes por WhatsApp: ${referralLink(code)}`
  );
}

/**
 * Limpia lo que venga de la URL o del formulario. Devuelve null si no parece un
 * código, así el registro no se pone a buscar basura en la base.
 */
export function normalizeReferralCode(
  raw: string | null | undefined,
): string | null {
  const code = (raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  // 8 es el largo normal; los códigos de emergencia de la migración son largos.
  if (code.length < 6 || code.length > 40) return null;
  return code;
}

export const REFERRAL_STATUS_META: Record<
  ReferralStatus,
  { label: string; description: string }
> = {
  pending: {
    label: "En progreso",
    description: `Se activa con ${QUALIFY_MIN_PRODUCTS} productos publicados y su primera venta confirmada.`,
  },
  qualified: {
    label: "Por acreditar",
    description: "Ya se activó. Estamos revisando el premio.",
  },
  rewarded: {
    label: "Acreditado",
    description: "El mes de Pro ya está sumado a tu plan.",
  },
  rejected: {
    label: "No válido",
    description: "Este referido no cumplió las condiciones del programa.",
  },
};

/** Meses ya acreditados de una lista de referidos. */
export function monthsEarned(
  referrals: { status: ReferralStatus; reward_months: number }[],
): number {
  return referrals
    .filter((r) => r.status === "rewarded")
    .reduce((sum, r) => sum + r.reward_months, 0);
}
