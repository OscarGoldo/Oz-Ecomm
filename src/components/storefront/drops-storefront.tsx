import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { PackageSearch } from "lucide-react";

import { CategoryChips } from "@/components/storefront/category-chips";
import { DropsProductCard } from "@/components/storefront/drops-product-card";
import { DropsCountdown } from "@/components/storefront/drops-countdown";
import type { Category, Product, Store } from "@/types/database";
import { getBlock, type StoreTheme } from "@/lib/theme";

interface DropsStorefrontProps {
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

/** Two-letter "escudo" initials for a category. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function DropsStorefront({
  store,
  theme,
  categories,
  products,
  featured,
  hasFilters,
  heading,
  banner,
  hero,
}: DropsStorefrontProps) {
  const recent = !hasFilters ? products.slice(0, 8) : [];
  const collections = !hasFilters
    ? categories
        .map((cat) => ({
          ...cat,
          items: products.filter((p) => p.category_id === cat.id).slice(0, 8),
        }))
        .filter((c) => c.items.length > 0)
    : [];

  const ligas = getBlock(theme, "ligas");
  const recien = getBlock(theme, "recien");
  const masVendidos = getBlock(theme, "mas-vendidos");
  const colecciones = getBlock(theme, "colecciones");
  const catalog = getBlock(theme, "catalog");
  const archivo = getBlock(theme, "archivo");
  const countdown = getBlock(theme, "countdown");

  const nodes: Record<string, ReactNode> = {
    ligas:
      categories.length > 0 && ligas.enabled ? (
        <section key="ligas" className="border-b border-white/10">
          <div className="container py-5">
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/${store.slug}?cat=${cat.slug}`}
                  className="group flex w-20 shrink-0 flex-col items-center gap-2"
                >
                  <span
                    className="grid size-16 place-items-center rounded-full border-2 border-white/15 bg-white/5 text-lg font-extrabold transition-colors group-hover:border-[hsl(var(--brand-accent))]"
                    style={{ color: "hsl(var(--brand-accent))" }}
                  >
                    {initials(cat.name)}
                  </span>
                  <span className="line-clamp-1 text-center text-[11px] font-bold uppercase tracking-wide text-white/70">
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null,

    recien:
      recent.length > 0 && recien.enabled ? (
        <DropsRow key="recien" store={store} title={recien.title} items={recent} />
      ) : null,

    "mas-vendidos":
      featured.length > 0 && masVendidos.enabled ? (
        <DropsRow
          key="mas-vendidos"
          store={store}
          title={masVendidos.title}
          items={featured}
          accent
        />
      ) : null,

    colecciones:
      collections.length > 0 && colecciones.enabled ? (
        <div key="colecciones">
          {collections.map((cat) => (
            <DropsRow
              key={cat.id}
              store={store}
              title={cat.name}
              items={cat.items}
              href={`/${store.slug}?cat=${cat.slug}`}
            />
          ))}
        </div>
      ) : null,

    catalog: (
      <section key="catalog" id="catalogo" className="container scroll-mt-20 py-10">
        <CategoryChips categories={categories} />
        <h2 className="my-6 text-xl font-extrabold uppercase tracking-tight text-white">
          {hasFilters ? heading : catalog.title}
        </h2>

        {products.length === 0 ? (
          <div className="grid place-items-center rounded-lg border border-dashed border-white/15 py-16 text-center">
            <PackageSearch className="mb-3 size-8 text-white/30" />
            <p className="font-bold uppercase text-white">
              {hasFilters ? "Sin resultados" : "Próximo drop en camino"}
            </p>
            <p className="mt-1 text-sm text-white/50">
              {hasFilters
                ? "Probá con otra búsqueda o categoría."
                : "Seguinos para no perderte el lanzamiento."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((p) => (
              <DropsProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        )}
      </section>
    ),

    archivo:
      theme.about.text && archivo.enabled ? (
        <section
          key="archivo"
          className="border-t border-white/10 bg-white/[0.02] py-14"
        >
          <div className="container mx-auto max-w-2xl text-center">
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.3em]"
              style={{ color: "hsl(var(--brand-accent))" }}
            >
              {archivo.title}
            </p>
            <h2 className="mt-2 text-2xl font-extrabold uppercase text-white">
              {theme.about.title}
            </h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/60">
              {theme.about.text}
            </p>
          </div>
        </section>
      ) : null,
  };

  return (
    <main className="bg-background text-foreground">
      {/* Hero — campaign + countdown */}
      {!hasFilters && (
        <section className="relative overflow-hidden border-b border-white/10">
          {banner ? (
            <Image src={banner} alt={store.name} fill priority className="object-cover opacity-40" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
          <div className="container relative py-14 sm:py-20">
            <p
              className="text-xs font-extrabold uppercase tracking-[0.3em]"
              style={{ color: "hsl(var(--brand-accent))" }}
            >
              {store.name} · Drop activo
            </p>
            <h1 className="mt-2 max-w-2xl text-4xl font-extrabold uppercase leading-[0.95] text-white sm:text-6xl">
              {hero.headline}
            </h1>
            {hero.subtext && (
              <p className="mt-3 max-w-md text-sm text-white/70">{hero.subtext}</p>
            )}

            <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
              <a
                href="#catalogo"
                className="inline-block w-fit rounded-md px-8 py-3 text-sm font-extrabold uppercase tracking-wide text-neutral-950 transition-transform hover:scale-105"
                style={{ background: "hsl(var(--brand-accent))" }}
              >
                {hero.cta}
              </a>
              {countdown.enabled && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50">
                    El drop termina en
                  </p>
                  <DropsCountdown />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {hasFilters ? nodes.catalog : theme.blockOrder.map((id) => nodes[id])}
    </main>
  );
}

/** A horizontal collection row used across the Drops home. */
function DropsRow({
  store,
  title,
  items,
  href,
  accent,
}: {
  store: Store;
  title: string;
  items: Product[];
  href?: string;
  accent?: boolean;
}) {
  return (
    <section className="border-b border-white/10 py-8">
      <div className="container">
        <div className="flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-tight text-white">
            {accent && (
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ background: "hsl(var(--brand-accent))" }}
              />
            )}
            {title}
          </h2>
          {href && (
            <Link
              href={href}
              className="text-sm font-bold uppercase tracking-wide hover:underline"
              style={{ color: "hsl(var(--brand-accent))" }}
            >
              Ver todo
            </Link>
          )}
        </div>
        <div className="mt-4 -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((p) => (
            <div key={p.id} className="w-40 shrink-0 sm:w-48">
              <DropsProductCard product={p} store={store} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
