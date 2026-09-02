import Link from "next/link";
import {
  ArrowRight,
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

/**
 * Encabezado de sección. Existe para que las cinco secciones compartan el
 * mismo ritmo —rótulo, titular, bajada— en vez de que cada una resuelva su
 * jerarquía a mano, que es de donde sale el aspecto de página armada por
 * partes. El rótulo chico en versalitas es lo que le da a la sección un
 * "encima" y evita que el titular arranque flotando.
 */
function SectionHeading({
  eyebrow,
  title,
  text,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  text?: string;
  align?: "left" | "center";
}) {
  const centered = align === "center";
  return (
    <div className={centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-3xs font-semibold uppercase tracking-[0.09em] text-brand-700">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-balance font-display text-display-sm font-semibold sm:text-display-md">
        {title}
      </h2>
      {text && (
        <p className="mt-4 text-pretty text-lg leading-relaxed text-ink-600">
          {text}
        </p>
      )}
    </div>
  );
}

function PlanFeature({
  children,
  dark = false,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <Check
        className={`mt-0.5 size-4 shrink-0 ${dark ? "text-brand-300" : "text-brand-600"}`}
        strokeWidth={2.5}
      />
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

      {/* Features
          Rejilla de una sola línea compartida en lugar de seis tarjetas con
          borde propio: las tarjetas sueltas con el ícono metido en un cuadrado
          teñido de color de marca son el patrón de página generada más fácil de
          reconocer. Acá las celdas comparten las divisiones y el ícono va en
          tinta, que es como se compone una tabla de funciones. */}
      <section id="funciones" className="scroll-mt-24 border-t border-border bg-surface">
        <div className="container py-20">
          <SectionHeading
            eyebrow="Funciones"
            title="Pensado para cómo se vende en Venezuela"
            text="Doble moneda, pagos por comprobante y todo desde el teléfono. No es una tienda genérica traducida al español."
          />

          <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group border-b border-r border-border p-7 transition-colors last:border-b-0 hover:bg-ink-50 sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-last-child(-n+3)]:border-b-0"
                >
                  <f.icon
                    className="size-5 text-ink-700 transition-colors group-hover:text-brand-600"
                    strokeWidth={1.75}
                  />
                  <h3 className="mt-5 font-display text-[1.0625rem] font-semibold tracking-[-0.014em]">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-pretty text-sm leading-relaxed text-ink-500">
                    {f.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="como-funciona"
        className="container scroll-mt-24 border-t border-border py-20"
      >
        <SectionHeading
          eyebrow="Cómo funciona"
          title="Empieza en 3 pasos"
          align="center"
        />
        <ol className="mx-auto mt-14 grid max-w-4xl gap-10 sm:grid-cols-3 sm:gap-8">
          {steps.map((s, i) => (
            <li key={s.n} className="relative">
              {/* La línea que une los pasos. Solo entre columnas y solo en
                  escritorio: en móvil los pasos ya se leen apilados y la
                  línea horizontal no tendría a dónde ir. */}
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[calc(2.25rem+0.75rem)] right-[-2rem] top-4 hidden h-px bg-border sm:block"
                />
              )}
              <span className="relative grid size-9 place-items-center rounded-full border border-border bg-card font-display text-sm font-semibold tabular-nums shadow-xs">
                {s.n}
              </span>
              <h3 className="mt-5 font-display text-[1.0625rem] font-semibold tracking-[-0.014em]">
                {s.title}
              </h3>
              <p className="mt-1.5 text-pretty text-sm leading-relaxed text-ink-500">
                {s.text}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Plantillas */}
      <section
        id="plantillas"
        className="scroll-mt-24 border-t border-border bg-surface"
      >
        <div className="container py-20">
          <SectionHeading
            eyebrow="Plantillas"
            title="Una plantilla para tu rubro"
            text="No es solo el color: cada plantilla cambia la estructura completa de la tienda. Se elige desde el panel y se cambia cuando quieras, sin perder productos ni pedidos."
          />

          <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {THEME_PRESETS.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-3 shadow-xs transition-[border-color,box-shadow] duration-150 ease-out hover:border-ink-300 hover:shadow-sm"
              >
                {/* Miniatura con los colores reales de la plantilla: fondo,
                    barra de marca y punto de acento. Es el mismo dato que
                    consume el storefront, no una captura. */}
                <span
                  aria-hidden
                  className="grid size-14 shrink-0 place-items-center gap-1 rounded-lg border border-border p-2"
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
                    <p className="truncate text-sm font-semibold tracking-[-0.011em]">
                      {p.label}
                    </p>
                    {!p.standard && (
                      <span className="shrink-0 rounded border border-border bg-ink-900 px-1.5 py-0.5 text-3xs font-bold uppercase tracking-[0.05em] text-ink-25">
                        Pro
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-ink-500">{p.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-5 text-sm text-ink-500">
            Las {FREE_LAYOUTS.length} marcadas sin etiqueta están en el plan
            Gratis. Las {THEME_PRESETS.length} vienen con Pro.
          </p>
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="scroll-mt-24 border-t border-border">
        <div className="container py-20">
          <SectionHeading
            eyebrow="Precios"
            title="Empieza gratis. Crece cuando quieras."
            text="Sin tarjeta de crédito. Pagas por Pago Móvil, Zelle o Binance cuando decidas pasar a Pro."
            align="center"
          />

          <div className="mx-auto mt-14 grid max-w-3xl items-start gap-5 sm:grid-cols-2">
            {/* Gratis */}
            <div className="rounded-2xl border border-border bg-card p-7 shadow-xs">
              <h3 className="text-sm font-semibold uppercase tracking-[0.06em] text-ink-500">
                Gratis
              </h3>
              <p className="mt-3 font-display text-display-sm font-semibold tabular-nums">
                $0
              </p>
              <p className="mt-1 text-sm text-ink-500">para siempre</p>
              <ul className="mt-6 space-y-3 text-sm">
                <PlanFeature>Hasta {FREE_MAX_PRODUCTS} productos</PlanFeature>
                <PlanFeature>
                  {FREE_LAYOUTS.length} plantillas (una por rubro)
                </PlanFeature>
                <PlanFeature>Pedidos y pagos ilimitados</PlanFeature>
                <PlanFeature>Precios en USD y Bs</PlanFeature>
                <PlanFeature>Finanzas y clientes</PlanFeature>
              </ul>
              <Button asChild variant="outline" className="mt-7 w-full">
                <Link href="/crear-tienda">Crear mi tienda</Link>
              </Button>
            </div>

            {/* Pro. En tinta y no con un borde azul de dos píxeles: el plan
                recomendado tiene que ganar por peso visual, no por un contorno
                de color. Un bloque oscuro entre dos claros es la jerarquía más
                barata y más clara que hay. */}
            <div className="relative overflow-hidden rounded-2xl bg-ink-950 p-7 text-ink-100 shadow-lg">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-50"
                style={{
                  background:
                    "radial-gradient(75% 55% at 88% 0%, hsl(var(--brand-500) / 0.34), transparent 68%)",
                }}
              />
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.06em] text-ink-400">
                    Pro
                  </h3>
                  <span className="rounded border border-white/15 bg-white/10 px-2 py-0.5 text-3xs font-bold uppercase tracking-[0.05em] text-brand-200">
                    Recomendado
                  </span>
                </div>
                <p className="mt-3 font-display text-display-sm font-semibold tabular-nums text-ink-0">
                  ${DEFAULT_PRO_PRICE_USD}
                  <span className="font-sans text-base font-normal tracking-normal text-ink-400">
                    /mes
                  </span>
                </p>
                <p className="mt-1 text-sm text-ink-400">
                  o ${DEFAULT_PRO_PRICE_QUARTERLY_USD} por 3 meses · $
                  {DEFAULT_PRO_PRICE_YEARLY_USD} al año (2 meses gratis)
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  <PlanFeature dark>Productos ilimitados</PlanFeature>
                  <PlanFeature dark>
                    Las {THEME_PRESETS.length} plantillas
                  </PlanFeature>
                  <PlanFeature dark>Analítica completa de tu tienda</PlanFeature>
                  <PlanFeature dark>Cupones de descuento</PlanFeature>
                  <PlanFeature dark>Sin el sello de Tiendify</PlanFeature>
                </ul>
                <Button
                  asChild
                  className="mt-7 w-full bg-ink-0 text-ink-950 hover:bg-ink-0/90"
                >
                  <Link href="/crear-tienda">Empezar gratis</Link>
                </Button>
                <p className="mt-3 text-center text-xs text-ink-400">
                  Activas Pro desde tu panel cuando quieras.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA band. Antes era una banda a todo color de marca; en tinta con el
          halo azul detrás pesa lo mismo y no compite con el logo. */}
      <section className="border-t border-border px-4 py-10 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-ink-950 px-6 py-20 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(55% 60% at 50% 108%, hsl(var(--brand-500) / 0.42), transparent 70%)",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
          <div className="relative flex flex-col items-center gap-6">
            <h2 className="max-w-[18ch] text-balance font-display text-display-md font-semibold text-ink-0 sm:text-display-lg">
              Tu catálogo en línea, hoy mismo
            </h2>
            <p className="max-w-md text-pretty text-lg leading-relaxed text-ink-300">
              Creas la tienda, cargas tus productos y compartes el link. Eso es
              todo.
            </p>
            <Button
              asChild
              size="lg"
              className="group mt-2 bg-ink-0 font-semibold text-ink-950 hover:bg-ink-0/90"
            >
              <Link href="/crear-tienda">
                Crear mi tienda gratis
                <ArrowRight className="transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-4 py-9 text-sm text-ink-500 sm:flex-row">
          <TiendifyLogo />
          <span className="order-last text-center sm:order-none">
            © {new Date().getFullYear()} · Un producto de{" "}
            <span className="font-medium text-foreground">OzAI</span> · Hecho en
            Venezuela 🇻🇪
          </span>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <Link href="/crear-tienda" className="transition-colors hover:text-foreground">
              Crear tienda
            </Link>
            <Link href="/login" className="transition-colors hover:text-foreground">
              Ingresar
            </Link>
            <Link href="/terminos" className="transition-colors hover:text-foreground">
              Términos
            </Link>
            <Link href="/privacidad" className="transition-colors hover:text-foreground">
              Privacidad
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
