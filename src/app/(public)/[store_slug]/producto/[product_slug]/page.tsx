import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Price } from "@/components/storefront/price";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductViewTracker } from "@/components/storefront/event-tracker";
import { ProductActions } from "@/components/storefront/product-actions";
import { ProductCard } from "@/components/storefront/product-card";
import { VariantPurchase } from "@/components/storefront/variant-purchase";
import {
  getRelatedProducts,
  getStoreBySlug,
  getStoreCategories,
  getStoreProduct,
  getStoreProductVariants,
  isAvailable,
} from "@/lib/storefront";
import { getImageUrl } from "@/lib/storage";

export async function generateMetadata({
  params,
}: {
  params: { store_slug: string; product_slug: string };
}): Promise<Metadata> {
  const store = await getStoreBySlug(params.store_slug);
  if (!store) return { title: "No encontrado" };
  const product = await getStoreProduct(store.id, params.product_slug);
  if (!product) return { title: "Producto no encontrado" };
  return {
    title: { absolute: `${product.name} · ${store.name}` },
    description: product.description ?? product.name,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: { store_slug: string; product_slug: string };
}) {
  const store = await getStoreBySlug(params.store_slug);
  if (!store) notFound();

  const product = await getStoreProduct(store.id, params.product_slug);
  if (!product) notFound();

  const categories = await getStoreCategories(store.id);
  const category = product.category_id
    ? categories.find((c) => c.id === product.category_id)
    : null;

  const images = product.images
    .map((img) => getImageUrl(img))
    .filter((url): url is string => Boolean(url));
  const available = isAvailable(product);

  const hasVariants = Boolean(product.variant_options?.length);
  const variants = hasVariants ? await getStoreProductVariants(product.id) : [];

  const related = await getRelatedProducts(store.id, product, 8);

  return (
    <main className="container py-6">
      <ProductViewTracker storeId={store.id} productId={product.id} />
      <Link
        href={`/${store.slug}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver al catálogo
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={images} alt={product.name} />

        <div className="space-y-5">
          <div className="space-y-2">
            {category && (
              <span className="text-xs font-medium uppercase tracking-wide text-primary">
                {category.name}
              </span>
            )}
            <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
            {!hasVariants && (
              <Price
                amountUsd={product.price}
                compareAtUsd={product.compare_at_price}
                exchangeRate={store.exchange_rate}
                showBs={store.show_bs_prices}
                size="lg"
              />
            )}
          </div>

          {hasVariants && product.variant_options ? (
            <VariantPurchase
              storeId={store.id}
              storeSlug={store.slug}
              productId={product.id}
              productName={product.name}
              image={images[0] ?? null}
              basePrice={product.price}
              compareAtPrice={product.compare_at_price}
              exchangeRate={store.exchange_rate}
              showBs={store.show_bs_prices}
              options={product.variant_options}
              variants={variants.map((v) => ({
                id: v.id,
                option_values: v.option_values,
                price: v.price,
                stock: v.stock,
                active: v.active,
              }))}
            />
          ) : (
            <>
              {available ? (
                <Badge variant="success" className="gap-1">
                  <Check className="size-3.5" /> Disponible
                </Badge>
              ) : (
                <Badge variant="danger" className="gap-1">
                  <X className="size-3.5" /> Agotado
                </Badge>
              )}

              <ProductActions
                storeId={store.id}
                storeSlug={store.slug}
                productId={product.id}
                productName={product.name}
                image={images[0] ?? null}
                available={available}
                maxQty={product.track_stock ? product.stock : null}
              />
            </>
          )}

          {product.description && (
            <div className="space-y-2 border-t pt-5">
              <h2 className="text-sm font-semibold">Descripción</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-12 border-t pt-8">
          <h2 className="mb-5 text-lg font-bold tracking-tight">
            Productos similares
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
