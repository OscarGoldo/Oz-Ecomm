"use client";

import { useEffect, useRef, useState } from "react";

import { PHOTO, SectionHeading, sectionY, wrap } from "@/components/landing/landing-ui";
import {
  CartScreen,
  CheckoutScreen,
  DoneScreen,
  PhoneFrame,
  ProductScreen,
  ShowcaseScreen,
  cartTotal,
  type ExampleStore,
} from "@/components/landing/store-screens";
import { cn } from "@/lib/utils";

/**
 * Tiendas de ejemplo: inventadas, con productos y fotos reales. Muestran el
 * camino completo del cliente en cinco pantallas, y al cambiar de tienda el
 * mismo camino se ve con otros productos, colores y forma de pago.
 *
 * Las tiendas se presentan como ejemplo, no como clientes: no se inventan
 * comerciantes ni testimonios (marketing/GUIA.md).
 */
const STORES: ExampleStore[] = [
  {
    name: "Voltio",
    rubro: "Tecnología",
    slug: "voltio",
    theme: {
      p: "#1E40AF",
      pi: "#FFFFFF",
      a: "#06B6D4",
      ai: "#04252C",
      s: "#F8FAFC",
      k: "#0F172A",
      sf: "var(--font-landing-display)",
      r: "10px",
    },
    kick: "Envíos a todo el país",
    title: "Audio y accesorios",
    cats: ["Todo", "Audio", "Relojes", "Carga"],
    products: [
      { name: "Audífonos Pulse", usd: 39, photo: PHOTO.audifonos },
      { name: "Reloj Fit 2", usd: 45, photo: PHOTO.reloj },
      { name: "Corneta Mini", usd: 29, photo: PHOTO.corneta },
      { name: "Power bank 10.000", usd: 20, photo: PHOTO.powerbank },
    ],
    option: { label: "Color", values: ["Negro", "Blanco", "Azul"], selected: 0 },
    cart: [
      { product: 0, option: "Negro", qty: 1 },
      { product: 3, option: "10.000 mAh", qty: 1 },
    ],
    method: "binance",
    order: 512,
  },
  {
    name: "Flor de Mayo",
    rubro: "Belleza",
    slug: "flor-de-mayo",
    theme: {
      p: "#B4528A",
      pi: "#FFFFFF",
      a: "#7FB6A1",
      ai: "#12382C",
      s: "#FDF6F8",
      k: "#3A1F2C",
      sf: "var(--font-landing-body)",
      r: "999px",
    },
    kick: "Cuidado de la piel",
    title: "Tu rutina, en casa",
    cats: ["Todo", "Rostro", "Labios", "Fragancias"],
    products: [
      { name: "Sérum vitamina C", usd: 22, photo: PHOTO.serum },
      { name: "Labial mate", usd: 9, photo: PHOTO.labial },
      { name: "Crema hidratante", usd: 16, photo: PHOTO.crema },
      { name: "Perfume Brisa", usd: 38, photo: PHOTO.perfume },
    ],
    option: { label: "Tamaño", values: ["15 ml", "30 ml"], selected: 1 },
    cart: [
      { product: 0, option: "30 ml", qty: 1 },
      { product: 1, option: "Rojo", qty: 2 },
    ],
    method: "zelle",
    order: 96,
  },
];

/** El orden es información: son los pasos reales del cliente. */
const STEPS = [
  "Abre tu link y mira la vitrina.",
  "Elige talla, color o tamaño.",
  "Revisa el carrito en $ y Bs.",
  "Paga como se paga aquí.",
  "Sube el capture y te avisa por WhatsApp.",
];

export function ExampleStores({ usdRate }: { usdRate: number | null }) {
  const [current, setCurrent] = useState(0);
  // Arranca apagado y se prende después de montar: con "reducir movimiento"
  // la barrita duraría 0 s y las tiendas pasarían solas sin parar.
  const [auto, setAuto] = useState(false);
  const phones = useRef<(HTMLDivElement | null)[]>([]);
  const firstRender = useRef(true);

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setAuto(true);
  }, []);

  // Al cambiar de tienda los teléfonos se reacomodan escalonados.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    phones.current.forEach((el, i) =>
      el?.animate(
        [
          { transform: "translateY(10px)", opacity: 0.35 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 400, delay: i * 45, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" },
      ),
    );
  }, [current]);

  const store = STORES[current]!;
  const total = cartTotal(store);
  const screens = [
    <ShowcaseScreen key="vitrina" store={store} rate={usdRate} />,
    <ProductScreen key="producto" store={store} rate={usdRate} />,
    <CartScreen key="carrito" store={store} rate={usdRate} />,
    <CheckoutScreen key="pago" name={store.name} slug={store.slug} method={store.method} total={total} rate={usdRate} />,
    <DoneScreen key="listo" store={store} rate={usdRate} />,
  ];

  return (
    <section id="tiendas" className={cn(sectionY, "group/tiendas scroll-mt-20")}>
      <div className={wrap}>
        <SectionHeading
          eyebrow="Tiendas de ejemplo"
          title="Así compra tu cliente, de la vitrina al pago."
          text="Cinco pantallas con los mismos pasos que recorre tu cliente hoy. Las tiendas son inventadas: cambia de tienda y mira el mismo camino con otros productos y otros colores."
        />

        <div className="mt-10 flex flex-wrap gap-2.5" role="group" aria-label="Elegir una tienda de ejemplo">
          {STORES.map((s, i) => {
            const on = i === current;
            return (
              <button
                key={s.slug}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setAuto(false);
                  setCurrent(i);
                }}
                className={cn(
                  "relative flex min-h-14 items-center gap-[11px] overflow-hidden rounded-2xl border bg-white py-2 pl-[9px] pr-[18px] text-left transition-[border-color,box-shadow] duration-200",
                  on ? "border-noche shadow-[inset_0_0_0_1px_hsl(var(--noche))]" : "border-linea-fuerte hover:border-noche",
                )}
              >
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-[11px] font-[family-name:var(--sf)] text-[15px] font-bold"
                  style={{ background: s.theme.p, color: s.theme.pi, ["--sf" as string]: s.theme.sf }}
                >
                  {s.name.charAt(0)}
                </span>
                <span>
                  <b className="block text-[15px] leading-tight">{s.name}</b>
                  <small className="block text-[12.5px] text-pizarra">{s.rubro}</small>
                </span>
                {/* Cuánto falta para la siguiente tienda. Se pausa al pasar
                    el mouse o enfocar algo de la sección. */}
                {on && auto && (
                  <span
                    key={`progreso-${current}`}
                    aria-hidden="true"
                    onAnimationEnd={() => setCurrent((c) => (c + 1) % STORES.length)}
                    className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-noche animate-store-progress group-focus-within/tiendas:[animation-play-state:paused] group-hover/tiendas:[animation-play-state:paused]"
                  />
                )}
              </button>
            );
          })}
        </div>
        <p className="sr-only" aria-live="polite">
          Mostrando la tienda de ejemplo {store.name}, de {store.rubro.toLowerCase()}.
        </p>

        <div
          role="region"
          aria-label="Recorrido de compra"
          tabIndex={0}
          className="mt-[34px] snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-0.5 pb-[30px] pt-1.5 [scrollbar-color:hsl(var(--linea-fuerte))_transparent] [scrollbar-width:thin]"
        >
          <ol className="relative grid auto-cols-[216px] grid-flow-col justify-between gap-[clamp(18px,2.2vw,32px)] before:absolute before:inset-x-[60px] before:top-[210px] before:border-t-2 before:border-dashed before:border-linea-fuerte before:content-[''] min-[1101px]:max-[1320px]:[zoom:0.86]">
            {screens.map((screen, i) => (
              <li key={STEPS[i]} className="relative grid snap-start content-start gap-[18px] even:pt-9">
                <div
                  ref={(el) => {
                    phones.current[i] = el;
                  }}
                >
                  <PhoneFrame theme={store.theme}>{screen}</PhoneFrame>
                </div>
                <p className="flex items-start gap-2.5 text-[14.5px] font-semibold leading-snug">
                  <b className="grid size-[26px] shrink-0 place-items-center rounded-full bg-noche font-landing-mono text-xs font-semibold text-claro">
                    {i + 1}
                  </b>
                  {STEPS[i]}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <p className="flex flex-wrap items-center gap-2.5 text-[15px] text-pizarra">
          El pedido te llega al panel con su comprobante.
          <a href="#antes" className="font-bold text-brand-700 underline-offset-2 hover:underline">
            Mira cómo se ve de tu lado
          </a>
        </p>
      </div>
    </section>
  );
}
