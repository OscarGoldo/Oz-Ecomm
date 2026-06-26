import Link from "next/link";
import Image from "next/image";
import { ImageOff } from "lucide-react";

import { Price } from "@/components/storefront/price";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { getImageUrl } from "@/lib/storage";
import { isAvailable } from "@/lib/storefront";
import { extractDropBadge } from "@/lib/drops";
import { cn } from "@/lib/utils";
import type { Product, Store } from "@/types/database";

/**
 * Drops card: dark, high-contrast, collector aesthetic. Type badge (PLAYER /
 * RETRO / LIMITADA…), neon CTA, scarcity counter.
 */
export function DropsProductCard({
  product,
  store,
}: {
  product: Product;
  store: Pick<Store, "id" | "slug" | "exchange_rate" | "show_bs_prices">;
}) {
  const cover = getImageUrl(product.images[0]);
  const available = isAvailable(product);
  const badge = extractDropBadge(product.name, product.description);
  const discount =
    product.compare_at_price && product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : null;

  const lowStock =
    product.track_stock &&
    product.stock > 0 &&
    product.stock <= product.low_stock_threshold;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-white/10 bg-neutral-900 transition-colors hover:border-[hsl(var(--brand-accent))]">
      <Link
        href={`/${store.slug}/producto/${product.slug}`}
        className="absolute inset-0 z-10"
        aria-label={product.name}
      />

      <div className="relative aspect-square overflow-hidden bg-neutral-950">
        {cover ? (
          <Image
            src={cover}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className={cn(
              "object-cover transition-transform duration-300 group-hover:scale-105",
              !available && "opacity-40 grayscale",
            )}
          />
        ) : (
          <span className="grid h-full place-items-center text-white/20">
            <ImageOff className="size-8" />
          </span>
        )}

        <div className="absolute left-0 top-2 flex flex-col items-start gap-1">
          {badge && (
            <span
              className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-950"
              style={{ background: "hsl(var(--brand-accent))" }}
            >
              {badge}
            </span>
          )}
          {discount && available && (
            <span className="bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-950">
              -{discount}%
            </span>
          )}
        </div>

        {!available && (
          <span className="absolute inset-x-0 bottom-0 bg-black/85 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-white">
            Agotado
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <p className="line-clamp-2 text-sm font-bold uppercase leading-tight text-white">
          {product.name}
        </p>

        {lowStock && (
          <p
            className="text-[11px] font-extrabold uppercase tracking-wide"
            style={{ color: "hsl(var(--brand-accent))" }}
          >
            ¡Últimas {product.stock} unidades!
          </p>
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
                className="rounded-md bg-[hsl(var(--brand-accent))] font-extrabold uppercase tracking-wide text-neutral-950 hover:bg-[hsl(var(--brand-accent))] hover:brightness-110"
              />
            </div>
          ) : (
            <span className="flex h-9 items-center justify-center rounded-md bg-white/5 text-xs font-bold uppercase text-white/40">
              Sin stock
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
