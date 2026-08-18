import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PhoneMockup } from "@/components/landing/phone-mockup";
import { FREE_MAX_PRODUCTS } from "@/lib/plans";

/** Lo que de verdad diferencia a Tiendify de un Shopify: cómo se cobra acá. */
const PAYMENTS = ["Pago Móvil", "Zelle", "Binance", "Efectivo", "PayPal"];

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
          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Crea tu tienda online y empieza a vender hoy
          </h1>
          <p className="mx-auto mt-5 max-w-md text-lg text-muted-foreground lg:mx-0">
            Catálogo, carrito y gestión de pedidos en un solo lugar. Tus
            clientes pagan como se paga aquí y suben el comprobante desde el
            teléfono.
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
            Gratis hasta {FREE_MAX_PRODUCTS} productos. Sin tarjeta de crédito.
          </p>

          {/* Los métodos de pago, en texto y no en logos: son los nombres que
              el comerciante busca para saber si esto le sirve. */}
          <ul className="mt-6 flex flex-wrap justify-center gap-x-2 gap-y-1.5 text-xs font-medium text-muted-foreground lg:justify-start">
            {PAYMENTS.map((p, i) => (
              <li key={p} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden className="text-border">·</span>}
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Phone mockup */}
        <div className="flex justify-center lg:justify-end">
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}
