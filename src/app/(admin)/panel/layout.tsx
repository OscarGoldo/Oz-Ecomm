import type { Metadata, Viewport } from "next";
import Link from "next/link";

import { DomainNotice } from "@/components/admin/domain-notice";
import {
  PanelPlanCard,
  PanelSearch,
  PanelStoreCard,
  StoreMark,
} from "@/components/admin/panel-chrome";
import { PanelBottomNav, PanelSidebarNav } from "@/components/admin/panel-nav";
import { PlanBanner } from "@/components/admin/plan-banner";
import { PlanGiftNotice } from "@/components/admin/plan-gift-notice";
import { RateMenu, type PanelRates, type StoreRate } from "@/components/admin/rate-menu";
import { StoreAddressNotice } from "@/components/admin/store-address-notice";
import { UserMenu } from "@/components/admin/user-menu";
import { landingFonts } from "@/components/landing/fonts";
import { TiendifyLogo } from "@/components/landing/tiendify-logo";
import { requireStoreUser } from "@/lib/auth";
import { getCachedBcvRates } from "@/lib/bcv";
import { rateSettings } from "@/lib/exchange-rate";
import { getUsdtRate } from "@/lib/usdt";
import { createClient } from "@/lib/supabase/server";
import { abandonedCartCutoff } from "@/lib/constants";
import { shouldShowDomainNotice } from "@/lib/domain-notice";
import { pendingPlanGift } from "@/lib/plan-gift";
import { shouldShowStoreAddressNotice } from "@/lib/store-address-notice";
import { daysUntilExpiry, daysUntilPause, isFounder, isPro, planState } from "@/lib/plans";
import { getImageUrl } from "@/lib/storage";
import { publicSiteUrl } from "@/lib/site-url";
import { displayStoreAddress, storeSubdomainOrigin, storeUrl } from "@/lib/store-url";
import { cn } from "@/lib/utils";

/**
 * El panel se puede instalar en la pantalla de inicio como una app. En iPhone
 * es obligatorio para recibir avisos de pedidos (Safari solo los permite a
 * webs instaladas). El manifiesto es solo del panel: las tiendas públicas no
 * lo llevan, así un cliente que guarda una tienda no se lleva el panel.
 */
export const metadata: Metadata = {
  manifest: "/panel.webmanifest",
  // "black" y no "black-translucent": con translúcido el contenido pasa por
  // debajo de la hora y la batería, y la barra del panel no deja ese espacio.
  appleWebApp: { capable: true, title: "Tiendify", statusBarStyle: "black" },
};

// La barra del navegador del color de la barra noche del panel en móvil.
export const viewport: Viewport = { themeColor: "#0B1B2B" };

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, store, metadata } = await requireStoreUser();

  // Pedidos que esperan algo del comerciante (badge en Pedidos): revisar un
  // comprobante, o seguir a un cliente que eligió pagar por fuera y no mandó
  // nada. Esos segundos tienen el stock apartado desde que se crearon; si no se
  // ven, la última unidad queda "agotada" en la tienda por un pedido fantasma.
  const { count: unattended } = await createClient()
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)
    .in("status", ["pending_confirmation", "pending_payment"]);
  // Carritos abandonados pendientes (mismo criterio que /panel/carritos: solo
  // los que ya pasaron la ventana de gracia cuentan como abandonados).
  const { count: pendingCarts } = await createClient()
    .from("abandoned_carts")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)
    .is("recovered_at", null)
    .is("dismissed_at", null)
    .lt("updated_at", abandonedCartCutoff());

  const navBadges: Record<string, number> = {
    ...(unattended ? { "/panel/pedidos": unattended } : {}),
    ...(pendingCarts ? { "/panel/carritos": pendingCarts } : {}),
  };

  const logo = getImageUrl(store.logo_url);
  const pro = isPro(store);
  const publicUrl = storeUrl(store);

  // En Gratis la tarjeta del plan muestra cuántos productos van cargados de
  // los que permite: es el tope con el que la tienda se encuentra primero.
  const { count: productCount } = pro
    ? { count: 0 }
    : await createClient()
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store.id);

  // Un aviso por vez. Un regalo va antes que todo: es lo único que le cuenta
  // algo que pasó con su tienda. Después el del cambio de dominio, y el de la
  // dirección propia le sale la próxima vez que entre.
  const gift = pendingPlanGift(metadata, pro);
  const domainNotice = !gift && shouldShowDomainNotice(user, metadata);
  const addressNotice =
    !gift &&
    !domainNotice &&
    shouldShowStoreAddressNotice(user, metadata, store);

  // Comprobante ya enviado y esperando revisión: el banner lo dice para que no
  // vuelva a pagar mientras tanto.
  const { count: pendingPayment } = await createClient()
    .from("subscription_payments")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)
    .eq("status", "pending");

  // La tasa del día de arriba (dólar y euro del BCV y el precio del USDT) va
  // aunque la tienda no muestre precios en bolívares: la calculadora sirve
  // igual para cobrar un Pago Móvil. El USDT sale de una caché de 15 minutos y
  // no demora el panel (ver lib/usdt.ts).
  const [bcvRates, usdt] = await Promise.all([getCachedBcvRates(), getUsdtRate()]);
  const panelRates: PanelRates = {
    usd: bcvRates?.usd ?? null,
    eur: bcvRates?.eur ?? null,
    bcvDate: bcvRates?.source_date ?? null,
    usdt,
  };
  const rateFrom = rateSettings(store);
  const storeRate: StoreRate = {
    rate: store.exchange_rate,
    auto: rateFrom.auto,
    source: rateFrom.source,
    margin: rateFrom.margin,
    showBs: store.show_bs_prices,
  };

  // El panel usa el azul de Tiendify (definido en globals.css), no el
  // primary_color de la tienda: ese es el color de la tienda pública, no el
  // de la plataforma.

  /**
   * El panel con la cara de la portada, en versión de trabajo: barra lateral
   * noche, fondo claro frío y tarjetas blancas. `chrome-admin` deja el
   * primario en noche y `chrome-panel` cambia la tinta cálida por los neutros
   * fríos de la landing (ver globals.css), así que las pantallas que todavía
   * no se rehicieron igual quedan en la misma paleta. El azul se reserva para
   * enlaces, foco y gráficos, y el amarillo sol solo para lo que hay que
   * atender (pagos por revisar).
   */
  return (
    <div
      className={cn(
        landingFonts,
        "chrome-admin chrome-panel min-h-dvh bg-surface font-landing-body text-foreground antialiased",
      )}
    >
      {/* Móvil: la barra noche con la tienda. La navegación va abajo. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-noche px-4 text-white md:hidden print:hidden">
        <StoreMark name={store.name} logo={logo} className="size-8 rounded-lg" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[15px] font-bold">{store.name}</p>
          <p className="truncate font-landing-mono text-[11px] text-niebla">
            {displayStoreAddress(publicUrl)}
          </p>
        </div>
        <RateMenu rates={panelRates} store={storeRate} tone="dark" />
        <UserMenu
          fullName={user.full_name}
          email={user.email}
          storeUrl={publicUrl}
          tone="dark"
        />
      </header>

      <div className="flex w-full">
        {/* Barra lateral al ras, de alto completo. */}
        <aside className="sticky top-0 hidden h-dvh w-[15.5rem] shrink-0 self-start bg-noche text-white md:block print:hidden">
          <div className="flex h-full flex-col gap-3.5 overflow-y-auto px-3 py-3.5">
            <Link href="/panel" className="flex items-center px-2 pt-0.5" aria-label="Tiendify, resumen">
              <TiendifyLogo variant="white" className="h-7 w-auto" />
            </Link>
            <PanelStoreCard
              name={store.name}
              logo={logo}
              url={publicUrl}
              address={displayStoreAddress(publicUrl)}
            />
            <PanelSidebarNav
              badges={navBadges}
              pro={pro}
              plan={
                <PanelPlanCard
                  pro={pro}
                  paused={planState(store) === "paused"}
                  trial={!isFounder(store) && store.plan_source === "comp"}
                  daysLeft={daysUntilExpiry(store)}
                  productCount={productCount ?? 0}
                />
              }
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Escritorio: buscador de pedidos, tasa del día y cuenta. */}
          <header className="sticky top-0 z-30 hidden h-16 items-center gap-4 border-b border-border bg-card px-8 md:flex print:hidden">
            <PanelSearch />
            <div className="ml-auto flex items-center gap-3">
              <RateMenu rates={panelRates} store={storeRate} />
              <UserMenu fullName={user.full_name} email={user.email} storeUrl={publicUrl} />
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-14 md:pt-8">
            <div className="mx-auto w-full max-w-6xl">
              <PlanBanner
                state={planState(store)}
                daysLeft={daysUntilExpiry(store)}
                pauseIn={daysUntilPause(store)}
                trial={!isFounder(store) && store.plan_source === "comp"}
                pendingReview={(pendingPayment ?? 0) > 0}
              />
              {children}
            </div>
          </main>
        </div>
      </div>

      <div className="print:hidden">
        <PanelBottomNav badges={navBadges} pro={pro} />
      </div>

      {gift && (
        <PlanGiftNotice
          firstName={user.full_name?.trim().split(/\s+/)[0] || null}
          months={gift.months}
          message={gift.message}
          expiresOn={
            store.plan_expires_at
              ? new Date(store.plan_expires_at).toLocaleDateString("es-VE", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : null
          }
        />
      )}
      {domainNotice && <DomainNotice storeUrl={publicUrl} />}
      {addressNotice && (
        <StoreAddressNotice
          pro={pro}
          subdomainUrl={storeSubdomainOrigin(store.slug)}
          currentUrl={`${publicSiteUrl()}/${store.slug}`}
        />
      )}
    </div>
  );
}
