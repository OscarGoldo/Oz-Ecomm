import Link from "next/link";
import Image from "next/image";
import { ImageOff } from "lucide-react";

import { Price } from "@/components/storefront/price";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { getImageUrl } from "@/lib/storage";
import { isAvailable } from "@/lib/storefront";
import type { Product, Store } from "@/types/database";

/**
 * Sports card: energetic. Skewed/italic offer tag, dynamic low-stock bar,
 * bold quick-add button.
 */
export function SportsProductCard({
  product,
  store,
}: {
  product: Product;
  store: Pick<Store, "id" | "slug" | "exchange_rate" | "show_bs_prices">;
}) {
  const cover = getImageUrl(product.images[0]);
  const available = isAvailable(product);
  const discount =
    product.compare_at_price && product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : null;

  const lowStock =
    product.track_stock &&
    product.stock > 0 &&
    product.stock <= product.low_stock_threshold;
  const stockPct = lowStock
    ? Math.min(100, Math.round((product.stock / Math.max(product.low_stock_threshold, 1)) * 100))
    : 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border-2 bg-card transition-transform duration-200 hover:-translate-y-1">
      <Link
        href={`/${store.slug}/producto/${product.slug}`}
        className="absolute inset-0 z-10"
        aria-label={product.name}
      />

      <div className="relative aspect-square overflow-hidden bg-white">
        {cover ? (
          <Image
            src={cover}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="size-8" />
          </span>
        )}

        {discount && available && (
          <span className="absolute -left-1 top-2 -skew-x-12 bg-primary px-3 py-1 text-xs font-extrabold uppercase italic tracking-wide text-primary-foreground shadow-md">
            -{discount}%
          </span>
        )}
        {!available && (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/85 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-background">
            Agotado
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm font-bold uppercase leading-snug">
          {product.name}
        </p>

        {lowStock && (
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-destructive transition-all"
                style={{ width: `${stockPct}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] font-extrabold uppercase italic text-destructive">
              ¡Solo quedan {product.stock}!
            </p>
          </div>
        )}

        <div className="mt-auto space-y-2 pt-1">
          <Price
            amountUsd={product.price}
            compareAtUsd={product.compare_at_price}
            exchangeRate={store.exchange_rate}
            showBs={store.show_bs_prices}
          />
          {available ? (
            <div className="relative z-20">
              <AddToCartButton storeId={store.id} productId={product.id} />
            </div>
          ) : (
            <span className="flex h-9 items-center justify-center rounded-md bg-muted text-xs font-bold uppercase text-muted-foreground">
              Sin stock
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
