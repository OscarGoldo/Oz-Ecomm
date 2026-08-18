import Link from "next/link";
import {
  BadgeDollarSign,
  Check,
  ClipboardCheck,
  PackageCheck,
  Palette,
  Smartphone,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { TiendifyLogo } from "@/components/landing/tiendify-logo";
import {
  DEFAULT_PRO_PRICE_QUARTERLY_USD,
  DEFAULT_PRO_PRICE_USD,
  DEFAULT_PRO_PRICE_YEARLY_USD,
  FREE_MAX_PRODUCTS,
} from "@/lib/plans";
import { FREE_LAYOUTS, THEME_PRESETS } from "@/lib/theme";

/**
 * La landing se prerenderiza y se revalida cada hora. Lo único que lee de la
 * base es la tasa BCV, que el cron actualiza una vez al día — no hay razón
 * para pagar una consulta por visita.
 */
export const revalidate = 3600;

const features = [
  {
    icon: Smartphone,
    title: "Tienda lista para el celular",
    text: "Tus clientes compran desde el teléfono, rápido y sin fricción.",
  },
  {
    icon: BadgeDollarSign,
    title: "Doble moneda USD / Bs",
    text: "Muestra precios en dólares con su equivalente en bolívares.",
  },
  {
    icon: Wallet,
    title: "Pagos locales",
    text: "Pago Móvil, Zelle, Binance o efectivo. Sube el comprobante y listo.",
  },
  {
    icon: PackageCheck,
    title: "Pedidos ordenados",
    text: "Confirma pagos y sigue cada entrega en un solo lugar.",
  },
  {
    icon: Palette,
    title: "Con tu marca",
    text: "Tu logo, tu color, tu link. Tu tienda se ve profesional.",
  },
  {
    icon: ClipboardCheck,
    title: "Sin complicaciones",
    text: "Cargas productos y empiezas a vender. Sin código, sin tarjeta.",
  },
];

const steps = [
  { n: "1", title: "Regístrate", text: "Crea tu tienda con tu correo en un minuto." },
  { n: "2", title: "Carga productos", text: "Sube fotos, precios y stock desde el panel." },
  { n: "3", title: "Vende", text: "Comparte tu link y recibe pedidos al instante." },
];

function PlanFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-background">
      {/* Nav */}
      <LandingHeader />

      {/* Hero */}
      <LandingHero />

      {/* Features */}
      <section id="funciones" className="scroll-mt-24 border-t bg-muted/30">
        <div className="container py-16">
          <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            Pensado para cómo se vende en Venezuela
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Doble moneda, pagos por comprobante y todo desde el teléfono. No es
            una tienda genérica traducida al español.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-card p-6">
                <span className="mb-4 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </span>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="container scroll-mt-24 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Empieza en 3 pasos
        </h2>
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="text-center">
              <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                {s.n}
              </span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plantillas */}
      <section id="plantillas" className="scroll-mt-24 border-t">
        <div className="container py-16">
          <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            Una plantilla para tu rubro
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            No es solo el color: cada plantilla cambia la estructura completa de
            la tienda. Se elige desde el panel y se cambia cuando quieras, sin
            perder productos ni pedidos.
          </p>

          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {THEME_PRESETS.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border bg-card p-3"
              >
                {/* Miniatura con los colores reales de la plantilla: fondo,
                    barra de marca y punto de acento. Es el mismo dato que
                    consume el storefront, no una captura. */}
                <span
                  aria-hidden
                  className="grid size-14 shrink-0 place-items-center gap-1 rounded-xl border p-2"
                  style={{ background: p.theme.colors.surface }}
                >
                  <span
                    className="h-1.5 w-full rounded-full"
                    style={{ background: p.theme.colors.primary }}
                  />
                  <span
                    className="h-4 w-full rounded"
                    style={{ background: `${p.theme.colors.primary}1a` }}
                  />
                  <span
                    className="h-1.5 w-1/2 justify-self-start rounded-full"
                    style={{ background: p.theme.colors.accent }}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{p.label}</p>
                    {!p.standard && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        Pro
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {p.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-sm text-muted-foreground">
            Las {FREE_LAYOUTS.length} marcadas sin etiqueta están en el plan
            Gratis. Las {THEME_PRESETS.length} vienen con Pro.
          </p>
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="scroll-mt-24 border-t bg-muted/30">
        <div className="container py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Empieza gratis. Crece cuando quieras.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Sin tarjeta de crédito. Pagas por Pago Móvil, Zelle o Binance cuando
            decidas pasar a Pro.
          </p>

          <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
            {/* Gratis */}
            <div className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold">Gratis</h3>
              <p className="mt-2 text-3xl font-bold tracking-tight">$0</p>
              <p className="text-sm text-muted-foreground">para siempre</p>
              <ul className="mt-5 space-y-2.5 text-sm">
                <PlanFeature>Hasta {FREE_MAX_PRODUCTS} productos</PlanFeature>
                <PlanFeature>
                  {FREE_LAYOUTS.length} plantillas (una por rubro)
                </PlanFeature>
                <PlanFeature>Pedidos y pagos ilimitados</PlanFeature>
                <PlanFeature>Precios en USD y Bs</PlanFeature>
                <PlanFeature>Finanzas y clientes</PlanFeature>
              </ul>
              <Button asChild variant="outline" className="mt-6 w-full">
                <Link href="/crear-tienda">Crear mi tienda</Link>
              </Button>
            </div>

            {/* Pro */}
            <div className="relative rounded-2xl border-2 border-primary bg-card p-6">
              <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                Recomendado
              </span>
              <h3 className="font-semibold">Pro</h3>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                ${DEFAULT_PRO_PRICE_USD}
                <span className="text-base font-normal text-muted-foreground">
                  /mes
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                o ${DEFAULT_PRO_PRICE_QUARTERLY_USD} por 3 meses · $
                {DEFAULT_PRO_PRICE_YEARLY_USD} al año (2 meses gratis)
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                <PlanFeature>Productos ilimitados</PlanFeature>
                <PlanFeature>Las {THEME_PRESETS.length} plantillas</PlanFeature>
                <PlanFeature>Analítica completa de tu tienda</PlanFeature>
                <PlanFeature>Cupones de descuento</PlanFeature>
                <PlanFeature>Sin el sello de Tiendify</PlanFeature>
              </ul>
              <Button asChild className="mt-6 w-full">
                <Link href="/crear-tienda">Empezar gratis</Link>
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Activas Pro desde tu panel cuando quieras.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-primary text-primary-foreground">
        <div className="container flex flex-col items-center gap-6 py-16 text-center">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Tu catálogo en línea, hoy mismo
          </h2>
          <p className="max-w-md text-primary-foreground/90">
            Creas la tienda, cargas tus productos y compartes el link. Eso es
            todo.
          </p>
          <Button asChild size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90">
            <Link href="/crear-tienda">
              Crear mi tienda gratis <span aria-hidden>→</span>
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container flex flex-col items-center justify-between gap-3 py-8 text-sm text-muted-foreground sm:flex-row">
          <TiendifyLogo />
          <span>
            © {new Date().getFullYear()} · Un producto de{" "}
            <span className="font-medium text-foreground">OzAI</span> · Hecho en
            Venezuela 🇻🇪
          </span>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/crear-tienda" className="hover:text-foreground">
              Crear tienda
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Ingresar
            </Link>
            <Link href="/terminos" className="hover:text-foreground">
              Términos
            </Link>
            <Link href="/privacidad" className="hover:text-foreground">
              Privacidad
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
