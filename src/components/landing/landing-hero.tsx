import { Check, Lock, ShoppingBag } from "lucide-react";

import {
  ProductPhoto,
  SAMPLE,
  Sticker,
  TagOutline,
  bsShort,
  rateText,
  usd,
  wrap,
} from "@/components/landing/landing-ui";
import { CheckoutScreen, PhoneFrame, type StoreTheme } from "@/components/landing/store-screens";
import { StoreClaimForm, StoreName, StoreSlug } from "@/components/landing/store-name";
import { cn } from "@/lib/utils";

/**
 * El hero. Fondo azul de marca con titular en noche, como los posts de
 * Instagram: quien llega desde un post tiene que reconocerlo de inmediato.
 *
 * El fondo no es una bola difuminada (de las firmas más reconocibles de una
 * página generada) sino el contorno de la etiqueta del logo, enorme y tenue.
 *
 * La tasa la recibe de la página, que la lee una sola vez para todas las
 * secciones.
 */
export function LandingHero({ usdRate }: { usdRate: number | null }) {
  return (
    <section
      id="inicio"
      className="relative isolate scroll-mt-20 overflow-hidden bg-brand-500 pt-[86px] text-noche"
    >
      <TagOutline className="pointer-events-none absolute -right-[14%] -top-[10%] -z-10 w-[min(78vw,980px)] text-white/30" />

      <div
        className={`${wrap} grid items-center gap-7 pb-16 pt-11 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-10 lg:pb-20 lg:pt-14`}
      >
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full bg-white py-2 pl-[11px] pr-3.5 font-landing-mono text-xs font-semibold uppercase tracking-[0.06em] shadow-[0_1px_0_hsl(var(--noche)/0.2)]">
            <span className="size-2 rounded-full bg-brand-500" aria-hidden="true" />
            Hecho para vender en Venezuela
          </p>

          <h1 className="mt-[22px] text-balance font-landing-display text-[clamp(2.75rem,1.3rem+5.3vw,5.9rem)] font-extrabold leading-[0.92] tracking-[-0.047em] [font-stretch:82%]">
            Tu tienda online, en dólares y <Sticker>bolívares.</Sticker>
          </h1>

          <p className="mt-6 max-w-[50ch] text-pretty text-[clamp(1.06rem,0.98rem+0.35vw,1.26rem)] leading-[1.55] text-noche/90">
            Pon el link en tu bio y deja que tus clientes compren solos: ven
            cada precio en las dos monedas, hacen su pedido y te pagan por Pago
            Móvil, Zelle o Binance. Tú confirmas desde el teléfono.
          </p>

          <div className="mt-[30px]">
            <StoreClaimForm
              id="tienda-hero"
              label="Escribe el nombre de tu negocio y mira cómo queda"
              tone="flood"
              animatePlaceholder
            />
          </div>
        </div>

        <p className="sr-only">
          Vista previa: la tienda en un navegador, con precios en dólares y
          bolívares, y el checkout en un teléfono pagando por Pago Móvil.
        </p>
        <HeroStage rate={usdRate} />
      </div>
    </section>
  );
}

/** La tienda del hero: la del negocio que la persona escribe, en blanco y noche. */
const HERO_THEME: StoreTheme = {
  p: "#0B1B2B",
  pi: "#FFFFFF",
  a: "#0EA5E9",
  ai: "#FFFFFF",
  s: "#FFFFFF",
  k: "#0B1B2B",
  sf: "var(--font-landing-display)",
  r: "10px",
};

const HERO_PRODUCTS = [SAMPLE.franela, SAMPLE.gorra, SAMPLE.tote, SAMPLE.lentes];
/**
 * Cuánto sube cada pieza del hero al bajar (ver .hero-drift en globals.css):
 * la tienda poco, el teléfono más y el aviso más todavía, así se leen en capas.
 */
const drift = (px: number) => ({ "--drift": px + "px" }) as React.CSSProperties;

/** El pedido del aviso y del checkout: franela + gorra. */
const HERO_ORDER = SAMPLE.franela.usd + SAMPLE.gorra.usd;

/**
 * Como los pantallazos de producto de las plataformas grandes: la tienda vista
 * en un navegador y, encima, el checkout en el teléfono, con el aviso del
 * pedido que entra. Las posiciones usan `translate`/`scale`/`rotate` sueltos y
 * las entradas animan `transform`, así una no pisa a la otra.
 */
function HeroStage({ rate }: { rate: number | null }) {
  return (
    <div
      aria-hidden="true"
      className="relative h-[440px] w-full max-w-[420px] justify-self-center sm:h-[560px] sm:max-w-[600px] lg:justify-self-end"
    >
      {/* La tienda en el navegador */}
      <div className="hero-drift absolute left-0 top-[58px] w-full sm:top-16 sm:w-[90%]" style={drift(-24)}>
        <div className="overflow-hidden rounded-2xl bg-white text-noche shadow-[0_2px_6px_hsl(var(--noche)/0.12),0_44px_70px_-30px_hsl(var(--noche)/0.6)] motion-safe:animate-landing-rise">
          <div className="flex h-9 items-center gap-3 border-b border-[#E1E8EF] bg-[#EEF3F8] px-3">
            <span className="flex shrink-0 gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-[9px] rounded-full bg-[#C9D5E1]" />
              ))}
            </span>
            <span className="mx-auto flex h-[22px] max-w-[300px] flex-1 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-[7px] bg-white px-2 font-landing-mono text-[10.5px] font-medium text-gris">
              <Lock className="size-2.5 shrink-0" strokeWidth={2.2} />
              usatiendify.com/
              <b className="truncate font-semibold text-noche">
                <StoreSlug />
              </b>
            </span>
          </div>

          <div className="grid gap-[9px] px-3 pb-3 pt-2.5 sm:gap-3 sm:px-[18px] sm:pb-[18px] sm:pt-3.5">
            <div className="flex min-w-0 items-center gap-[18px]">
              <span className="min-w-0 truncate font-landing-display text-[17px] font-extrabold leading-none tracking-[-0.03em] [font-stretch:90%]">
                <StoreName />
              </span>
              <span className="ml-auto hidden gap-3.5 whitespace-nowrap text-[11px] font-semibold text-gris sm:flex">
                <span>Inicio</span>
                <span>Catálogo</span>
                <span>Ofertas</span>
                <span>Contacto</span>
              </span>
              <span className="relative ml-auto shrink-0 sm:ml-0">
                <ShoppingBag className="size-5" strokeWidth={1.8} />
                <span className="absolute -right-1.5 -top-1.5 grid size-[15px] place-items-center rounded-full bg-brand-500 text-[8.5px] font-bold text-white">
                  2
                </span>
              </span>
            </div>

            <div className="grid min-h-[96px] grid-cols-[1.25fr_1fr] overflow-hidden rounded-[14px] bg-noche text-white sm:min-h-[126px]">
              <div className="grid content-center gap-1.5 p-3 sm:px-[18px] sm:py-4">
                <p className="font-landing-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-sky-300">
                  Nueva colección
                </p>
                <p className="font-landing-display text-[17px] font-extrabold leading-none tracking-[-0.03em] [font-stretch:84%] sm:text-[23px]">
                  Lo nuevo de la semana
                </p>
                <span className="mt-1 justify-self-start rounded-full bg-sol px-3 py-[7px] text-[10.5px] font-bold text-noche">
                  Ver productos
                </span>
              </div>
              <ProductPhoto src={SAMPLE.franela.photo} sizes="240px" priority className="h-full" />
            </div>

            {rate && (
              <div className="hidden items-center justify-between rounded-[10px] bg-claro px-3 py-[7px] font-landing-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-gris sm:flex">
                <span>Tasa BCV</span>
                <b className="text-[10.5px] tracking-normal text-noche">{rateText(rate)} Bs/$</b>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {HERO_PRODUCTS.map((p, i) => (
                <div
                  key={p.name}
                  className={cn(
                    "min-w-0 overflow-hidden rounded-xl border border-linea",
                    i === 3 && "max-sm:hidden",
                  )}
                >
                  <ProductPhoto src={p.photo} sizes="140px" priority className="aspect-square" />
                  <div className="grid gap-px px-2 pb-2 pt-1.5">
                    <span className="truncate text-[9.5px] font-semibold text-pizarra">{p.name}</span>
                    <span className="font-landing-display text-[12.5px] font-extrabold leading-tight tracking-[-0.02em]">
                      ${p.usd}
                    </span>
                    {rate && (
                      <span className="font-landing-mono text-[8.5px] text-gris">{bsShort(p.usd, rate)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* El checkout en el teléfono */}
      <div className="hero-drift absolute -right-1.5 bottom-0 z-[2] [scale:0.66] [transform-origin:100%_100%] sm:right-0 sm:[scale:1]" style={drift(-72)}>
        <div className="motion-safe:animate-landing-rise" style={{ animationDelay: "200ms" }}>
          <PhoneFrame theme={HERO_THEME}>
            <CheckoutScreen
              name={<StoreName />}
              slug={<StoreSlug />}
              method="pm"
              total={HERO_ORDER}
              rate={rate}
            />
          </PhoneFrame>
        </div>
      </div>

      {/* El aviso: un pedido concreto dice más que "¡Nueva venta!" */}
      <div className="hero-drift absolute right-0 top-0 z-[3] [scale:0.84] [transform-origin:100%_0] sm:right-[14%] sm:[scale:1]" style={drift(-110)}>
        <div className="flex items-center gap-2.5 rounded-2xl bg-white py-2.5 pl-2.5 pr-4 text-noche shadow-[0_2px_6px_hsl(var(--noche)/0.1),0_30px_50px_-18px_hsl(var(--noche)/0.45)] [rotate:2deg] motion-safe:animate-landing-pop">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-success-surface text-success-text">
            <Check className="size-[17px]" strokeWidth={2.6} />
          </span>
          <div>
            <b className="block text-[13px] leading-tight">Nuevo pedido #131</b>
            <span className="block text-[11.5px] leading-snug text-gris">
              {usd(HERO_ORDER)} · Pago Móvil · con comprobante
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
