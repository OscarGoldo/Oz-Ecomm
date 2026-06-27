import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { PackageSearch } from "lucide-react";

import { CategoryChips } from "@/components/storefront/category-chips";
import { StreetProductCard } from "@/components/storefront/streetwear-product-card";
import { HeroSlides } from "@/components/storefront/hero-slides";
import { getImageUrl } from "@/lib/storage";
import type { Category, Product, Store } from "@/types/database";
import { getBlock, type StoreTheme } from "@/lib/theme";

interface StreetStorefrontProps {
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

export function StreetStorefront({
  store,
  theme,
  categories,
  products,
  featured,
  hasFilters,
  heading,
  banner,
  hero,
}: StreetStorefrontProps) {
  const productsByCategory = !hasFilters
    ? categories
        .map((cat) => ({
          ...cat,
          items: products.filter((p) => p.category_id === cat.id).slice(0, 8),
        }))
        .filter((c) => c.items.length > 0)
    : [];

  const heroImages = theme.media.heroSlides
    .map((p) => getImageUrl(p))
    .filter((u): u is string => Boolean(u));
  const galleryImages = theme.media.gallery
    .map((p) => getImageUrl(p))
    .filter((u): u is string => Boolean(u));

  const loNuevo = getBlock(theme, "lo-nuevo");
  const colecciones = getBlock(theme, "colecciones");
  const galeria = getBlock(theme, "galeria");
  const catalog = getBlock(theme, "catalog");
  const about = getBlock(theme, "about");

  const nodes: Record<string, ReactNode> = {
    "lo-nuevo":
      featured.length > 0 && loNuevo.enabled ? (
        <section key="lo-nuevo" className="border-b py-10">
          <div className="container">
            <h2 className="text-xl font-extrabold uppercase tracking-tight">
              {loNuevo.title}
            </h2>
            {loNuevo.subtitle && (
              <p className="text-sm text-muted-foreground">{loNuevo.subtitle}</p>
            )}
            <div className="mt-5 -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {featured.map((p) => (
                <div key={p.id} className="w-44 shrink-0 sm:w-52">
                  <StreetProductCard product={p} store={store} />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null,

    colecciones:
      productsByCategory.length > 0 && colecciones.enabled ? (
        <div key="colecciones">
          {productsByCategory.map((cat) => (
            <section key={cat.id} className="border-b py-8">
              <div className="container">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-extrabold uppercase tracking-tight">
                    {cat.name}
                  </h2>
                  <Link
                    href={`/${store.slug}?cat=${cat.slug}`}
                    className="text-sm font-bold text-primary hover:underline"
                  >
                    Ver todo
                  </Link>
                </div>
                <div className="mt-4 -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {cat.items.map((p) => (
                    <div key={p.id} className="w-44 shrink-0 sm:w-52">
                      <StreetProductCard product={p} store={store} />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : null,

    galeria:
      galleryImages.length >= 2 && galeria.enabled ? (
        <section key="galeria" className="border-b py-10">
          <div className="container">
            <h2 className="mb-5 text-xl font-extrabold uppercase tracking-tight">
              {galeria.title}
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {galleryImages.slice(0, 8).map((img, i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden rounded-2xl"
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
      ) : null,

    catalog: (
      <section key="catalog" id="catalogo" className="container scroll-mt-20 py-10">
        <CategoryChips categories={categories} />
        <h2 className="my-6 text-xl font-extrabold uppercase tracking-tight">
          {hasFilters ? heading : catalog.title}
        </h2>

        {products.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border-2 border-dashed py-16 text-center">
            <PackageSearch className="mb-3 size-8 text-muted-foreground/40" />
            <p className="font-bold uppercase">
              {hasFilters ? "Sin resultados" : "Próximamente"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters
                ? "Probá con otra búsqueda o categoría."
                : "Estamos preparando algo increíble."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <StreetProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        )}
      </section>
    ),

    about:
      theme.about.text && about.enabled ? (
        <section
          key="about"
          className="border-t bg-gradient-to-b from-primary/5 to-transparent py-12"
        >
          <div className="container mx-auto max-w-2xl text-center">
            <h2 className="text-xl font-extrabold uppercase tracking-tight">
              {about.title}
            </h2>
            {store.address && (
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-primary">
                {store.address}
              </p>
            )}
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {theme.about.text}
            </p>
          </div>
        </section>
      ) : null,
  };

  return (
    <main>
      {/* Vibrant hero */}
      {!hasFilters && (
        <section className="relative overflow-hidden">
          {heroImages.length || banner ? (
            <div className="relative min-h-[70vh]">
              <HeroSlides slides={heroImages} fallback={banner} alt={store.name} />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/30 to-transparent" />
              <div className="container relative flex min-h-[70vh] flex-col justify-end pb-10 text-white">
                <p className="text-xs font-extrabold uppercase tracking-widest text-white/70">
                  {store.name}
                </p>
                <h1 className="mt-1 max-w-lg text-3xl font-extrabold uppercase leading-[1.05] sm:text-5xl">
                  {hero.headline}
                </h1>
                {hero.subtext && (
                  <p className="mt-3 max-w-sm text-sm text-white/80">{hero.subtext}</p>
                )}
                <a
                  href="#catalogo"
                  className="mt-6 inline-block w-fit rounded-full bg-white px-8 py-3 text-sm font-extrabold uppercase tracking-wide text-primary shadow-lg transition-transform hover:scale-105"
                >
                  {hero.cta}
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-primary via-primary to-pink-400 px-4 py-16 text-white sm:py-20">
              <div className="container">
                <p className="text-xs font-extrabold uppercase tracking-widest text-white/60">
                  {store.name}
                </p>
                <h1 className="mt-2 max-w-lg text-3xl font-extrabold uppercase leading-[1.05] sm:text-5xl">
                  {hero.headline}
                </h1>
                {hero.subtext && (
                  <p className="mt-3 max-w-sm text-sm text-white/80">{hero.subtext}</p>
                )}
                <a
                  href="#catalogo"
                  className="mt-6 inline-block rounded-full bg-white px-8 py-3 text-sm font-extrabold uppercase tracking-wide text-primary shadow-lg transition-transform hover:scale-105"
                >
                  {hero.cta}
                </a>
              </div>
            </div>
          )}
        </section>
      )}

      {hasFilters ? nodes.catalog : theme.blockOrder.map((id) => nodes[id])}
    </main>
  );
}
