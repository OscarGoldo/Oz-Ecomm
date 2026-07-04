import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, PackageSearch, Star } from "lucide-react";

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

/** Bold uppercase section heading with a magenta accent bar. */
function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="flex items-center gap-3 text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">
        <span
          className="inline-block h-6 w-1.5"
          style={{ background: "hsl(var(--brand-accent))" }}
        />
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 pl-[18px] text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
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
          items: products.filter((p) => p.category_id === cat.id).slice(0, 10),
        }))
        .filter((c) => c.items.length > 0)
    : [];

  const heroImages = theme.media.heroSlides
    .map((p) => getImageUrl(p))
    .filter((u): u is string => Boolean(u));
  const galleryImages = theme.media.gallery
    .map((p) => getImageUrl(p))
    .filter((u): u is string => Boolean(u));
  const heroVideo = theme.heroVideoUrl.trim();

  const loNuevo = getBlock(theme, "lo-nuevo");
  const colecciones = getBlock(theme, "colecciones");
  const galeria = getBlock(theme, "galeria");
  const catalog = getBlock(theme, "catalog");
  const testimonios = getBlock(theme, "testimonios");
  const locales = getBlock(theme, "locales");
  const marca = getBlock(theme, "marca");

  const nodes: Record<string, ReactNode> = {
    "lo-nuevo":
      featured.length > 0 && loNuevo.enabled ? (
        <section key="lo-nuevo" className="border-b py-10">
          <div className="container">
            <SectionHead title={loNuevo.title} subtitle={loNuevo.subtitle} />
            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {featured.map((p) => (
                <div key={p.id} className="w-44 shrink-0 sm:w-56">
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
            <section key={cat.id} className="border-b py-9">
              <div className="container">
                <div className="mb-5 flex items-end justify-between">
                  <h2 className="flex items-center gap-3 text-xl font-extrabold uppercase tracking-tight sm:text-2xl">
                    <span
                      className="inline-block h-5 w-1.5"
                      style={{ background: "hsl(var(--brand-accent))" }}
                    />
                    {cat.name}
                  </h2>
                  <Link
                    href={`/${store.slug}?cat=${cat.slug}`}
                    className="text-xs font-extrabold uppercase tracking-widest hover:underline"
                    style={{ color: "hsl(var(--brand-accent))" }}
                  >
                    Ver todo →
                  </Link>
                </div>
                <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {cat.items.map((p) => (
                    <div key={p.id} className="w-44 shrink-0 sm:w-56">
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
            <SectionHead title={galeria.title} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {galleryImages.slice(0, 8).map((img, i) => (
                <div key={i} className="relative aspect-square overflow-hidden">
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
        <div className="my-6">
          {hasFilters ? (
            <h2 className="text-2xl font-extrabold uppercase tracking-tight">{heading}</h2>
          ) : (
            <SectionHead title={catalog.title} />
          )}
        </div>

        {products.length === 0 ? (
          <div className="grid place-items-center border-2 border-dashed py-16 text-center">
            <PackageSearch className="mb-3 size-8 text-muted-foreground/40" />
            <p className="font-extrabold uppercase">
              {hasFilters ? "Sin resultados" : "Próximamente"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters
                ? "Prueba con otra búsqueda o categoría."
                : "Se viene algo grande 👀"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <StreetProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        )}
      </section>
    ),

    testimonios:
      theme.testimonials.length > 0 && testimonios.enabled ? (
        <section key="testimonios" className="border-b bg-foreground py-12 text-background">
          <div className="container">
            <h2 className="mb-8 text-center text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">
              {testimonios.title}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {theme.testimonials.map((t, i) => (
                <figure key={i} className="border border-background/15 p-5">
                  <div
                    className="mb-2 flex gap-0.5"
                    style={{ color: "hsl(var(--brand-accent))" }}
                  >
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} className="size-4 fill-current" />
                    ))}
                  </div>
                  <blockquote className="text-sm leading-relaxed text-background/90">
                    “{t.quote}”
                  </blockquote>
                  {t.author && (
                    <figcaption className="mt-3 text-xs font-extrabold uppercase tracking-widest text-background/60">
                      {t.author}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null,

    locales:
      theme.locations.length > 0 && locales.enabled ? (
        <section key="locales" className="border-b py-12">
          <div className="container">
            <SectionHead title={locales.title} subtitle={locales.subtitle} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {theme.locations.map((l, i) => (
                <div key={i} className="flex items-start gap-3 border p-4">
                  <MapPin
                    className="mt-0.5 size-5 shrink-0"
                    style={{ color: "hsl(var(--brand-accent))" }}
                  />
                  <div className="min-w-0">
                    <p className="font-extrabold uppercase tracking-wide">{l.name}</p>
                    {l.address && (
                      <p className="text-sm text-muted-foreground">{l.address}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null,

    marca:
      (theme.about.text || marca.subtitle) && marca.enabled ? (
        <section
          key="marca"
          className="py-16 text-center"
          style={{ background: "hsl(var(--brand-accent))" }}
        >
          <div className="container mx-auto max-w-2xl text-white">
            <h2 className="text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">
              {marca.title}
            </h2>
            {marca.subtitle && (
              <p className="mt-2 text-sm font-bold uppercase tracking-[0.25em] text-white/80">
                {marca.subtitle}
              </p>
            )}
            {theme.about.text && (
              <p className="mt-5 whitespace-pre-line leading-relaxed text-white/90">
                {theme.about.text}
              </p>
            )}
          </div>
        </section>
      ) : null,
  };

  return (
    <main>
      {/* Bold hero: video → carousel → gradient */}
      {!hasFilters && (
        <section className="relative flex min-h-[78vh] items-end overflow-hidden bg-foreground">
          {heroVideo ? (
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src={heroVideo}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : heroImages.length || banner ? (
            <HeroSlides slides={heroImages} fallback={banner} alt={store.name} />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-foreground to-foreground/70" />
          )}
          <div className="absolute inset-0 bg-black/35" />
          <div className="container relative pb-12 text-white sm:pb-16">
            <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-white/70">
              {store.name}
            </p>
            <h1 className="mt-2 max-w-2xl text-4xl font-extrabold uppercase leading-[0.95] sm:text-6xl">
              {hero.headline}
            </h1>
            {hero.subtext && (
              <p className="mt-3 max-w-md text-sm text-white/85">{hero.subtext}</p>
            )}
            <a
              href="#catalogo"
              className="mt-7 inline-block px-9 py-3.5 text-sm font-extrabold uppercase tracking-widest text-white transition-transform hover:scale-105"
              style={{ background: "hsl(var(--brand-accent))" }}
            >
              {hero.cta}
            </a>
          </div>
        </section>
      )}

      {hasFilters ? nodes.catalog : theme.blockOrder.map((id) => nodes[id])}
    </main>
  );
}
