import Image from "next/image";
import { Plus } from "lucide-react";

import { SectionHeading, reveal, sectionY, wrap } from "@/components/landing/landing-ui";
import {
  DEFAULT_PRO_PRICE_USD,
  DEFAULT_PRO_PRICE_YEARLY_USD,
  FREE_MAX_PRODUCTS,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

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
 * Va entre Precios y el cierre porque es justo ahí donde aparecen las dudas.
 * Es <details> nativo y no un acordeón con estado: funciona sin JavaScript,
 * se abre con teclado y la sección sigue siendo un server component. Se
 * pueden abrir varias a la vez a propósito, para comparar respuestas. La
 * primera llega abierta: es la duda que más frena.
 */
export function LandingFaq() {
  return (
    <section id="preguntas" className={cn(sectionY, "scroll-mt-20 bg-claro-hondo")}>
      <div className={cn(wrap, "grid items-start gap-7 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] lg:gap-16")}>
        {/* Fijo en escritorio: con varias respuestas abiertas la lista se
            alarga y el titular no debería quedarse arriba solo. */}
        <div className="grid gap-[22px] lg:sticky lg:top-28">
          <Image
            {...reveal(0, "pop")}
            src="/pana-curiosa.svg"
            alt=""
            width={260}
            height={340}
            className="-ml-[18px] hidden h-auto w-[170px] lg:block"
          />
          <SectionHeading eyebrow="Preguntas frecuentes" title="Lo que nos preguntan antes de empezar." />
        </div>

        <div>
          {faqs.map((f, i) => (
            <details
              key={f.q}
              {...reveal(i * 60)}
              open={i === 0}
              className="group border-t border-linea last:border-b"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700 [&::-webkit-details-marker]:hidden">
                <h3 className="text-pretty font-landing-display text-[clamp(1.08rem,1rem+0.35vw,1.3rem)] font-bold leading-tight tracking-[-0.02em] [font-stretch:94%]">
                  {f.q}
                </h3>
                <span
                  aria-hidden="true"
                  className="grid size-[34px] shrink-0 place-items-center rounded-full border border-linea-fuerte transition-[rotate,background-color] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-open:border-sol group-open:bg-sol group-open:[rotate:45deg] group-hover:border-noche"
                >
                  <Plus className="size-3.5" strokeWidth={2.2} />
                </span>
              </summary>
              <p className="max-w-[64ch] pb-6 text-pretty leading-relaxed text-pizarra sm:pr-14">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
