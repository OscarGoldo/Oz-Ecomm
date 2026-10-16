import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  Check,
  ClipboardCheck,
  PackageCheck,
  Palette,
  Plus,
  Smartphone,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { TiendifyLogo } from "@/components/landing/tiendify-logo";
import {
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

/**
 * Es lo que se lee en negrita debajo de la imagen cuando alguien pega el link
 * en WhatsApp: tiene que decir qué es y que es gratis, no solo "Tiendify".
 */
export const metadata: Metadata = {
  title: { absolute: "Tiendify · Crea tu tienda online gratis" },
  description:
    "Tu tienda online lista hoy. Tus clientes pagan con Pago Móvil, Zelle, Binance, efectivo o tarjeta, con precios en dólares y bolívares.",
};

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
 * Preguntas frecuentes. Ordenadas por lo que frena el registro: primero si
 * "gratis" esconde algo, después cómo entra la plata, al final el plan Pro.
 *
 * Cada respuesta tiene que ser cierta hoy. Antes de prometer algo nuevo acá
 * (un aviso, un plazo de pago), verificar que exista y que esté activo en
 * producción: el aviso por WhatsApp al dueño, por ejemplo, depende de
 * variables de Meta que todavía no están puestas, y por eso no se menciona.
 */
const faqs = [
  {
    q: "¿De verdad es gratis? ¿Cuál es la trampa?",
    a: `No hay trampa. El plan Gratis es para siempre y no pide tarjeta: hasta ${FREE_MAX_PRODUCTS} productos, pedidos ilimitados y precios en dólares y bolívares. Pro es para cuando quieras crecer: más productos, todas las plantillas, cupones y analítica.`,
  },
  {
    q: "¿Tiendify se queda con un porcentaje de mis ventas?",
    a: "No. Lo que te pagan por Pago Móvil, Zelle, Binance o en efectivo llega directo a tu cuenta. Si cobras con tarjeta, solo se descuenta la comisión de Stripe, que procesa el pago. Tiendify no le suma nada.",
  },
  {
    q: "¿Cómo me pagan mis clientes?",
    a: "Con Pago Móvil, Zelle, Binance, transferencia o efectivo: el cliente sube su comprobante y tú confirmas el pago desde el panel. Si lo activas, también pueden pagar con tarjeta, Apple Pay o Google Pay.",
  },
  {
    q: "¿Tengo que actualizar la tasa del dólar todos los días?",
    a: "No. Pones tus precios en dólares y el equivalente en bolívares se calcula con la tasa del BCV, que se actualiza sola cada mañana. Si prefieres, puedes usar tu propia tasa.",
  },
  {
    q: "Ya vendo por Instagram y WhatsApp, ¿para qué quiero una tienda?",
    a: "Tu tienda no los reemplaza: los ordena. Pones el link en tu bio y tus clientes ven tus productos con sus precios, hacen el pedido y pagan sin tener que escribirte. Se acabó contestar «¿precio?» cincuenta veces al día.",
  },
  {
    q: "¿Necesito saber de diseño o programación?",
    a: "No. Eliges la plantilla de tu rubro, le pones tu logo y tu color y cargas tus productos. Todo se puede hacer desde el celular.",
  },
  {
    q: "¿Cómo me entero cuando alguien compra?",
    a: "Te llega un correo con cada pedido y lo ves al momento en tu panel. Al terminar la compra, tu cliente también puede avisarte por WhatsApp con un toque, y recibe el resumen de su pedido por correo. No necesita crear una cuenta para comprar.",
  },
  {
    q: "¿Cómo pago Pro? ¿Puedo cancelarlo?",
    a: `Cuesta $${DEFAULT_PRO_PRICE_USD} al mes o $${DEFAULT_PRO_PRICE_YEARLY_USD} al año. Si lo pagas por Pago Móvil, Zelle o Binance, no se renueva solo. Con tarjeta se renueva automáticamente y lo cancelas cuando quieras desde tu panel: sigues con Pro hasta el final del período que ya pagaste.`,
  },
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
                  o ${DEFAULT_PRO_PRICE_YEARLY_USD} al año (2 meses gratis)
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  <PlanFeature dark>Productos ilimitados</PlanFeature>
                  <PlanFeature dark>Tu propia dirección: tutienda.usatiendify.com</PlanFeature>
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

      {/* Preguntas frecuentes
          Va entre Precios y el cierre porque es justo ahí donde aparecen las
          dudas. Es <details> nativo y no un acordeón con estado: funciona sin
          JavaScript, se abre con teclado y la página sigue siendo un server
          component. Se pueden abrir varias a la vez a propósito, para poder
          comparar respuestas. */}
      <section
        id="preguntas"
        className="scroll-mt-24 border-t border-border bg-surface"
      >
        <div className="container grid gap-10 py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.75fr)] lg:gap-16">
          {/* Fijo en escritorio: con varias respuestas abiertas la lista se
              alarga y el titular no debería quedarse arriba solo. */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              eyebrow="Preguntas frecuentes"
              title="Lo que nos preguntan antes de empezar"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="group border-b border-border last:border-b-0"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-6 py-5 transition-colors hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <h3 className="text-pretty font-display text-[1.0625rem] font-semibold tracking-[-0.014em]">
                    {f.q}
                  </h3>
                  <Plus
                    aria-hidden="true"
                    className="size-4 shrink-0 text-ink-500 transition-transform duration-200 ease-out group-open:rotate-45 group-open:text-brand-600"
                    strokeWidth={2}
                  />
                </summary>
                <p className="max-w-prose px-6 pb-6 text-pretty text-sm leading-relaxed text-ink-600 group-open:duration-200 group-open:animate-in group-open:fade-in-0 group-open:slide-in-from-top-1">
                  {f.a}
                </p>
              </details>
            ))}
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
