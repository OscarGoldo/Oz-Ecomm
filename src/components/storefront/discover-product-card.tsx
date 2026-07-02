import Link from "next/link";
import Image from "next/image";
import { ImageOff } from "lucide-react";

import { Price } from "@/components/storefront/price";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { getImageUrl } from "@/lib/storage";
import { isAvailable } from "@/lib/storefront";
import { cn } from "@/lib/utils";
import type { Product, Store } from "@/types/database";

/**
 * Discover card (app-like): white rounded tile, product photo on a soft inner
 * panel, red "on sale" pill, pill-shaped add button.
 */
export function DiscoverProductCard({
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

  return (
    <div className="group relative flex flex-col rounded-2xl bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/${store.slug}/producto/${product.slug}`}
        className="absolute inset-0 z-10"
        aria-label={product.name}
      />

      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted/60">
        {cover ? (
          <Image
            src={cover}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className={cn(
              "object-contain p-3 transition-transform duration-300 group-hover:scale-105",
              !available && "opacity-50",
            )}
          />
        ) : (
          <span className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="size-8" />
          </span>
        )}

        {discount && available && (
          <span className="absolute left-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
            % −{discount}
          </span>
        )}
        {!available && (
          <span className="absolute inset-x-2 bottom-2 rounded-full bg-foreground/85 py-1 text-center text-[10px] font-semibold text-background">
            Agotado
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-1 pb-1 pt-2.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          {product.name}
        </p>

        <div className="mt-auto space-y-2 pt-1">
          <Price
            amountUsd={product.price}
            compareAtUsd={product.compare_at_price}
            exchangeRate={store.exchange_rate}
            showBs={store.show_bs_prices}
          />
          {available ? (
            <div className="relative z-20">
              <AddToCartButton
                storeId={store.id}
                storeSlug={store.slug}
                productId={product.id}
                productName={product.name}
                image={cover}
                hasVariants={Boolean(product.variant_options?.length)}
                href={`/${store.slug}/producto/${product.slug}`}
                className="rounded-full"
              />
            </div>
          ) : (
            <span className="flex h-9 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              Sin stock
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
