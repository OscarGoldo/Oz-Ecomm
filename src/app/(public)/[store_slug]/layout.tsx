import { notFound } from "next/navigation";

import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { getStoreBySlug } from "@/lib/storefront";
import { getCartCount } from "@/lib/cart";
import { resolveTheme, themeStyle } from "@/lib/theme";

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
  const theme = resolveTheme(store);

  return (
    <div style={themeStyle(theme)} className="flex min-h-dvh flex-col bg-background">
      {theme.announcement.enabled && theme.announcement.text && (
        <div
          className="px-4 py-2 text-center text-sm font-medium text-white"
          style={{ background: "hsl(var(--brand-accent, var(--primary)))" }}
        >
          {theme.announcement.text}
        </div>
      )}
      <StorefrontHeader store={store} cartCount={cartCount} />
      <div className="flex-1">{children}</div>
      <StorefrontFooter store={store} />
    </div>
  );
}
