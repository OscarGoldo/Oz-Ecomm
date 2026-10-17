import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { StoreBaseProvider } from "@/components/storefront/store-base";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { WhatsappFloat } from "@/components/storefront/whatsapp-float";
import { getStoreBySlug } from "@/lib/storefront";
import { getImageUrl } from "@/lib/storage";
import { JsonLd } from "@/components/storefront/json-ld";
import { storeJsonLd } from "@/lib/structured-data";
import { getCartCount } from "@/lib/cart";
import { publicSiteUrl } from "@/lib/site-url";
import { onStoreSubdomain, storeBasePath } from "@/lib/store-href";
import { hasStoreSubdomain, STORE_PATH_HEADER } from "@/lib/store-url";
import { resolveTheme, themeStyle } from "@/lib/theme";
import { StoreAnnouncement } from "@/components/storefront/store-announcement";
import { designStyle, publishedDesign } from "@/lib/design/design";
import { designV2Enabled } from "@/lib/design/flag";

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { store_slug: string };
}) {
  const store = await getStoreBySlug(params.store_slug);
  const onSubdomain = onStoreSubdomain(params.store_slug);

  // Un subdominio que no es (o dejó de ser) de una tienda Pro manda a la
  // dirección de siempre, en la misma página: el link que el comerciante ya
  // compartió no se rompe porque se le venció el plan.
  if (onSubdomain && (!store || !hasStoreSubdomain(store))) {
    if (!store) redirect(publicSiteUrl());
    const path = headers().get(STORE_PATH_HEADER) ?? "/";
    redirect(`${publicSiteUrl()}/${store.slug}${path === "/" ? "" : path}`);
  }
  if (!store) notFound();

  const cartCount = getCartCount(store.id);

  // Tiendas con el editor por secciones: estilo, colores y anuncio salen del
  // diseño publicado. Las demás siguen exactamente como antes.
  if (designV2Enabled(store)) {
    const design = publishedDesign(store);
    const { announcement } = design.header;
    return (
      <StoreBaseProvider base={storeBasePath(store.slug)}>
        <div style={designStyle(design)} className="storefront flex min-h-dvh flex-col bg-background text-foreground">
          {announcement.enabled && announcement.text && (
            <StoreAnnouncement text={announcement.text} look={design.tokens.look} style={announcement.style} />
          )}
          <JsonLd data={storeJsonLd(store, getImageUrl(store.logo_url))} />
          <StorefrontHeader store={store} cartCount={cartCount} layout={design.tokens.header ?? design.tokens.look} />
          <div className="flex-1">{children}</div>
          <StorefrontFooter store={store} layout={design.tokens.footer ?? design.tokens.look} />
          <WhatsappFloat phone={store.whatsapp} storeName={store.name} />
        </div>
      </StoreBaseProvider>
    );
  }

  const theme = resolveTheme(store);

  return (
    <StoreBaseProvider base={storeBasePath(store.slug)}>
      <div
        style={themeStyle(theme)}
        className="storefront flex min-h-dvh flex-col bg-background"
      >
        {theme.announcement.enabled && theme.announcement.text &&
          (theme.layout === "fashion-athletic" || theme.layout === "sports-drops" ? (
            <div
              className={
                theme.layout === "sports-drops"
                  ? "overflow-hidden py-1.5 text-xs font-extrabold uppercase tracking-widest text-neutral-950"
                  : "overflow-hidden py-1.5 text-xs font-medium uppercase tracking-widest text-white"
              }
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
        <JsonLd data={storeJsonLd(store, getImageUrl(store.logo_url))} />
        <StorefrontHeader store={store} cartCount={cartCount} layout={theme.layout} />
        <div className="flex-1">{children}</div>
        <StorefrontFooter store={store} layout={theme.layout} />
        <WhatsappFloat phone={store.whatsapp} storeName={store.name} />
      </div>
    </StoreBaseProvider>
  );
}
