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

  const colorOption = product.variant_options?.find((o) =>
    /color|colour/i.test(o.name),
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
    <div className="group relative flex flex-col">
      <Link
        href={`/${store.slug}/producto/${product.slug}`}
        className="absolute inset-0 z-10"
        aria-label={product.name}
      />

      <div className="relative aspect-[4/5] overflow-hidden bg-white">
        {cover ? (
          <Image
            src={cover}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className={cn(
              "object-cover transition-transform duration-300 group-hover:scale-105",
              !available && "opacity-50",
            )}
          />
        ) : (
          <span className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="size-8" />
          </span>
        )}

        {/* Badges */}
        <div className="absolute left-0 top-0 flex flex-col items-start">
          {product.featured && available && (
            <span
              className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white"
              style={{ background: "hsl(var(--brand-accent))" }}
            >
              New in
            </span>
          )}
          {discount && available && (
            <span className="bg-foreground px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-background">
              -{discount}%
            </span>
          )}
        </div>

        {!available && (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/90 py-2 text-center text-xs font-extrabold uppercase tracking-[0.2em] text-background">
            Sold out
          </span>
        )}

        {/* Quick-buy on hover (desktop) */}
        {available && (
          <div className="absolute inset-x-0 bottom-0 z-20 translate-y-full p-2 transition-transform duration-200 group-hover:translate-y-0">
            <AddToCartButton
              storeId={store.id}
              storeSlug={store.slug}
              productId={product.id}
              productName={product.name}
              image={cover}
              hasVariants={Boolean(product.variant_options?.length)}
              href={`/${store.slug}/producto/${product.slug}`}
              className="rounded-none font-extrabold uppercase tracking-widest text-white hover:brightness-110"
            />
          </div>
        )}
      </div>

      <div className="mt-2.5 space-y-1">
        <p className="line-clamp-1 text-sm font-bold uppercase tracking-wide">
          {product.name}
        </p>

        {colorDots.length > 0 && (
          <div className="flex gap-1.5">
            {colorDots.map((c) => (
              <span
                key={c.name}
                className="size-3.5 rounded-full ring-1 ring-black/15"
                style={{ background: c.hex! }}
                title={c.name}
              />
            ))}
          </div>
        )}

        <div
          className="font-extrabold"
          style={{ color: "hsl(var(--brand-accent))" }}
        >
          <Price
            amountUsd={product.price}
            compareAtUsd={product.compare_at_price}
            exchangeRate={store.exchange_rate}
            showBs={store.show_bs_prices}
          />
        </div>
      </div>
    </div>
  );
}
