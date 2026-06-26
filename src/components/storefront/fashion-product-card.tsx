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
 * Editorial fashion card: tall 3:4 photo, minimalist centered typography.
 * The whole card links to the detail; a slim add button sits above the link.
 */
export function FashionProductCard({
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
    <div className="group relative">
      <Link
        href={`/${store.slug}/producto/${product.slug}`}
        className="absolute inset-0 z-10"
        aria-label={product.name}
      />

      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {cover ? (
          <Image
            src={cover}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className={cn(
              "object-cover transition-transform duration-500 group-hover:scale-105",
              !available && "opacity-50",
            )}
          />
        ) : (
          <span className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="size-8" />
          </span>
        )}

        {discount && available && (
          <span className="absolute left-0 top-3 bg-foreground px-2 py-1 text-[10px] font-medium uppercase tracking-widest text-background">
            -{discount}%
          </span>
        )}
        {!available && (
          <span className="absolute inset-x-0 bottom-0 bg-background/85 py-1.5 text-center text-[10px] font-medium uppercase tracking-widest">
            Agotado
          </span>
        )}
      </div>

      <div className="mt-3 text-center">
        <p className="line-clamp-1 text-[11px] uppercase tracking-[0.18em] text-foreground/80">
          {product.name}
        </p>
        <div className="mt-1.5 flex justify-center">
          <Price
            amountUsd={product.price}
            compareAtUsd={product.compare_at_price}
            exchangeRate={store.exchange_rate}
            showBs={store.show_bs_prices}
          />
        </div>
        {available && (
          <div className="relative z-20 mx-auto mt-2.5 max-w-[12rem]">
            <AddToCartButton
              storeId={store.id}
              storeSlug={store.slug}
              productId={product.id}
              productName={product.name}
              image={cover}
              hasVariants={Boolean(product.variant_options?.length)}
              href={`/${store.slug}/producto/${product.slug}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
