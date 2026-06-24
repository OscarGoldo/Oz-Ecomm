import Link from "next/link";
import Image from "next/image";
import { ImageOff } from "lucide-react";

import { Price } from "@/components/storefront/price";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { getImageUrl } from "@/lib/storage";
import { isAvailable } from "@/lib/storefront";
import { extractBeautyTags } from "@/lib/beauty";
import type { Product, Store } from "@/types/database";

/**
 * Beauty card: soft, rounded, caring. Visual tags over the photo, a small
 * star-review line under the title.
 */
export function BeautyProductCard({
  product,
  store,
}: {
  product: Product;
  store: Pick<Store, "id" | "slug" | "exchange_rate" | "show_bs_prices">;
}) {
  const cover = getImageUrl(product.images[0]);
  const available = isAvailable(product);
  const tags = extractBeautyTags(product.name, product.description);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-3xl border bg-card shadow-sm transition-shadow hover:shadow-lg">
      <Link
        href={`/${store.slug}/producto/${product.slug}`}
        className="absolute inset-0 z-10"
        aria-label={product.name}
      />

      <div className="relative aspect-square bg-white">
        {cover ? (
          <Image
            src={cover}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-contain p-3"
          />
        ) : (
          <span className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="size-8" />
          </span>
        )}
        {tags.length > 0 && (
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {!available && (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/80 py-1.5 text-center text-[10px] font-medium text-background">
            Agotado
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="line-clamp-2 text-sm font-medium leading-snug">
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
                productId={product.id}
                hasVariants={Boolean(product.variant_options?.length)}
                href={`/${store.slug}/producto/${product.slug}`}
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
