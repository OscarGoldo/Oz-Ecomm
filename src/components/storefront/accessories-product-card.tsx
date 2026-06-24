import Link from "next/link";
import Image from "next/image";
import { ImageOff } from "lucide-react";

import { Price } from "@/components/storefront/price";
import { getImageUrl } from "@/lib/storage";
import { isAvailable } from "@/lib/storefront";
import type { Product, Store } from "@/types/database";

/**
 * Accessories card: premium & minimalist. Square 1:1 image with generous
 * whitespace, no add button (the whole card invites you into the detail).
 */
export function AccessoriesProductCard({
  product,
  store,
}: {
  product: Product;
  store: Pick<Store, "id" | "slug" | "exchange_rate" | "show_bs_prices">;
}) {
  const cover = getImageUrl(product.images[0]);
  const available = isAvailable(product);

  return (
    <Link
      href={`/${store.slug}/producto/${product.slug}`}
      className="group block text-center"
    >
      <div className="relative aspect-square overflow-hidden rounded-sm bg-muted/30">
        {cover ? (
          <Image
            src={cover}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className="object-contain p-8 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="size-8" />
          </span>
        )}
        {!available && (
          <span className="absolute inset-x-0 bottom-0 bg-background/85 py-1.5 text-center text-[10px] uppercase tracking-[0.2em] text-foreground">
            Agotado
          </span>
        )}
      </div>

      <p className="mt-4 line-clamp-1 text-xs uppercase tracking-[0.18em] text-foreground/70">
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
      <span className="mt-2 inline-block text-[10px] uppercase tracking-[0.2em] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        Ver detalle →
      </span>
    </Link>
  );
}
