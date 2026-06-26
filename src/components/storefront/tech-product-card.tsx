import Link from "next/link";
import Image from "next/image";
import { ImageOff } from "lucide-react";

import { Price } from "@/components/storefront/price";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { getImageUrl } from "@/lib/storage";
import { isAvailable } from "@/lib/storefront";
import { extractSpecs } from "@/lib/specs";
import type { Product, Store } from "@/types/database";

/**
 * Tech card: compact, data-dense. Shows key spec chips and high-contrast
 * badges (oferta / envío gratis) before the buy button.
 */
export function TechProductCard({
  product,
  store,
  category,
  freeShipping,
}: {
  product: Product;
  store: Pick<Store, "id" | "slug" | "exchange_rate" | "show_bs_prices">;
  category: string | null;
  freeShipping: boolean;
}) {
  const cover = getImageUrl(product.images[0]);
  const available = isAvailable(product);
  const specs = extractSpecs(product.name, product.description);
  const discount =
    product.compare_at_price && product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : null;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-md border-2 bg-card transition-colors hover:border-primary">
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
            className="object-contain p-2"
          />
        ) : (
          <span className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="size-8" />
          </span>
        )}

        <div className="absolute left-0 top-0 flex flex-col items-start gap-1 p-1.5">
          {discount && available && (
            <span className="rounded-sm bg-destructive px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive-foreground">
              Oferta −{discount}%
            </span>
          )}
          {freeShipping && available && (
            <span className="rounded-sm bg-foreground px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-background">
              Envío gratis
            </span>
          )}
        </div>
        {!available && (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/85 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-background">
            Agotado
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {category && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            {category}
          </span>
        )}
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          {product.name}
        </p>

        {specs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {specs.map((s) => (
              <span
                key={s}
                className="rounded-sm border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {s}
              </span>
            ))}
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
          ) : (
            <span className="flex h-9 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
              Sin stock
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
