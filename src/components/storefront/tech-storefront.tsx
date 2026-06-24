import { PackageSearch, Truck, Wallet } from "lucide-react";

import { CategoryChips } from "@/components/storefront/category-chips";
import { StoreSearch } from "@/components/storefront/store-search";
import { TechProductCard } from "@/components/storefront/tech-product-card";
import type { Category, Product, Store } from "@/types/database";
import type { StoreTheme } from "@/lib/theme";

interface TechStorefrontProps {
  store: Store;
  theme: StoreTheme;
  categories: Pick<Category, "id" | "name" | "slug">[];
  products: Product[];
  hasFilters: boolean;
  heading: string;
  hero: { headline: string; subtext: string };
}

export function TechStorefront({
  store,
  theme,
  categories,
  products,
  hasFilters,
  heading,
  hero,
}: TechStorefrontProps) {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const freeShipping =
    store.offers_delivery && Number(store.delivery_fee ?? 0) === 0;

  return (
    <main>
      {/* Search-first dark hero */}
      <section className="bg-[#0b1220] text-white">
        <div className="container py-7 sm:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            {store.name}
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
            {hero.headline}
          </h1>
          <div className="mt-5 max-w-2xl">
            <StoreSearch big placeholder="Buscar productos, marcas, modelos…" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {freeShipping && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-foreground">
                <Truck className="size-4" /> Envío gratis
              </span>
            )}
            {store.show_bs_prices && store.exchange_rate && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
                <Wallet className="size-4" /> Precios en USD y Bs
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Catalog */}
      <section id="catalogo" className="container scroll-mt-20 space-y-4 py-6">
        <CategoryChips categories={categories} />
        <h2 className="text-base font-bold uppercase tracking-wide">{heading}</h2>

        {products.length === 0 ? (
          <div className="grid place-items-center rounded-md border-2 border-dashed bg-card p-12 text-center">
            <PackageSearch className="mb-3 size-8 text-muted-foreground" />
            <p className="font-semibold">
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
              <TechProductCard
                key={p.id}
                product={p}
                store={store}
                category={p.category_id ? (catName.get(p.category_id) ?? null) : null}
                freeShipping={freeShipping}
              />
            ))}
          </div>
        )}
      </section>

      {/* About */}
      {!hasFilters && theme.about.text && (
        <section className="container py-8">
          <div className="rounded-md border-2 bg-card p-6">
            <h2 className="mb-2 text-base font-bold uppercase tracking-wide">
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
