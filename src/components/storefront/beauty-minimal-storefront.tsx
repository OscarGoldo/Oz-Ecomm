import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { PackageSearch } from "lucide-react";

import { CategoryChips } from "@/components/storefront/category-chips";
import { BeautyMinimalProductCard } from "@/components/storefront/beauty-minimal-product-card";
import { HeroSlides } from "@/components/storefront/hero-slides";
import { getImageUrl } from "@/lib/storage";
import type { Category, Product, Store } from "@/types/database";
import { getBlock, type StoreTheme } from "@/lib/theme";

const SERIF = { fontFamily: "var(--font-heading, var(--font-lora))" } as const;

interface BeautyMinimalStorefrontProps {
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

export function BeautyMinimalStorefront({
  store,
  theme,
  categories,
  products,
  featured,
  hasFilters,
  heading,
  banner,
  hero,
}: BeautyMinimalStorefrontProps) {
  const heroImages = theme.media.heroSlides
    .map((p) => getImageUrl(p))
    .filter((u): u is string => Boolean(u));
  const galleryImages = theme.media.gallery
    .map((p) => getImageUrl(p))
    .filter((u): u is string => Boolean(u));
  const heroFallback =
    getImageUrl(featured[0]?.images?.[0]) ??
    banner ??
    getImageUrl(products[0]?.images?.[0]);

  const sets = products.filter((p) =>
    /\b(set|kit|combo|rutina|d[uú]o|tr[ií]o|pack)\b/i.test(
      `${p.name} ${p.description ?? ""}`,
    ),
  );
  const lookItems = (sets.length ? sets : featured.length ? featured : products).slice(
    0,
    4,
  );

  const categorias = getBlock(theme, "categorias");
  const shopAll = getBlock(theme, "shop-all");
  const getLook = getBlock(theme, "get-the-look");
  const catalog = getBlock(theme, "catalog");
  const testimonios = getBlock(theme, "testimonios");
  const historia = getBlock(theme, "historia");

  const nodes: Record<string, ReactNode> = {
    categorias:
      categories.length > 0 && categorias.enabled ? (
        <section key="categorias" className="py-10">
          <div className="container">
            {categorias.title && (
              <h2 className="mb-6 text-center text-xs uppercase tracking-[0.25em] text-muted-foreground">
                {categorias.title}
              </h2>
            )}
            <div className="flex flex-wrap justify-center gap-2.5">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/${store.slug}?cat=${cat.slug}`}
                  className="rounded-full border border-foreground/15 px-5 py-2 text-sm font-medium transition-colors hover:bg-foreground hover:text-background"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null,

    "shop-all":
      featured.length > 0 && shopAll.enabled ? (
        <section key="shop-all" className="py-12">
          <div className="container">
            <div className="mb-8 text-center">
              <h2 className="text-2xl tracking-tight sm:text-3xl" style={SERIF}>
                {shopAll.title}
              </h2>
              {shopAll.subtitle && (
                <p className="mt-2 text-sm text-muted-foreground">{shopAll.subtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {featured.map((p) => (
                <BeautyMinimalProductCard key={p.id} product={p} store={store} />
              ))}
            </div>
          </div>
        </section>
      ) : null,

    "get-the-look":
      lookItems.length >= 2 && getLook.enabled ? (
        <section key="get-the-look" className="bg-[#f7efe9] py-14">
          <div className="container">
            <div className="mb-8 text-center">
              <h2 className="text-2xl tracking-tight sm:text-3xl" style={SERIF}>
                {getLook.title}
              </h2>
              {getLook.subtitle && (
                <p className="mt-2 text-sm text-muted-foreground">{getLook.subtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-4">
              {lookItems.map((p) => (
                <BeautyMinimalProductCard key={p.id} product={p} store={store} />
              ))}
            </div>
          </div>
        </section>
      ) : null,

    catalog: (
      <section key="catalog" id="catalogo" className="container scroll-mt-20 py-12">
        <CategoryChips categories={categories} />
        <h2 className="my-8 text-center text-2xl tracking-tight sm:text-3xl" style={SERIF}>
          {hasFilters ? heading : catalog.title}
        </h2>

        {products.length === 0 ? (
          <div className="grid place-items-center py-20 text-center">
            <PackageSearch className="mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {hasFilters ? "Sin resultados" : "Pronto vas a ver los productos aquí."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <BeautyMinimalProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        )}
      </section>
    ),

    testimonios:
      theme.testimonials.length > 0 && testimonios.enabled ? (
        <section key="testimonios" className="bg-[#faf3ef] py-16">
          <div className="container">
            <h2
              className="mb-10 text-center text-2xl tracking-tight sm:text-3xl"
              style={SERIF}
            >
              {testimonios.title}
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {theme.testimonials.map((t, i) => (
                <figure
                  key={i}
                  className="rounded-2xl bg-white/70 p-6 text-center shadow-sm"
                >
                  <blockquote
                    className="text-lg leading-relaxed text-foreground/80"
                    style={SERIF}
                  >
                    “{t.quote}”
                  </blockquote>
                  {t.author && (
                    <figcaption className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      {t.author}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null,

    historia:
      theme.about.text && historia.enabled ? (
        <section key="historia" className="py-16">
          <div className="container">
            <div
              className={
                galleryImages[0]
                  ? "mx-auto grid max-w-4xl items-center gap-8 md:grid-cols-2"
                  : "mx-auto max-w-2xl text-center"
              }
            >
              {galleryImages[0] && (
                <div className="relative aspect-[4/5] overflow-hidden rounded-3xl">
                  <Image
                    src={galleryImages[0]}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
              )}
              <div className={galleryImages[0] ? "text-left" : ""}>
                <h2 className="text-2xl tracking-tight sm:text-3xl" style={SERIF}>
                  {historia.title}
                </h2>
                <p className="mt-4 whitespace-pre-line leading-relaxed text-foreground/70">
                  {theme.about.text}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null,
  };

  return (
    <main>
      {/* Soft hero with a single featured product */}
      {!hasFilters && (
        <section className="bg-gradient-to-b from-[#f7ece9] to-background">
          <div className="container grid items-center gap-8 py-12 md:grid-cols-2 md:py-16">
            <div className="order-2 md:order-1">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {store.name}
              </p>
              <h1 className="mt-3 text-4xl leading-[1.1] tracking-tight sm:text-5xl" style={SERIF}>
                {hero.headline}
              </h1>
              {hero.subtext && (
                <p className="mt-4 max-w-md text-foreground/70">{hero.subtext}</p>
              )}
              <a
                href="#catalogo"
                className="mt-7 inline-block rounded-full bg-foreground px-8 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                {hero.cta}
              </a>
            </div>

            {(heroImages.length || heroFallback) && (
              <div className="relative order-1 aspect-[4/5] overflow-hidden rounded-3xl bg-[#f1e6df] md:order-2">
                <HeroSlides
                  slides={heroImages}
                  fallback={heroFallback}
                  alt={store.name}
                  imageClassName={heroImages.length ? "object-cover" : "object-contain p-8"}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {hasFilters ? nodes.catalog : theme.blockOrder.map((id) => nodes[id])}
    </main>
  );
}
