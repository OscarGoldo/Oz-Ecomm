import { isPro } from "@/lib/plans";
import { slugFitsSubdomain, storeSubdomainsEnabled } from "@/lib/store-url";
import type { AppUser, Store } from "@/types/database";

/** Clave en el `user_metadata` de Supabase Auth: cuándo cerró el aviso. */
export const STORE_ADDRESS_NOTICE_KEY = "store_address_notice_seen_at";

/**
 * El día que las tiendas Pro estrenaron subdominio. Un Pro que se registró
 * después ya conoció su dirección así: no hay cambio que contarle.
 */
const SUBDOMAINS_LAUNCHED_AT = new Date("2026-10-17T00:00:00Z");

/**
 * El día que el subdominio pasó a ser de todas las tiendas, también las Gratis
 * (medianoche del 18 al 19 en Venezuela). Una tienda Gratis creada antes vivía
 * en usatiendify.com/mitienda.
 */
const FREE_SUBDOMAINS_AT = new Date("2026-10-19T04:00:00Z");

/**
 * El aviso de la dirección propia sale una sola vez por usuario, con el mismo
 * mecanismo que el del cambio de dominio (domain-notice.ts): el "ya lo vio" va
 * en su `user_metadata` y viaja con la cuenta a cualquier dispositivo.
 *
 * A un Gratis que lo cerró antes de FREE_SUBDOMAINS_AT le vuelve a salir: lo
 * que vio entonces era "con Pro, tu tienda queda en…", y ahora la dirección ya
 * es suya. Si el slug no cabe en un subdominio (más de 63 caracteres) o los
 * subdominios están apagados, no hay nada que mostrar.
 */
export function shouldShowStoreAddressNotice(
  user: AppUser,
  metadata: Record<string, unknown>,
  store: Pick<Store, "slug" | "plan" | "plan_expires_at">,
): boolean {
  if (!storeSubdomainsEnabled() || !slugFitsSubdomain(store.slug)) return false;

  const created = new Date(user.created_at);
  const seen = metadata[STORE_ADDRESS_NOTICE_KEY];

  if (isPro(store)) return created < SUBDOMAINS_LAUNCHED_AT && !seen;

  const seenBeforeChange =
    typeof seen === "string" && new Date(seen) < FREE_SUBDOMAINS_AT;
  return created < FREE_SUBDOMAINS_AT && (!seen || seenBeforeChange);
}
