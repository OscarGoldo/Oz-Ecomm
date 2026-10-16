import { slugFitsSubdomain, storeSubdomainsEnabled } from "@/lib/store-url";
import type { AppUser, Store } from "@/types/database";

/** Clave en el `user_metadata` de Supabase Auth: cuándo cerró el aviso. */
export const STORE_ADDRESS_NOTICE_KEY = "store_address_notice_seen_at";

/**
 * El día que las tiendas Pro estrenaron subdominio. Quien se registró después
 * ya conoció las direcciones así: no hay cambio que contarle.
 */
const SUBDOMAINS_LAUNCHED_AT = new Date("2026-10-17T00:00:00Z");

/**
 * El aviso de la dirección propia sale una sola vez por usuario, con el mismo
 * mecanismo que el del cambio de dominio (domain-notice.ts): el "ya lo vio" va
 * en su `user_metadata` y viaja con la cuenta a cualquier dispositivo.
 *
 * A un Pro le cuenta su dirección nueva; a uno en Gratis, la que tendría con
 * Pro. Si el slug no cabe en un subdominio (más de 63 caracteres) o los
 * subdominios están apagados, no hay nada que mostrar.
 */
export function shouldShowStoreAddressNotice(
  user: AppUser,
  metadata: Record<string, unknown>,
  store: Pick<Store, "slug">,
): boolean {
  return (
    new Date(user.created_at) < SUBDOMAINS_LAUNCHED_AT &&
    !metadata[STORE_ADDRESS_NOTICE_KEY] &&
    storeSubdomainsEnabled() &&
    slugFitsSubdomain(store.slug)
  );
}
