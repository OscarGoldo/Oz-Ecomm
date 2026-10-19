import { publicSiteUrl } from "@/lib/site-url";
import type { Store } from "@/types/database";

/**
 * La dirección pública de una tienda: mitienda.usatiendify.com, en Gratis y en
 * Pro. Hasta el 2026-10-18 el subdominio era solo de Pro y las tiendas Gratis
 * vivían en usatiendify.com/mitienda.
 *
 * La tienda sigue respondiendo también en usatiendify.com/mitienda, sin
 * redirigir: ese link ya está pegado en Instagram y en conversaciones de
 * WhatsApp, y el rastreador de WhatsApp puede quedarse sin foto de vista previa
 * si le contestan con una redirección (ver site-url.ts). El subdominio es la
 * dirección CANÓNICA: la que muestra el panel, la que va en los mensajes de
 * pedido y la que ve Google.
 *
 * Cómo funciona: `*.usatiendify.com` apunta al mismo proyecto de Vercel y el
 * middleware reescribe `mitienda.usatiendify.com/producto/x` a la ruta interna
 * `/mitienda/producto/x`. Las páginas de `[store_slug]` no saben nada de esto;
 * solo los enlaces tienen que armarse según en qué dirección se está viendo la
 * tienda (store-href.ts en el servidor, store-base.tsx en el cliente).
 *
 * Este archivo no es "use server" ni toca `headers()`: lo importa también el
 * middleware, que corre en el edge.
 */

/**
 * La ruta original de una petición reescrita desde un subdominio, por si el
 * layout tiene que mandar al cliente a la dirección de siempre (los
 * subdominios están apagados). Solo se lee cuando el host es un subdominio de tienda.
 */
export const STORE_PATH_HEADER = "x-tiendify-store-path";

/** Lo mínimo que hace falta saber de una tienda para elegir su dirección. */
export type StoreAddress = Pick<Store, "slug">;

/**
 * Interruptor de emergencia: `STORE_SUBDOMAINS=off` en Vercel vuelve todo a
 * usatiendify.com/mitienda sin tocar código. Los subdominios que ya circulan
 * siguen funcionando: redirigen a la dirección de siempre.
 */
export function storeSubdomainsEnabled(): boolean {
  return (process.env.STORE_SUBDOMAINS ?? "").trim().toLowerCase() !== "off";
}

/** El host de la plataforma, con puerto si lo tiene: "usatiendify.com". */
export function platformHost(): string {
  return new URL(publicSiteUrl()).host.toLowerCase();
}

/**
 * Una etiqueta DNS válida: letras, números y guiones, sin guion en las puntas y
 * hasta 63 caracteres. Los slugs ya cumplen casi siempre; el límite de largo es
 * lo único que un slug puede romper, y en ese caso la tienda se queda con su
 * dirección de siempre.
 */
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Subdominios que nunca son una tienda. */
const NOT_A_STORE = new Set(["www"]);

export function slugFitsSubdomain(slug: string): boolean {
  return DNS_LABEL.test(slug) && !NOT_A_STORE.has(slug);
}

/** ¿Esta tienda se ve en su subdominio? Todas, en cualquier plan. */
export function hasStoreSubdomain(store: StoreAddress): boolean {
  return storeSubdomainsEnabled() && slugFitsSubdomain(store.slug);
}

/**
 * El slug de tienda que trae un host, o null si es la plataforma.
 *
 * `mitienda.usatiendify.com` → "mitienda". También acepta `mitienda.localhost`
 * para probar en local: ese host nunca llega a producción.
 */
export function storeSlugFromHost(host: string | null): string | null {
  if (!host) return null;
  const h = host.toLowerCase();
  const root = platformHost();

  let sub: string | null = null;
  if (h.endsWith(`.${root}`)) sub = h.slice(0, -(root.length + 1));
  else {
    const local = /^([^.]+)\.localhost(?::\d+)?$/.exec(h);
    if (local) sub = local[1];
  }

  return sub && slugFitsSubdomain(sub) ? sub : null;
}

/** "https://mitienda.usatiendify.com", sin barra final. */
export function storeSubdomainOrigin(slug: string): string {
  const site = new URL(publicSiteUrl());
  return `${site.protocol}//${slug}.${site.host}`;
}

/**
 * Pega una ruta a la base de la tienda.
 *
 *   base ""          + "/producto/x" → "/producto/x"
 *   base "/mitienda" + "/producto/x" → "/mitienda/producto/x"
 *   base ""          + ""            → "/"
 *   base ""          + "?cat=zapatos" → "/?cat=zapatos"
 */
export function joinStorePath(base: string, path = ""): string {
  if (!path) return base || "/";
  if (path.startsWith("/")) return `${base}${path}`;
  return `${base || "/"}${path}`;
}

/**
 * La URL absoluta y canónica de una página de la tienda: su subdominio, o
 * usatiendify.com/mitienda si los subdominios están apagados. Es la que va en todo lo que sale de la
 * página: mensajes de WhatsApp y correo, el regreso de Stripe, el sitemap, los
 * canonical y los datos estructurados.
 */
export function storeUrl(store: StoreAddress, path = ""): string {
  if (hasStoreSubdomain(store)) {
    // Sin barra final en la portada, igual que usatiendify.com/mitienda.
    const origin = storeSubdomainOrigin(store.slug);
    return path ? `${origin}${joinStorePath("", path)}` : origin;
  }
  return `${publicSiteUrl()}${joinStorePath(`/${store.slug}`, path)}`;
}

/** La dirección para mostrar, sin "https://": "mitienda.usatiendify.com". */
export function displayStoreAddress(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
