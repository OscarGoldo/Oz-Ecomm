import type { Store } from "@/types/database";

/**
 * Una tienda fuera de línea puede estarlo por dos motivos, y no son lo mismo:
 *
 *  - la pausó el super admin (`subscription_status = 'paused'`): solo él la
 *    reactiva, y el dueño sigue entrando a su panel.
 *  - la cerró su dueño desde Ajustes (`subscription_status = 'cancelled'`): el
 *    panel queda bloqueado y el propio dueño puede reabrirla.
 *
 * Se distinguen por `subscription_status`, que ya existía con esos tres
 * valores, así que cerrar una tienda no necesitó una columna nueva.
 */
export function storeClosedByOwner(
  store: Pick<Store, "active" | "subscription_status">,
): boolean {
  return !store.active && store.subscription_status === "cancelled";
}
