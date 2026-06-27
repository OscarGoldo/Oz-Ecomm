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
  rosa: "#ec4899", pink: "#ec4899", rosado: "#ec4899", nude: "#e8c4b8",
  morado: "#7c3aed", purple: "#7c3aed",
  gris: "#6b7280", gray: "#6b7280", grey: "#6b7280",
  marrón: "#78350f", brown: "#78350f", marron: "#78350f",
  naranja: "#ea580c", orange: "#ea580c", durazno: "#f9c5a7", peach: "#f9c5a7",
  beige: "#d4b896", crema: "#f3e9dd", cream: "#f3e9dd",
  coral: "#f97171", salmon: "#fa8072", vino: "#7b1e3b", berry: "#9b2d54",
};

function resolveColorHex(value: string): string | null {
  return COLOR_MAP[value.toLowerCase().trim()] ?? null;
}

/** First short functional line from the product description (e.g. "Bálsamo nutritivo"). */
function functionLine(description: string | null | undefined): string | null {
  if (!description) return null;
  const first = description.split(/[\n.]/)[0]?.trim();
  if (!first) return null;
  return first.length > 48 ? `${first.slice(0, 47)}…` : first;
}

export function BeautyMinimalProductCard({
  product,
  store,
}: {
  product: Product;
  store: Pick<Store, "id" | "slug" | "exchange_rate" | "show_bs_prices">;
}) {
  const cover = getImageUrl(product.images[0]);
  const available = isAvailable(product);
  const desc = functionLine(product.description);

  const colorOption = product.variant_options?.find((o) =>
    /color|colour|tono|tonalidad/i.test(o.name),
  );
  const colorDots = colorOption
    ? colorOption.values
        .map((v) => ({ name: v, hex: resolveColorHex(v) }))
        .filter((c) => c.hex !== null)
        .slice(0, 5)
    : [];

  return (
    <div className="group relative text-center">
      <Link
        href={`/${store.slug}/producto/${product.slug}`}
        className="absolute inset-0 z-10"
        aria-label={product.name}
      />

      <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#f6efe9]">
        {cover ? (
          <Image
            src={cover}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className={cn(
              "object-contain p-5 transition-transform duration-500 group-hover:scale-105",
              !available && "opacity-50",
            )}
          />
        ) : (
          <span className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="size-8" />
          </span>
        )}

        {product.featured && available && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-foreground/70 shadow-sm">
            Best Seller
          </span>
        )}
        {!available && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-foreground/60 shadow-sm">
            Agotado
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-sm font-medium text-foreground">{product.name}</p>
        {desc && (
          <p className="line-clamp-1 text-xs text-muted-foreground">{desc}</p>
        )}

        {colorDots.length > 0 && (
          <div className="flex justify-center gap-1.5 pt-0.5">
            {colorDots.map((c) => (
              <span
                key={c.name}
                className="size-3 rounded-full ring-1 ring-black/10"
                style={{ background: c.hex! }}
                title={c.name}
              />
            ))}
          </div>
        )}

        <div className="flex justify-center pt-0.5">
          <Price
            amountUsd={product.price}
            compareAtUsd={product.compare_at_price}
            exchangeRate={store.exchange_rate}
            showBs={store.show_bs_prices}
          />
        </div>

        {available && (
          <div className="relative z-20 mx-auto max-w-[12rem] pt-1.5">
            <AddToCartButton
              storeId={store.id}
              storeSlug={store.slug}
              productId={product.id}
              productName={product.name}
              image={cover}
              hasVariants={Boolean(product.variant_options?.length)}
              href={`/${store.slug}/producto/${product.slug}`}
              className="rounded-full border border-foreground/15 bg-transparent text-foreground hover:bg-foreground hover:text-background"
            />
          </div>
        )}
      </div>
    </div>
  );
}
