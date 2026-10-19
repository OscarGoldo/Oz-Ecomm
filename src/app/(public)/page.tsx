import type { Metadata } from "next";

import { BeforeAfter } from "@/components/landing/before-after";
import { ClosingCta } from "@/components/landing/closing-cta";
import { ExampleStores } from "@/components/landing/example-stores";
import { FeatureBento } from "@/components/landing/feature-bento";
import { landingFonts } from "@/components/landing/fonts";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingSteps } from "@/components/landing/landing-steps";
import { PayStrip, RateTicker } from "@/components/landing/landing-strips";
import { PricingPlans } from "@/components/landing/pricing-plans";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { StoreNameProvider } from "@/components/landing/store-name";
import { getPublicUsdRate } from "@/lib/bcv";
import { DEFAULT_PRO_PRICE_USD, DEFAULT_PRO_PRICE_YEARLY_USD } from "@/lib/plans";
import { THEME_PRESETS } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * La landing se prerenderiza y se revalida cada hora. Lo único que lee de la
 * base es la tasa BCV, que el cron revisa cada hora en la tarde y cambia una
 * vez al día — no hay razón para pagar una consulta por visita.
 */
export const revalidate = 3600;

/**
 * Es lo que se lee en negrita debajo de la imagen cuando alguien pega el link
 * en WhatsApp: tiene que decir qué es y que el primer mes es gratis, no solo
 * "Tiendify".
 */
export const metadata: Metadata = {
  title: { absolute: "Tiendify · Crea tu tienda online, el primer mes gratis" },
  description:
    "Tu tienda online lista hoy. Tus clientes pagan con Pago Móvil, Zelle, Binance, efectivo o tarjeta, con precios en dólares y bolívares.",
};

/**
 * La portada. Sigue el sistema visual de los posts de Instagram (azul de
 * marca, noche, sol) porque de ahí llega la mayoría: el post y la página
 * tienen que verse como la misma marca.
 *
 * Todo gira alrededor de un gesto: la persona escribe el nombre de su negocio
 * en el hero y la tienda del navegador, el checkout, su link, los pasos y el
 * subdominio pasan a ser los suyos (StoreNameProvider). El mismo campo,
 * abajo, la lleva al registro con el nombre ya puesto. Después, dos tiendas de
 * ejemplo muestran el camino completo del cliente, de la vitrina al pago.
 *
 * La tasa se lee una sola vez acá y baja a cada sección que muestra bolívares:
 * son la misma cuenta que hacen las tiendas, no números escritos a mano.
 */
export default async function LandingPage() {
  const usdRate = await getPublicUsdRate();

  return (
    <div
      data-landing
      className={cn(landingFonts, "min-h-dvh bg-claro font-landing-body text-noche antialiased")}
    >
      <ScrollReveal />
      <RateTicker usdRate={usdRate} />
      <StoreNameProvider>
        <LandingHeader />
        <main>
          <LandingHero usdRate={usdRate} />
          <PayStrip />
          <ExampleStores usdRate={usdRate} />
          <BeforeAfter usdRate={usdRate} />
          <FeatureBento usdRate={usdRate} />
          <LandingSteps />
          <PricingPlans
            usdRate={usdRate}
            allLayouts={THEME_PRESETS.length}
            proMonthly={DEFAULT_PRO_PRICE_USD}
            proYearly={DEFAULT_PRO_PRICE_YEARLY_USD}
          />
          <LandingFaq />
          <ClosingCta />
        </main>
        <LandingFooter />
      </StoreNameProvider>
    </div>
  );
}
