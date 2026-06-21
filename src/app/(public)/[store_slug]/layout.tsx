import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { getStoreBySlug } from "@/lib/storefront";
import { getCartCount } from "@/lib/cart";
import { hexToHslTriplet } from "@/lib/color";

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { store_slug: string };
}) {
  const store = await getStoreBySlug(params.store_slug);
  if (!store) notFound();

  const cartCount = getCartCount(store.id);
  const primaryHsl = hexToHslTriplet(store.primary_color);
  const brandStyle = primaryHsl
    ? ({ "--primary": primaryHsl, "--ring": primaryHsl } as CSSProperties)
    : undefined;

  return (
    <div style={brandStyle} className="flex min-h-dvh flex-col bg-background">
      <StorefrontHeader store={store} cartCount={cartCount} />
      <div className="flex-1">{children}</div>
      <StorefrontFooter store={store} />
    </div>
  );
}
