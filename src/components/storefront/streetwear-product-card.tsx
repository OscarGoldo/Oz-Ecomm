import Link from "next/link";
import Image from "next/image";
import { ImageOff } from "lucide-react";

import { Price } from "@/components/storefront/price";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { getImageUrl } from "@/lib/storage";
import { isAvailable } from "@/lib/storefront";
import { cn } from "@/lib/utils";
import type { Product, Store } from "@/types/database";

const COLOR_MAP: Record<string, string> = {
  negro: "#1a1a1a", black: "#1a1a1a",
  blanco: "#f5f5f4", white: "#f5f5f4",
  rojo: "#dc2626", red: "#dc2626",
  azul: "#2563eb", blue: "#2563eb",
  verde: "#16a34a", green: "#16a34a",
  amarillo: "#eab308", yellow: "#eab308",
  rosa: "#ec4899", pink: "#ec4899", rosado: "#ec4899",
  morado: "#7c3aed", purple: "#7c3aed",
  gris: "#6b7280", gray: "#6b7280", grey: "#6b7280",
  marrón: "#78350f", brown: "#78350f", marron: "#78350f",
  naranja: "#ea580c", orange: "#ea580c",
  beige: "#d4b896", crema: "#fffdd0", cream: "#fffdd0",
  celeste: "#7dd3fc", "sky blue": "#7dd3fc",
  coral: "#f97171", salmon: "#fa8072",
  fucsia: "#d946ef", fuchsia: "#d946ef", magenta: "#d946ef",
};

function resolveColorHex(value: string): string | null {
  return COLOR_MAP[value.toLowerCase().trim()] ?? null;
}

export function StreetProductCard({
  product,
  store,
}: {
  product: Product;
  store: Pick<Store, "id" | "slug" | "exchange_rate" | "show_bs_prices">;
}) {
  const cover = getImageUrl(product.images[0]);
  const available = isAvailable(product);

  const colorOption = product.variant_options?.find(
    (o) => /color|colour/i.test(o.name),
  );
  const colorDots = colorOption
    ? colorOption.values
        .map((v) => ({ name: v, hex: resolveColorHex(v) }))
        .filter((c) => c.hex !== null)
        .slice(0, 6)
    : [];

  const discount =
    product.compare_at_price && product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : null;

  return (
    <div className="group relative overflow-hidden rounded-2xl border-2 border-transparent bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg">
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
            className={cn(
              "object-cover transition-transform duration-300 group-hover:scale-110",
              !available && "opacity-40 grayscale",
            )}
          />
        ) : (
          <span className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="size-8" />
          </span>
        )}

        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {product.featured && available && (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
              NEW
            </span>
          )}
          {discount && available && (
            <span className="rounded-full bg-foreground px-2.5 py-0.5 text-[10px] font-bold text-background shadow-sm">
              -{discount}%
            </span>
          )}
        </div>

        {!available && (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/90 py-2 text-center text-xs font-bold uppercase tracking-wider text-background">
            Sold Out
          </span>
        )}
      </div>

      <div className="space-y-1.5 p-3">
        <p className="line-clamp-2 text-sm font-bold leading-snug">
          {product.name}
        </p>

        {colorDots.length > 0 && (
          <div className="flex gap-1.5">
            {colorDots.map((c) => (
              <span
                key={c.name}
                className="size-4 rounded-full ring-2 ring-white shadow-sm"
                style={{ background: c.hex! }}
                title={c.name}
              />
            ))}
          </div>
        )}

        <div className="font-extrabold text-primary">
          <Price
            amountUsd={product.price}
            compareAtUsd={product.compare_at_price}
            exchangeRate={store.exchange_rate}
            showBs={store.show_bs_prices}
          />
        </div>

        {available && (
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
        )}
      </div>
    </div>
  );
}
