import Link from "next/link";
import Image from "next/image";
import { ImageOff } from "lucide-react";

import { Price } from "@/components/storefront/price";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { getImageUrl } from "@/lib/storage";
import { isAvailable } from "@/lib/storefront";
import { cn } from "@/lib/utils";
import type { Product, Store } from "@/types/database";

interface ProductCardProps {
  product: Product;
  store: Pick<Store, "id" | "slug" | "exchange_rate" | "show_bs_prices">;
}

export function ProductCard({ product, store }: ProductCardProps) {
  const cover = getImageUrl(product.images[0]);
  const available = isAvailable(product);
  const discount =
    product.compare_at_price && product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : null;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg">
      {/* Click target covering the card (kept below the add button) */}
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
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={cn(
              "object-contain p-2 transition-transform duration-300 group-hover:scale-105",
              !available && "opacity-50",
            )}
          />
        ) : (
          <span className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="size-8" />
          </span>
        )}

        {discount && available && (
          <span className="absolute left-2 top-2 rounded-md bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground shadow">
            -{discount}%
          </span>
        )}
        {!available && (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/80 py-1 text-center text-xs font-semibold text-background">
            Agotado
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-foreground">
          {product.name}
        </p>

        <div className="mt-auto space-y-2">
          <Price
            amountUsd={product.price}
            compareAtUsd={product.compare_at_price}
            exchangeRate={store.exchange_rate}
            showBs={store.show_bs_prices}
          />
          {available ? (
            <AddToCartButton storeId={store.id} productId={product.id} />
          ) : (
            <span className="flex h-9 items-center justify-center rounded-lg bg-muted text-xs font-medium text-muted-foreground">
              Sin stock
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
