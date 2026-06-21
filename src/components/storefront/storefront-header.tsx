import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Store as StoreIcon } from "lucide-react";

import { HeaderSearch } from "@/components/storefront/header-search";
import { getImageUrl } from "@/lib/storage";
import type { Store } from "@/types/database";

export function StorefrontHeader({
  store,
  cartCount = 0,
}: {
  store: Store;
  cartCount?: number;
}) {
  const logo = getImageUrl(store.logo_url);

  return (
    <header className="sticky top-0 z-30 bg-primary text-primary-foreground shadow-sm">
      <div className="container flex h-14 items-center gap-3">
        <Link href={`/${store.slug}`} className="flex min-w-0 items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
            {logo ? (
              <Image
                src={logo}
                alt={store.name}
                width={36}
                height={36}
                className="size-9 object-contain p-0.5"
              />
            ) : (
              <StoreIcon className="size-5 text-primary" />
            )}
          </span>
          <span className="truncate text-base font-bold tracking-tight">
            {store.name}
          </span>
        </Link>

        {/* Desktop search */}
        <div className="mx-2 hidden max-w-xl flex-1 md:block">
          <HeaderSearch storeSlug={store.slug} />
        </div>

        <Link
          href={`/${store.slug}/carrito`}
          className="relative ml-auto inline-flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/15"
          aria-label="Carrito"
        >
          <ShoppingCart className="size-5" />
          {cartCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold leading-5 text-primary">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </Link>
      </div>

      {/* Mobile search */}
      <div className="container pb-3 md:hidden">
        <HeaderSearch storeSlug={store.slug} />
      </div>
    </header>
  );
}
