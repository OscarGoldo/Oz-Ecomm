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
      {theme.announcement.enabled && theme.announcement.text &&
        (theme.layout === "fashion-athletic" ? (
          <div
            className="overflow-hidden py-1.5 text-xs font-medium tracking-widest text-white uppercase"
            style={{ background: "hsl(var(--brand-accent, var(--primary)))" }}
          >
            <div className="flex animate-marquee whitespace-nowrap">
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} className="mx-8">{theme.announcement.text}</span>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="px-4 py-2 text-center text-sm font-medium text-white"
            style={{ background: "hsl(var(--brand-accent, var(--primary)))" }}
          >
            {theme.announcement.text}
          </div>
        ))}
      <StorefrontHeader store={store} cartCount={cartCount} />
      <div className="flex-1">{children}</div>
      <StorefrontFooter store={store} />
    </div>
  );
}
