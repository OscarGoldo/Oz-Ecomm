import "server-only";

import { headers } from "next/headers";

import { joinStorePath, storeSlugFromHost } from "@/lib/store-url";

/**
 * Enlaces internos de la tienda para los Server Components.
 *
 * Dependen de en qué dirección se está viendo la página, no del plan: una
 * tienda Pro abierta por su link viejo (usatiendify.com/mitienda) sigue
 * navegando con rutas `/mitienda/...`, y abierta por su subdominio navega con
 * rutas cortas. Así el cliente nunca salta de una dirección a la otra a mitad de
 * compra (el carrito vive en una cookie de cada dirección).
 *
 * Se decide por el host, que es lo que de verdad enrutó la petición: un header
 * propio lo podría mandar cualquiera.
 *
 * Los Client Components usan `useStoreHref()` de store-base.tsx, que recibe la
 * misma base desde el layout.
 */
export function onStoreSubdomain(slug: string): boolean {
  return storeSlugFromHost(headers().get("host")) === slug;
}

export function storeBasePath(slug: string): string {
  return onStoreSubdomain(slug) ? "" : `/${slug}`;
}

export function storeHref(slug: string, path = ""): string {
  return joinStorePath(storeBasePath(slug), path);
}
