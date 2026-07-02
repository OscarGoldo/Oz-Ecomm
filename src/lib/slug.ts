/** URL-safe slug from arbitrary text (handles Spanish accents/ñ). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // strip accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slugs that would collide with app routes (static routes win over the
 * dynamic /[store_slug]) or are otherwise unsafe as a public store URL.
 */
const RESERVED_SLUGS = new Set([
  "login",
  "logout",
  "auth",
  "panel",
  "super",
  "admin",
  "api",
  "crear-tienda",
  "signup",
  "registro",
  "recuperar",
  "actualizar-clave",
  "terminos",
  "privacidad",
  "checkout",
  "carrito",
  "pedido",
  "pedidos",
  "producto",
  "productos",
  "categoria",
  "categorias",
  "configuracion",
  "finanzas",
  "tienda",
  "tiendas",
  "_next",
  "static",
  "public",
  "assets",
  "favicon",
  "robots",
  "sitemap",
  "404",
  "500",
  "www",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
