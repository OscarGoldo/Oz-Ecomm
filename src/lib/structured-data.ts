import type { Product, ProductVariant, Store } from "@/types/database";

/**
 * JSON-LD para las tiendas públicas.
 *
 * Por qué importa acá y no es SEO de manual: los rich snippets de Google
 * muestran el precio y la disponibilidad debajo del resultado. Para una
 * plataforma de catálogos eso es la diferencia entre aparecer como un link
 * cualquiera y aparecer con "$45,00 · En stock". También es lo que leen
 * WhatsApp y Facebook para armar la tarjeta al compartir el link, que es como
 * circula todo acá.
 *
 * Los precios se declaran en USD porque es la moneda en la que están
 * guardados; los bolívares son una conversión de presentación con una tasa que
 * cambia, y declarar eso como precio estructurado sería mentirle al crawler.
 */

const SCHEMA = "https://schema.org";

function absoluteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://tiendifyapp.com").replace(
    /\/$/,
    "",
  );
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Disponibilidad en el vocabulario de schema.org. */
function availability(inStock: boolean): string {
  return `${SCHEMA}/${inStock ? "InStock" : "OutOfStock"}`;
}

export interface ProductJsonLdInput {
  store: Pick<Store, "name" | "slug">;
  product: Pick<
    Product,
    "name" | "slug" | "description" | "price" | "sku" | "stock" | "track_stock"
  >;
  variants: Pick<ProductVariant, "name" | "price" | "stock" | "sku" | "active">[];
  /** URLs absolutas de las imágenes, ya resueltas. */
  images: string[];
  inStock: boolean;
}

/**
 * Producto individual. Con variantes se emite un `AggregateOffer` (rango de
 * precios); sin ellas, un `Offer` simple.
 */
export function productJsonLd({
  store,
  product,
  variants,
  images,
  inStock,
}: ProductJsonLdInput): Record<string, unknown> {
  const url = absoluteUrl(`/${store.slug}/producto/${product.slug}`);
  const active = variants.filter((v) => v.active);

  const prices = active.length
    ? active.map((v) => Number(v.price ?? product.price))
    : [Number(product.price)];
  const low = Math.min(...prices);
  const high = Math.max(...prices);

  const offers =
    active.length > 1 && low !== high
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: low.toFixed(2),
          highPrice: high.toFixed(2),
          offerCount: active.length,
          availability: availability(inStock),
          url,
        }
      : {
          "@type": "Offer",
          priceCurrency: "USD",
          price: low.toFixed(2),
          availability: availability(inStock),
          url,
          // Sin esto Google marca la oferta como incompleta. Un año es el
          // horizonte que recomienda su documentación cuando no hay una fecha
          // de fin real.
          priceValidUntil: new Date(Date.now() + 365 * 86_400_000)
            .toISOString()
            .slice(0, 10),
        };

  return {
    "@context": SCHEMA,
    "@type": "Product",
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(images.length ? { image: images } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    brand: { "@type": "Brand", name: store.name },
    offers,
  };
}

/**
 * La tienda como negocio. `Store` es el tipo de schema.org para un comercio
 * con vidriera; es más específico que Organization y habilita el panel de
 * información con dirección y teléfono.
 */
export function storeJsonLd(
  store: Pick<
    Store,
    "name" | "slug" | "description" | "address" | "phone" | "email"
  >,
  logoUrl: string | null,
): Record<string, unknown> {
  const url = absoluteUrl(`/${store.slug}`);
  return {
    "@context": SCHEMA,
    "@type": "Store",
    name: store.name,
    url,
    ...(store.description ? { description: store.description } : {}),
    ...(logoUrl ? { image: logoUrl, logo: logoUrl } : {}),
    ...(store.phone ? { telephone: store.phone } : {}),
    ...(store.email ? { email: store.email } : {}),
    ...(store.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: store.address,
            addressCountry: "VE",
          },
        }
      : {}),
  };
}

/** Miga de pan: Tienda › Producto. Google la dibuja arriba del resultado. */
export function breadcrumbJsonLd(
  store: Pick<Store, "name" | "slug">,
  product: Pick<Product, "name" | "slug">,
): Record<string, unknown> {
  return {
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: store.name,
        item: absoluteUrl(`/${store.slug}`),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: product.name,
        item: absoluteUrl(`/${store.slug}/producto/${product.slug}`),
      },
    ],
  };
}
