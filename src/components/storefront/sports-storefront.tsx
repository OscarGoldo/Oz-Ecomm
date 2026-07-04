import Image from "next/image";
import { PackageSearch } from "lucide-react";

import { SportsCategoryCarousel } from "@/components/storefront/sports-category-carousel";
import { SportsProductCard } from "@/components/storefront/sports-product-card";
import type { Category, Product, Store } from "@/types/database";
import type { StoreTheme } from "@/lib/theme";

interface SportsStorefrontProps {
  store: Store;
  theme: StoreTheme;
  categories: Pick<Category, "id" | "name" | "slug">[];
  products: Product[];
  hasFilters: boolean;
  heading: string;
  banner: string | null;
  hero: { headline: string; subtext: string; cta: string };
}

export function SportsStorefront({
  store,
  theme,
  categories,
  products,
  hasFilters,
  heading,
  banner,
  hero,
}: SportsStorefrontProps) {
  return (
    <main>
      {/* Energetic hero with a diagonal accent */}
      {!hasFilters && (
        <section className="relative overflow-hidden bg-primary text-primary-foreground">
          {banner && (
            <Image src={banner} alt={store.name} fill priority className="object-cover opacity-25" />
          )}
          <div className="absolute inset-y-0 right-0 hidden w-1/3 -skew-x-12 bg-foreground/15 sm:block" />
          <div className="container relative py-10 sm:py-14">
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-primary-foreground/70">
              {store.name}
            </p>
            <h1 className="mt-1 max-w-2xl text-3xl font-extrabold uppercase italic leading-[0.95] sm:text-5xl">
              {hero.headline}
            </h1>
            {hero.subtext && (
              <p className="mt-3 max-w-md font-medium text-primary-foreground/90">
                {hero.subtext}
              </p>
            )}
            <a
              href="#catalogo"
              className="mt-6 inline-block -skew-x-6 bg-foreground px-8 py-3 text-sm font-extrabold uppercase italic tracking-wide text-background transition-transform hover:scale-105"
            >
              {hero.cta}
            </a>
          </div>
        </section>
      )}

      {/* Quick category carousel — prominent, top */}
      <section className="border-b-2 bg-card">
        <div className="container py-3">
          <SportsCategoryCarousel categories={categories} />
        </div>
      </section>

      {/* Catalog */}
      <section id="catalogo" className="container scroll-mt-20 space-y-4 py-6">
        <h2 className="text-lg font-extrabold uppercase italic tracking-wide">{heading}</h2>

        {products.length === 0 ? (
          <div className="grid place-items-center rounded-lg border-2 border-dashed bg-card p-12 text-center">
            <PackageSearch className="mb-3 size-8 text-muted-foreground" />
            <p className="font-bold uppercase">
              {hasFilters ? "Sin resultados" : "Catálogo en preparación"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters
                ? "Prueba con otra categoría."
                : "Pronto vas a ver los productos aquí."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <SportsProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        )}
      </section>

      {/* About */}
      {!hasFilters && theme.about.text && (
        <section className="container py-8">
          <div className="rounded-lg border-2 bg-card p-6">
            <h2 className="mb-2 text-lg font-extrabold uppercase italic tracking-wide">
              {theme.about.title}
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {theme.about.text}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
