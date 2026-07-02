"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ShoppingCart, Store as StoreIcon } from "lucide-react";

import { HeaderSearch, type SearchTone } from "@/components/storefront/header-search";
import { getImageUrl } from "@/lib/storage";
import { LAYOUT_CHROME, type LayoutId } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Store } from "@/types/database";

/** Visual recipe for each header variant. */
const VARIANTS: Record<
  "brand" | "light" | "dark",
  {
    wrap: string;
    chip: string;
    chipIcon: string;
    cartHover: string;
    badge: string;
    searchTone: SearchTone;
  }
> = {
  brand: {
    wrap: "bg-primary text-primary-foreground shadow-sm",
    chip: "bg-white",
    chipIcon: "text-primary",
    cartHover: "hover:bg-white/15",
    badge: "bg-white text-primary",
    searchTone: "brand",
  },
  light: {
    wrap: "border-b bg-background/95 text-foreground backdrop-blur",
    chip: "bg-primary/10",
    chipIcon: "text-primary",
    cartHover: "hover:bg-muted",
    badge: "bg-primary text-primary-foreground",
    searchTone: "light",
  },
  dark: {
    wrap: "border-b border-white/10 bg-neutral-950 text-white",
    chip: "bg-white",
    chipIcon: "text-neutral-900",
    cartHover: "hover:bg-white/10",
    badge: "bg-white text-neutral-900",
    searchTone: "dark",
  },
};

export function StorefrontHeader({
  store,
  cartCount = 0,
  layout = "classic",
}: {
  store: Store;
  cartCount?: number;
  layout?: LayoutId;
}) {
  const logo = getImageUrl(store.logo_url);
  // The checkout embeds PayPal's tall card form; a sticky header would overlap
  // it, so on checkout the header scrolls away normally.
  const pathname = usePathname();
  const sticky = !(pathname?.endsWith("/checkout") ?? false);

  const chrome = LAYOUT_CHROME[layout] ?? LAYOUT_CHROME.classic;
  const v = VARIANTS[chrome.header];

  return (
    <header className={cn("z-30", v.wrap, sticky && "sticky top-0")}>
      <div className="container flex h-14 items-center gap-3">
        <Link href={`/${store.slug}`} className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg",
              v.chip,
            )}
          >
            {logo ? (
              <Image
                src={logo}
                alt={store.name}
                width={36}
                height={36}
                className="size-9 object-contain p-0.5"
              />
            ) : (
              <StoreIcon className={cn("size-5", v.chipIcon)} />
            )}
          </span>
          <span
            className={cn(
              "truncate",
              chrome.headerName ?? "text-base font-bold tracking-tight",
            )}
            style={{ fontFamily: "var(--font-heading, inherit)" }}
          >
            {store.name}
          </span>
        </Link>

        {/* Desktop search */}
        <div className="mx-2 hidden max-w-xl flex-1 md:block">
          <HeaderSearch storeSlug={store.slug} tone={v.searchTone} />
        </div>

        <Link
          href={`/${store.slug}/carrito`}
          className={cn(
            "relative ml-auto inline-flex size-10 items-center justify-center rounded-full transition-colors",
            v.cartHover,
          )}
          aria-label="Carrito"
        >
          <ShoppingCart className="size-5" />
          {cartCount > 0 && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold leading-5",
                chrome.accentCart
                  ? chrome.header === "dark"
                    ? "text-neutral-950"
                    : "text-white"
                  : v.badge,
              )}
              style={
                chrome.accentCart
                  ? { background: "hsl(var(--brand-accent))" }
                  : undefined
              }
            >
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </Link>
      </div>

      {/* Mobile search */}
      <div className="container pb-3 md:hidden">
        <HeaderSearch storeSlug={store.slug} tone={v.searchTone} />
      </div>
    </header>
  );
}
