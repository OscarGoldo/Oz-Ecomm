import Image from "next/image";
import { PackageSearch } from "lucide-react";

import { CategoryChips } from "@/components/storefront/category-chips";
import { AthleteEditorialProductCard } from "@/components/storefront/athlete-editorial-product-card";
import { getImageUrl } from "@/lib/storage";
import type { Category, Product, Store } from "@/types/database";
import type { StoreTheme } from "@/lib/theme";

interface AthleteEditorialStorefrontProps {
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

export function AthleteEditorialStorefront({
  store,
  theme,
  categories,
  products,
  featured,
  hasFilters,
  heading,
  banner,
  hero,
}: AthleteEditorialStorefrontProps) {
  const lifestyleImages = products
    .flatMap((p) => p.images.slice(0, 2))
    .map((img) => getImageUrl(img))
    .filter((u): u is string => Boolean(u))
    .slice(0, 4);

  return (
    <main>
      {/* Full-bleed hero */}
      {!hasFilters && (
        <section className="relative flex min-h-[85vh] items-end overflow-hidden">
          {banner ? (
            <Image
              src={banner}
              alt={store.name}
              fill
              priority
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-stone-800 to-stone-600" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="container relative pb-14 text-white sm:pb-20">
            <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-white/60">
              {store.name}
            </p>
            <h1 className="mt-2 max-w-xl text-3xl font-light leading-[1.1] sm:text-5xl">
              {hero.headline}
            </h1>
            {hero.subtext && (
              <p className="mt-4 max-w-sm text-sm font-light text-white/75">
                {hero.subtext}
              </p>
            )}
            <a
              href="#catalogo"
              className="mt-8 inline-block border border-white/80 px-8 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-stone-900"
            >
              {hero.cta}
            </a>
          </div>
        </section>
      )}

      {/* "Lo nuevo" — featured products horizontal scroll */}
      {!hasFilters && featured.length > 0 && (
        <section className="border-b py-12">
          <div className="container">
            <h2 className="text-center text-[11px] font-medium uppercase tracking-[0.3em] text-foreground/50">
              Lo nuevo
            </h2>
            <div className="mt-6 -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {featured.map((p) => (
                <div key={p.id} className="w-44 shrink-0 sm:w-56">
                  <AthleteEditorialProductCard product={p} store={store} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Catalog — clean grid with category tabs */}
      <section id="catalogo" className="container scroll-mt-20 py-12">
        <CategoryChips categories={categories} />
        <h2 className="my-8 text-center text-[11px] font-medium uppercase tracking-[0.3em] text-foreground/50">
          {heading}
        </h2>

        {products.length === 0 ? (
          <div className="grid place-items-center py-20 text-center">
            <PackageSearch className="mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {hasFilters ? "Sin resultados" : "Colección en camino"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <AthleteEditorialProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        )}
      </section>

      {/* Lifestyle grid — editorial imagery */}
      {!hasFilters && lifestyleImages.length >= 3 && (
        <section className="border-t bg-stone-50 py-12">
          <div className="container">
            <h2 className="mb-6 text-center text-[11px] font-medium uppercase tracking-[0.3em] text-foreground/50">
              En acción
            </h2>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {lifestyleImages.map((img, i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden rounded-sm"
                >
                  <Image
                    src={img}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Brand manifesto / about */}
      {!hasFilters && theme.about.text && (
        <section className="border-t py-16">
          <div className="container mx-auto max-w-2xl text-center">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.3em] text-foreground/50">
              {theme.about.title}
            </h2>
            <p className="mt-5 whitespace-pre-line text-base font-light leading-relaxed text-foreground/70">
              {theme.about.text}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
