import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { PhoneMockup } from "@/components/landing/phone-mockup";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="container grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-2">
        {/* Copy */}
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" /> Ecommerce para emprendedores de Venezuela
          </span>
          <h1 className="mt-4 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Crea tu tienda online y empieza a vender hoy
          </h1>
          <p className="mx-auto mt-5 max-w-md text-lg text-muted-foreground lg:mx-0">
            Catálogo, carrito, pagos locales y gestión de pedidos. Todo en un
            solo lugar, sin complicaciones y sin programar.
          </p>

          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <Link
              href="/crear-tienda"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 sm:w-auto"
            >
              Crear mi tienda gratis <ArrowRight className="size-4" />
            </Link>
            <Link
              href="#precios"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border px-7 font-semibold transition-colors hover:bg-muted sm:w-auto"
            >
              Ver planes
            </Link>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Gratis. Sin tarjeta. Tu tienda lista en minutos.
          </p>
        </div>

        {/* Phone mockup */}
        <div className="flex justify-center lg:justify-end">
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}
