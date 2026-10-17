import { notFound } from "next/navigation";

import { StoreAnnouncement } from "@/components/storefront/store-announcement";
import { StoreBaseProvider } from "@/components/storefront/store-base";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StoreHome } from "@/components/storefront/sections/store-home";
import { requireStoreUser } from "@/lib/auth";
import { getCachedBcvRates } from "@/lib/bcv";
import { bcvReference } from "@/lib/exchange-rate";
import { designStyle } from "@/lib/design/design";
import { designV2Enabled } from "@/lib/design/flag";
import { loadDraft } from "@/lib/design/store";
import { getImageUrl } from "@/lib/storage";
import { CATALOG_PAGE_SIZE, getStoreCatalogPage, getStoreCategories } from "@/lib/storefront";
import { PreviewBridge } from "./preview-bridge";

export const metadata = { title: "Vista previa", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * La vista previa del editor de diseño: la tienda de verdad (mismos
 * componentes, mismos productos) pero con el borrador en vez de lo publicado.
 *
 * Vive fuera de la tienda a propósito: solo la ve el dueño con su sesión, y
 * el layout de la tienda no puede saber si está en modo vista previa (los
 * layouts no reciben la URL).
 */
export default async function DesignPreviewPage() {
  const { store } = await requireStoreUser();
  if (!designV2Enabled(store)) notFound();

  const [{ design }, categories, page, bcvRates] = await Promise.all([
    loadDraft(store),
    getStoreCategories(store.id),
    getStoreCatalogPage(store.id, {}, CATALOG_PAGE_SIZE),
    store.show_bs_prices ? getCachedBcvRates() : null,
  ]);
  const products = page.products;
  const featured = products.filter((p) => p.featured && (!p.track_stock || p.stock > 0)).slice(0, 10);
  const { announcement } = design.header;

  return (
    <StoreBaseProvider base={`/${store.slug}`}>
      <div style={designStyle(design)} className="storefront flex min-h-dvh flex-col bg-background">
        {announcement.enabled && announcement.text && (
          <StoreAnnouncement text={announcement.text} look={design.tokens.look} style={announcement.style} />
        )}
        <StorefrontHeader store={store} cartCount={0} layout={design.tokens.look} />
        <div className="flex-1">
          <StoreHome
            store={store}
            design={design}
            categories={categories}
            products={products}
            featured={featured}
            hasFilters={false}
            heading="Todos los productos"
            banner={getImageUrl(store.banner_url)}
            bcv={bcvReference(store.currency_primary, bcvRates)}
            editing
          />
        </div>
        <StorefrontFooter store={store} layout={design.tokens.look} />
      </div>
      <PreviewBridge />
    </StoreBaseProvider>
  );
}
