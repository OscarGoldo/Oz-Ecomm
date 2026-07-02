import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, PackageSearch } from "lucide-react";

import { CategoryChips } from "@/components/storefront/category-chips";
import { DiscoverProductCard } from "@/components/storefront/discover-product-card";
import { getImageUrl } from "@/lib/storage";
import type { Category, Product, Store } from "@/types/database";
import { getBlock, type StoreTheme } from "@/lib/theme";

interface DiscoverStorefrontProps {
  store: Store;
  theme: StoreTheme;
  categories: Pick<Category, "id" | "name" | "slug">[];
  products: Product[];
  featured: Product[];
  hasFilters: boolean;
  heading: string;
  banner: string | null;
  hero: { headline: string; subtext: string; cta: string };
}

export function DiscoverStorefront({
  store,
  theme,
  categories,
  products,
  featured,
  hasFilters,
  heading,
  banner,
  hero,
}: DiscoverStorefrontProps) {
  // Product cutout for the promo banner: owner upload → store banner → a product photo.
  const promoImg =
    getImageUrl(theme.media.heroSlides[0]) ??
    banner ??
    getImageUrl(featured[0]?.images?.[0]) ??
    getImageUrl(products[0]?.images?.[0]);

  const promo = getBlock(theme, "promo");
  const categorias = getBlock(theme, "categorias");
  const destacados = getBlock(theme, "destacados");
  const catalog = getBlock(theme, "catalog");
  const about = getBlock(theme, "about");

  const nodes: Record<string, ReactNode> = {
    promo: promo.enabled ? (
      <section key="promo" className="container pt-5">
        <div className="overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-sm">
          <div className="flex items-center">
            <div className="flex-1 p-5 sm:p-8">
              <h1 className="max-w-md text-2xl font-bold leading-tight sm:text-3xl">
                {hero.headline}
              </h1>
              {hero.subtext && (
                <span className="mt-3 inline-block rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">
                  {hero.subtext}
                </span>
              )}
              <div className="mt-4">
                <a
                  href="#catalogo"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/30"
                >
                  {hero.cta} <ArrowRight className="size-4" />
                </a>
              </div>
            </div>
            {promoImg && (
              <div className="relative h-36 w-32 shrink-0 self-end sm:h-48 sm:w-56">
                <Image
                  src={promoImg}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 128px, 224px"
                  className="object-contain object-bottom p-2 drop-shadow-xl"
                />
              </div>
            )}
          </div>
        </div>
      </section>
    ) : null,

    categorias:
      categories.length > 0 && categorias.enabled ? (
        <section key="categorias" className="container pt-6">
          <h2 className="mb-3 text-base font-bold">{categorias.title}</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Todas
            </span>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/${store.slug}?cat=${c.slug}`}
                className="shrink-0 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null,

    destacados:
      featured.length > 0 && destacados.enabled ? (
        <section key="destacados" className="container pt-7">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-bold">{destacados.title}</h2>
            <a href="#catalogo" className="text-sm font-medium text-primary hover:underline">
              Ver todo
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {featured.slice(0, 4).map((p) => (
              <DiscoverProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        </section>
      ) : null,

    catalog: (
      <section key="catalog" id="catalogo" className="container scroll-mt-20 space-y-4 pt-8">
        {(hasFilters || !categorias.enabled) && (
          <CategoryChips categories={categories} />
        )}
        <h2 className="text-base font-bold">
          {hasFilters ? heading : catalog.title}
        </h2>
        {products.length === 0 ? (
          <div className="grid place-items-center rounded-3xl bg-card p-12 text-center shadow-sm">
            <PackageSearch className="mb-3 size-8 text-muted-foreground" />
            <p className="font-medium">
              {hasFilters ? "Sin resultados" : "Catálogo en preparación"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters
                ? "Probá con otra búsqueda o categoría."
                : "Pronto vas a ver los productos acá."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <DiscoverProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        )}
      </section>
    ),

    about:
      theme.about.text && about.enabled ? (
        <section key="about" className="container pt-8">
          <div className="rounded-3xl bg-card p-6 shadow-sm">
            <h2 className="mb-2 text-base font-bold">{about.title}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {theme.about.text}
            </p>
          </div>
        </section>
      ) : null,
  };

  return (
    <main className="pb-10">
      {hasFilters ? nodes.catalog : theme.blockOrder.map((id) => nodes[id])}
    </main>
  );
}
