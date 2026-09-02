import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PhoneMockup } from "@/components/landing/phone-mockup";
import { buttonVariants } from "@/components/ui/button";
import { getPublicUsdRate } from "@/lib/bcv";
import { FREE_MAX_PRODUCTS } from "@/lib/plans";
import { cn } from "@/lib/utils";

/** Lo que de verdad diferencia a Tiendify de un Shopify: cómo se cobra acá. */
const PAYMENTS = ["Pago Móvil", "Zelle", "Binance", "Efectivo", "PayPal"];

export async function LandingHero() {
  // La vista previa muestra precios en Bs con la tasa BCV real del día. Es la
  // misma que usan las tiendas, así que la landing demuestra la función en vez
  // de describirla. Si el cron todavía no cacheó nada, el mockup cae a USD.
  const usdRate = await getPublicUsdRate();

  return (
    <section className="relative overflow-hidden">
      {/*
        El fondo. Antes era una bola azul difuminada detrás del titular: ese
        blob es de las firmas más reconocibles de una página generada. Acá van
        dos cosas que sí construyen espacio: una retícula tenue que se apaga
        hacia abajo con una máscara, y un halo de marca muy abierto detrás del
        teléfono, que es donde queremos que caiga el ojo después del titular.
      */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--ink-200)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--ink-200)) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(120% 85% at 50% 0%, black 20%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(120% 85% at 50% 0%, black 20%, transparent 75%)",
            opacity: 0.5,
          }}
        />
        <div
          className="absolute right-[-10%] top-[-15%] hidden size-[38rem] rounded-full opacity-[0.14] blur-[90px] lg:block"
          style={{ background: "hsl(var(--brand-500))" }}
        />
      </div>

      <div className="container grid items-center gap-y-14 py-16 sm:py-24 lg:grid-cols-[1.05fr_1fr] lg:gap-x-12">
        {/* Copy */}
        <div className="text-center lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.07em] text-ink-600 shadow-xs">
            <span className="size-1.5 rounded-full bg-brand-500" aria-hidden="true" />
            Hecho para Venezuela
          </p>

          <h1 className="mt-5 text-balance font-display text-display-lg font-semibold sm:text-display-xl lg:text-display-2xl">
            Crea tu tienda online y empieza a vender hoy
          </h1>

          <p className="mx-auto mt-6 max-w-[38ch] text-pretty text-lg leading-relaxed text-ink-600 lg:mx-0">
            Catálogo, carrito y gestión de pedidos en un solo lugar. Tus
            clientes pagan como se paga aquí y suben el comprobante desde el
            teléfono.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center lg:justify-start">
            <Link
              href="/crear-tienda"
              className={cn(buttonVariants({ size: "lg" }), "group font-semibold")}
            >
              Crear mi tienda gratis
              <ArrowRight className="transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#precios"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "font-semibold",
              )}
            >
              Ver planes
            </Link>
          </div>

          <p className="mt-4 text-sm text-ink-500">
            Gratis hasta {FREE_MAX_PRODUCTS} productos. Sin tarjeta de crédito.
          </p>

          {/* Los métodos de pago, en texto y no en logos: son los nombres que
              el comerciante busca para saber si esto le sirve. */}
          <div className="mt-10 border-t border-border pt-5">
            <p className="text-3xs font-semibold uppercase tracking-[0.09em] text-ink-400">
              Cobra con
            </p>
            <ul className="mt-2.5 flex flex-wrap justify-center gap-x-2.5 gap-y-1.5 text-sm font-medium text-ink-600 lg:justify-start">
              {PAYMENTS.map((p, i) => (
                <li key={p} className="flex items-center gap-2.5">
                  {i > 0 && (
                    <span aria-hidden className="text-ink-300">
                      ·
                    </span>
                  )}
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Phone mockup */}
        <div className="flex justify-center lg:justify-end">
          <PhoneMockup bcvRate={usdRate} />
        </div>
      </div>
    </section>
  );
}
