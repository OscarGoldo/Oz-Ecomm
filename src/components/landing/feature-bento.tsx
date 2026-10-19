import { Lock } from "lucide-react";

import {
  AVATAR,
  Avatar,
  Eyebrow,
  SAMPLE,
  SectionHeading,
  reveal,
  sectionY,
  usd,
  wrap,
} from "@/components/landing/landing-ui";
import { RateConverter } from "@/components/landing/rate-converter";
import { StoreSlug } from "@/components/landing/store-name";
import { FREE_MAX_PRODUCTS } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * Las funciones, como rejilla de piezas de interfaz y no como seis tarjetas
 * con un ícono en un cuadrado teñido: ese patrón es el más fácil de reconocer
 * como página generada. Cada celda muestra la función funcionando.
 *
 * Todo lo que se afirma acá está en marketing/GUIA.md, "Lo que sí se puede
 * afirmar". Antes de sumar una celda, verificar que la función exista hoy.
 */

const tile =
  "flex min-w-0 flex-col gap-3.5 overflow-hidden rounded-[26px] border border-linea bg-white p-[26px] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-[3px] hover:shadow-[0_1px_2px_hsl(var(--noche)/0.05),0_6px_16px_-6px_hsl(var(--noche)/0.1)]";
const tileTitle =
  "text-balance font-landing-display text-[clamp(1.4rem,1.15rem+0.6vw,1.75rem)] font-extrabold leading-[1.04] tracking-[-0.032em] [font-stretch:88%]";
const tileText = "max-w-[46ch] text-pretty text-[15.5px] leading-relaxed text-pizarra";
const mini = "mt-auto grid gap-2.5 rounded-[18px] border border-linea bg-claro p-3.5";

const PAYMENTS = ["Pago Móvil", "Zelle", "Binance", "Transferencia", "Efectivo", "Tarjeta"];
const SIZES = [
  { size: "S", stock: 4 },
  { size: "M", stock: 7 },
  { size: "L", stock: 2 },
  { size: "XL", stock: 1 },
];

export function FeatureBento({ usdRate }: { usdRate: number | null }) {
  return (
    <section id="funciones" className={cn(sectionY, "scroll-mt-20 bg-claro-hondo")}>
      <div className={wrap}>
        <SectionHeading
          eyebrow="Funciones"
          title="Pensado para cómo se vende en Venezuela."
          text="Doble moneda, pagos por comprobante y todo desde el teléfono. No es una tienda genérica traducida al español."
        />

        <div className="mt-[60px] grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {/* Doble moneda: la celda grande, en noche */}
          <article
            {...reveal()}
            className={cn(
              tile,
              "grid items-center gap-7 border-noche-suave bg-noche text-claro sm:col-span-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:col-span-4",
            )}
          >
            <div className="grid gap-3.5">
              <Eyebrow className="text-sol">Doble moneda</Eyebrow>
              <h3 className={tileTitle}>Dólares y bolívares, con la tasa de cada mañana.</h3>
              <p className={cn(tileText, "text-niebla")}>
                Pones tus precios en dólares. El monto en bolívares sale de la
                tasa del BCV, que se actualiza sola. Si prefieres, usas tu propia
                tasa.
              </p>
            </div>
            {usdRate && <RateConverter rate={usdRate} />}
          </article>

          <article {...reveal(90)} className={cn(tile, "lg:col-span-2")}>
            <h3 className={tileTitle}>Cobra como se cobra aquí.</h3>
            <p className={tileText}>
              Tu cliente sube su comprobante desde el teléfono y tú confirmas el
              pago en tu panel.
            </p>
            <ul className="mt-auto flex flex-wrap gap-[7px] pt-2">
              {PAYMENTS.map((p) => (
                <li
                  key={p}
                  className="rounded-full border border-linea-fuerte px-3 py-[7px] text-sm font-semibold"
                >
                  {p}
                </li>
              ))}
            </ul>
          </article>

          <article {...reveal(0)} className={cn(tile, "lg:col-span-2")}>
            <h3 className={tileTitle}>Carritos que no se pierden.</h3>
            <p className={tileText}>
              Ves quién dejó productos en el carrito y le escribes por WhatsApp
              con el mensaje ya escrito.
            </p>
            <div className={mini} aria-hidden="true">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar initial="J" color={AVATAR.rosa} />
                <div className="grid min-w-0 leading-snug">
                  <b className="text-[14.5px]">José R.</b>
                  <span className="text-[13px] text-pizarra">
                    2 productos · {usd(SAMPLE.franela.usd + SAMPLE.gorra.usd)}
                  </span>
                </div>
              </div>
              <span className="inline-flex min-h-[34px] items-center justify-self-start rounded-full bg-noche px-3 text-[13px] font-bold text-white">
                Escribirle por WhatsApp
              </span>
            </div>
          </article>

          <article {...reveal(90)} className={cn(tile, "lg:col-span-2")}>
            <h3 className={tileTitle}>Tallas y colores con su propio stock.</h3>
            <p className={tileText}>Cada variante lleva su inventario, en todos los planes.</p>
            <div className={mini} aria-hidden="true">
              <div className="flex items-center justify-between gap-2.5">
                <b className="text-[14.5px]">{SAMPLE.franela.name}</b>
                <span className="flex gap-1.5">
                  {["#151515", "#F4F1EA", "#C8B596"].map((c, i) => (
                    <span
                      key={c}
                      className={cn(
                        "size-[18px] rounded-full shadow-[inset_0_0_0_1px_hsl(var(--noche)/0.18)]",
                        i === 0 && "outline outline-2 outline-offset-2 outline-brand-700",
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </span>
              </div>
              <ul className="grid grid-cols-4 gap-1.5">
                {SIZES.map((s) => (
                  <li
                    key={s.size}
                    className={cn(
                      "grid justify-items-center gap-0.5 rounded-xl border bg-white py-2",
                      s.size === "M" ? "border-noche shadow-[inset_0_0_0_1px_hsl(var(--noche))]" : "border-linea-fuerte",
                    )}
                  >
                    <b className="text-sm">{s.size}</b>
                    <span className="font-landing-mono text-[11.5px] text-gris">{s.stock}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article {...reveal(180)} className={cn(tile, "lg:col-span-2")}>
            <h3 className={tileTitle}>Te enteras de cada pedido.</h3>
            <p className={tileText}>
              Te llega un correo con cada pedido y lo ves al momento en tu panel.
            </p>
            <div className={mini} aria-hidden="true">
              <div className="flex justify-between font-landing-mono text-xs text-gris">
                <span>Tiendify</span>
                <span>ahora</span>
              </div>
              <b className="text-[15px]">Nuevo pedido #131</b>
              <span className="text-[13.5px] text-pizarra">
                Andrea R. · {SAMPLE.franela.name} · {usd(SAMPLE.franela.usd)}
              </span>
            </div>
          </article>

          <article {...reveal(0)} className={cn(tile, "lg:col-span-3")}>
            <h3 className={tileTitle}>Tu propia dirección.</h3>
            <p className={tileText}>
              Tu tienda vive en su propio subdominio desde el plan Gratis. Es el
              link que pones en tu bio.
            </p>
            <div
              aria-hidden="true"
              className="mt-auto flex min-w-0 items-center gap-3 rounded-2xl border border-linea bg-claro px-3.5 py-3"
            >
              <span className="flex shrink-0 gap-[5px]">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-[9px] rounded-full bg-linea-fuerte" />
                ))}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-[7px] overflow-hidden whitespace-nowrap rounded-[10px] border border-linea bg-white px-3 py-2 font-landing-mono text-sm">
                <Lock className="size-[13px] shrink-0 text-success-text" strokeWidth={2.2} />
                <span className="truncate">
                  <b className="font-semibold text-brand-700">
                    <StoreSlug />
                  </b>
                  .usatiendify.com
                </span>
              </span>
            </div>
          </article>

          <article {...reveal(90)} className={cn(tile, "lg:col-span-3")}>
            <h3 className={tileTitle}>Todo desde el celular.</h3>
            <p className={tileText}>
              Cargas productos, confirmas pagos y revisas tus finanzas desde el
              teléfono. No necesitas computadora.
            </p>
            <div className={mini} aria-hidden="true">
              <div className="flex items-baseline justify-between text-sm text-pizarra">
                <span>Productos en plan Gratis</span>
                <b className="font-landing-mono text-[14.5px] text-noche">
                  24 de {FREE_MAX_PRODUCTS}
                </b>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-linea">
                <div
                  className="reveal-fill h-full rounded-full bg-brand-500"
                  style={{ width: `${(24 / FREE_MAX_PRODUCTS) * 100}%` }}
                />
              </div>
              <div className="flex items-baseline justify-between border-t border-linea pt-2 text-sm text-pizarra">
                <span>Pedidos de hoy</span>
                <b className="font-landing-mono text-[14.5px] text-noche">6</b>
              </div>
              <div className="flex items-baseline justify-between border-t border-linea pt-2 text-sm text-pizarra">
                <span>Pagos por confirmar</span>
                <b className="font-landing-mono text-[14.5px] text-noche">2</b>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
