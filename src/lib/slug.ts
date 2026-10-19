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
  "r", // /r/<codigo>: el link corto de referidos
  "referidos",
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
  "vista-previa", // la vista previa del editor de diseño
  "finanzas",
  "tienda",
  "tiendas",
  "tienda-cerrada",
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
  // El slug también es el subdominio (mitienda.usatiendify.com): estos quedan
  // para la plataforma.
  "app",
  "mail",
  "email",
  "smtp",
  "ftp",
  "blog",
  "ayuda",
  "soporte",
  "help",
  "status",
  "docs",
  "cdn",
  "dev",
  "staging",
  "test",
]);

/**
 * Largo máximo de la base de un slug nuevo. Un subdominio aguanta 63
 * caracteres; el tope deja lugar para el sufijo de una colisión ("-a1b2").
 */
export const STORE_SLUG_MAX = 50;

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
