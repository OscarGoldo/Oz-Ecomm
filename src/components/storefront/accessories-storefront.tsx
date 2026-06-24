import { PackageSearch } from "lucide-react";

import { CategoryChips } from "@/components/storefront/category-chips";
import { AccessoriesProductCard } from "@/components/storefront/accessories-product-card";
import type { Category, Product, Store } from "@/types/database";
import type { StoreTheme } from "@/lib/theme";

interface AccessoriesStorefrontProps {
  store: Store;
  theme: StoreTheme;
  categories: Pick<Category, "id" | "name" | "slug">[];
  products: Product[];
  hasFilters: boolean;
  heading: string;
  hero: { headline: string; subtext: string; cta: string };
}

export function AccessoriesStorefront({
  store,
  theme,
  categories,
  products,
  hasFilters,
  heading,
  hero,
}: AccessoriesStorefrontProps) {
  return (
    <main>
      {/* Minimal, airy hero */}
      {!hasFilters && (
        <section className="border-b">
          <div className="container py-16 text-center sm:py-24">
            <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
              {store.name}
            </p>
            <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-normal leading-tight sm:text-5xl">
              {hero.headline}
            </h1>
            {hero.subtext && (
              <p className="mx-auto mt-5 max-w-md text-sm text-muted-foreground">
                {hero.subtext}
              </p>
            )}
            <a
              href="#catalogo"
              className="mt-8 inline-block border-b-2 border-foreground pb-1 text-xs uppercase tracking-[0.2em] transition-colors hover:border-primary hover:text-primary"
            >
              {hero.cta}
            </a>
          </div>
        </section>
      )}

      {/* Catalog — airy grid */}
      <section id="catalogo" className="container scroll-mt-20 py-12 sm:py-16">
        <div className="flex justify-center">
          <CategoryChips categories={categories} />
        </div>
        <h2 className="my-10 text-center text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          {heading}
        </h2>

        {products.length === 0 ? (
          <div className="grid place-items-center py-16 text-center">
            <PackageSearch className="mb-3 size-8 text-muted-foreground" />
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              {hasFilters ? "Sin resultados" : "Colección en camino"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 sm:gap-x-10 sm:gap-y-16">
            {products.map((p) => (
              <AccessoriesProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        )}
      </section>

      {/* About */}
      {!hasFilters && theme.about.text && (
        <section className="container pb-16">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              {theme.about.title}
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {theme.about.text}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
