import { PackageSearch, Sparkles } from "lucide-react";

import { CategoryChips } from "@/components/storefront/category-chips";
import { BeautyProductCard } from "@/components/storefront/beauty-product-card";
import type { Category, Product, Store } from "@/types/database";
import type { StoreTheme } from "@/lib/theme";

interface BeautyStorefrontProps {
  store: Store;
  theme: StoreTheme;
  categories: Pick<Category, "id" | "name" | "slug">[];
  products: Product[];
  featured: Product[];
  hasFilters: boolean;
  heading: string;
  hero: { headline: string; subtext: string; cta: string };
}

export function BeautyStorefront({
  store,
  theme,
  categories,
  products,
  featured,
  hasFilters,
  heading,
  hero,
}: BeautyStorefrontProps) {
  const routine = (featured.length >= 2 ? featured : products).slice(0, 6);

  return (
    <main>
      {/* Soft pastel hero */}
      {!hasFilters && (
        <section className="bg-gradient-to-b from-primary/10 to-transparent">
          <div className="container py-12 text-center sm:py-16">
            <h1 className="mx-auto max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">
              {hero.headline}
            </h1>
            {hero.subtext && (
              <p className="mx-auto mt-3 max-w-md text-muted-foreground">{hero.subtext}</p>
            )}
            <a
              href="#catalogo"
              className="mt-6 inline-block rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {hero.cta}
            </a>
          </div>
        </section>
      )}

      {/* Rutinas / Kits */}
      {!hasFilters && routine.length >= 2 && (
        <section className="container py-8">
          <div className="rounded-3xl bg-primary/5 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">Rutinas y kits</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Armá tu rutina con nuestros favoritos.
            </p>
            <div className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {routine.map((p) => (
                <div key={p.id} className="w-40 shrink-0 sm:w-44">
                  <BeautyProductCard product={p} store={store} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Catalog */}
      <section id="catalogo" className="container scroll-mt-20 space-y-4 py-6">
        <CategoryChips categories={categories} />
        <h2 className="text-lg font-semibold">{heading}</h2>

        {products.length === 0 ? (
          <div className="grid place-items-center rounded-3xl border border-dashed bg-card p-12 text-center">
            <PackageSearch className="mb-3 size-8 text-muted-foreground" />
            <p className="font-medium">
              {hasFilters ? "Sin resultados" : "Catálogo en preparación"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters
                ? "Prueba con otra búsqueda o categoría."
                : "Pronto vas a ver los productos aquí."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <BeautyProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        )}
      </section>

      {/* About */}
      {!hasFilters && theme.about.text && (
        <section className="container py-8">
          <div className="rounded-3xl bg-primary/5 p-6 text-center">
            <h2 className="mb-2 text-lg font-semibold">{theme.about.title}</h2>
            <p className="mx-auto max-w-xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {theme.about.text}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
