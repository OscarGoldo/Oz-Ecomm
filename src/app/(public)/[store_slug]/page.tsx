import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  BadgeDollarSign,
  PackageSearch,
  ShieldCheck,
  Store as StoreIcon,
  Truck,
} from "lucide-react";

import { CategoryChips } from "@/components/storefront/category-chips";
import { ProductCard } from "@/components/storefront/product-card";
import {
  getStoreBySlug,
  getStoreCategories,
  getStoreProducts,
} from "@/lib/storefront";
import { getImageUrl } from "@/lib/storage";
import { formatBs } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: { store_slug: string };
}): Promise<Metadata> {
  const store = await getStoreBySlug(params.store_slug);
  if (!store) return { title: "Tienda no encontrada" };
  return {
    title: { absolute: store.name },
    description: store.description ?? `Catálogo de ${store.name}`,
  };
}

export default async function StorefrontHome({
  params,
  searchParams,
}: {
  params: { store_slug: string };
  searchParams: { q?: string; cat?: string };
}) {
  const store = await getStoreBySlug(params.store_slug);
  if (!store) notFound();

  const q = searchParams.q?.trim() || undefined;
  const catSlug = searchParams.cat || undefined;
  const hasFilters = Boolean(q || catSlug);

  const [categories, products] = await Promise.all([
    getStoreCategories(store.id),
    getStoreProducts(store.id, { q, categorySlug: catSlug }),
  ]);

  const banner = getImageUrl(store.banner_url);
  const featured = !hasFilters
    ? products.filter((p) => p.featured && (!p.track_stock || p.stock > 0)).slice(0, 10)
    : [];

  const activeCategory = catSlug
    ? categories.find((c) => c.slug === catSlug)?.name
    : null;
  const heading = q
    ? `Resultados para “${q}”`
    : activeCategory ?? "Todos los productos";

  const benefits = [
    store.offers_delivery
      ? { icon: Truck, title: "Delivery", text: store.delivery_note || "Llevamos tu pedido" }
      : null,
    store.offers_pickup
      ? { icon: StoreIcon, title: "Retiro en tienda", text: "Buscá tu pedido cuando quieras" }
      : null,
    { icon: BadgeDollarSign, title: "Precios en USD y Bs", text: "Pagás como te quede mejor" },
    { icon: ShieldCheck, title: "Compra segura", text: "Confirmás tu pago y recibís" },
  ].filter(Boolean) as { icon: typeof Truck; title: string; text: string }[];

  return (
    <main className="pb-4">
      {/* Hero */}
      {!hasFilters &&
        (banner ? (
          <section className="relative h-44 w-full sm:h-64">
            <Image src={banner} alt={store.name} fill priority className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="container relative flex h-full flex-col justify-end pb-5 text-white">
              <h1 className="text-2xl font-extrabold sm:text-4xl">{store.name}</h1>
              {store.description && (
                <p className="max-w-lg text-sm text-white/90">{store.description}</p>
              )}
            </div>
          </section>
        ) : (
          <section className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <div className="container py-10 sm:py-14">
              {store.address && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground/80">
                  {store.address}
                </p>
              )}
              <h1 className="max-w-2xl text-2xl font-extrabold leading-tight sm:text-4xl">
                {store.description || `Bienvenido a ${store.name}`}
              </h1>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href="#catalogo"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary shadow-sm transition-opacity hover:opacity-90"
                >
                  Ver productos
                </a>
                {store.show_bs_prices && store.exchange_rate && (
                  <span className="text-sm text-primary-foreground/90">
                    Tasa de hoy: {formatBs(store.exchange_rate)} / USD
                  </span>
                )}
              </div>
            </div>
          </section>
        ))}

      {/* Benefits */}
      {!hasFilters && (
        <section className="border-b bg-card">
          <div className="container grid grid-cols-2 gap-3 py-4 lg:grid-cols-4">
            {benefits.map((b) => (
              <div key={b.title} className="flex items-start gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <b.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{b.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{b.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Featured */}
      {featured.length > 0 && (
        <section className="container pt-6">
          <h2 className="mb-3 text-lg font-bold tracking-tight">Destacados</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {featured.map((p) => (
              <div key={p.id} className="w-40 shrink-0 sm:w-48">
                <ProductCard product={p} store={store} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Catalog */}
      <section id="catalogo" className="container scroll-mt-20 space-y-4 pt-6">
        <CategoryChips categories={categories} />
        <h2 className="text-lg font-bold tracking-tight">{heading}</h2>

        {products.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed bg-card p-12 text-center">
            <PackageSearch className="mb-3 size-8 text-muted-foreground" />
            <p className="font-medium">
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
              <ProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
