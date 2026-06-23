import Image from "next/image";
import { PackageSearch } from "lucide-react";

import { CategoryChips } from "@/components/storefront/category-chips";
import { FashionProductCard } from "@/components/storefront/fashion-product-card";
import { getImageUrl } from "@/lib/storage";
import type { Category, Product, Store } from "@/types/database";
import type { StoreTheme } from "@/lib/theme";

interface FashionStorefrontProps {
  store: Store;
  theme: StoreTheme;
  categories: Pick<Category, "id" | "name" | "slug">[];
  products: Product[];
  hasFilters: boolean;
  heading: string;
  banner: string | null;
  hero: { headline: string; subtext: string; cta: string };
}

export function FashionStorefront({
  store,
  theme,
  categories,
  products,
  hasFilters,
  heading,
  banner,
  hero,
}: FashionStorefrontProps) {
  const lookbook = products
    .map((p) => getImageUrl(p.images[0]))
    .filter((u): u is string => Boolean(u))
    .slice(0, 6);

  return (
    <main>
      {/* Full-screen editorial hero */}
      {!hasFilters && (
        <section className="relative flex min-h-[78vh] items-end overflow-hidden">
          {banner ? (
            <Image src={banner} alt={store.name} fill priority className="object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/70" />
          )}
          <div className="absolute inset-0 bg-black/30" />
          <div className="container relative pb-12 text-white sm:pb-16">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.35em] text-white/80">
              {store.name}
            </p>
            <h1 className="max-w-2xl text-4xl font-light uppercase leading-[1.05] tracking-wide sm:text-6xl">
              {hero.headline}
            </h1>
            {hero.subtext && (
              <p className="mt-4 max-w-md text-sm text-white/85">{hero.subtext}</p>
            )}
            <a
              href="#catalogo"
              className="mt-7 inline-block border border-white px-8 py-3 text-xs font-medium uppercase tracking-[0.2em] transition-colors hover:bg-white hover:text-black"
            >
              {hero.cta}
            </a>
          </div>
        </section>
      )}

      {/* Catalog — editorial grid */}
      <section id="catalogo" className="container scroll-mt-20 py-12">
        <CategoryChips categories={categories} />
        <h2 className="my-8 text-center text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
          {heading}
        </h2>

        {products.length === 0 ? (
          <div className="grid place-items-center py-16 text-center">
            <PackageSearch className="mb-3 size-8 text-muted-foreground" />
            <p className="text-sm uppercase tracking-widest text-muted-foreground">
              {hasFilters ? "Sin resultados" : "Colección en camino"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
            {products.map((p) => (
              <FashionProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        )}
      </section>

      {/* Lookbook — lifestyle grid */}
      {!hasFilters && lookbook.length >= 4 && (
        <section className="container py-10">
          <h2 className="mb-6 text-center text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Lookbook
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {lookbook.map((img, i) => (
              <div
                key={i}
                className={`relative overflow-hidden ${
                  i === 0 ? "col-span-2 row-span-2 aspect-square sm:col-span-2 sm:row-span-2" : "aspect-square"
                }`}
              >
                <Image
                  src={img}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, 16vw"
                  className="object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* About */}
      {!hasFilters && theme.about.text && (
        <section className="container py-12">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
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
