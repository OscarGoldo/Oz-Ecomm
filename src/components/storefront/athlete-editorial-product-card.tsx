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
  rosa: "#ec4899", pink: "#ec4899",
  morado: "#7c3aed", purple: "#7c3aed",
  gris: "#6b7280", gray: "#6b7280", grey: "#6b7280",
  marrón: "#78350f", brown: "#78350f", marron: "#78350f",
  naranja: "#ea580c", orange: "#ea580c",
  beige: "#d4b896", crema: "#fffdd0", cream: "#fffdd0",
  celeste: "#7dd3fc", "sky blue": "#7dd3fc",
  borgoña: "#881337", burgundy: "#881337",
  navy: "#1e3a5f", "azul marino": "#1e3a5f",
  oliva: "#65a30d", olive: "#65a30d",
  coral: "#f97171", salmon: "#fa8072",
};

function resolveColorHex(value: string): string | null {
  return COLOR_MAP[value.toLowerCase().trim()] ?? null;
}

export function AthleteEditorialProductCard({
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
        .slice(0, 5)
    : [];

  return (
    <div className="group relative">
      <Link
        href={`/${store.slug}/producto/${product.slug}`}
        className="absolute inset-0 z-10"
        aria-label={product.name}
      />

      <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-stone-100">
        {cover ? (
          <Image
            src={cover}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className={cn(
              "object-cover transition-transform duration-500 group-hover:scale-105",
              !available && "opacity-40 grayscale",
            )}
          />
        ) : (
          <span className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="size-8" />
          </span>
        )}

        {!available && (
          <span className="absolute inset-x-0 bottom-0 bg-stone-900/80 py-1.5 text-center text-[10px] font-medium uppercase tracking-widest text-white">
            Agotado
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="line-clamp-1 text-sm font-medium text-foreground/90">
          {product.name}
        </p>

        {colorDots.length > 0 && (
          <div className="flex gap-1">
            {colorDots.map((c) => (
              <span
                key={c.name}
                className="size-3 rounded-full ring-1 ring-stone-300"
                style={{ background: c.hex! }}
                title={c.name}
              />
            ))}
          </div>
        )}

        <div className="text-foreground/60">
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
