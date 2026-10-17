"use client";

import { useCallback, useState } from "react";
import { Check } from "lucide-react";

import { FORM_TOKENS, SAMPLE, TagOutline } from "@/components/landing/landing-ui";
import { PhoneFrame, ShowcaseScreen, type ExampleStore } from "@/components/landing/store-screens";
import { SignupForm } from "@/components/storefront/signup-form";

/**
 * El registro con la tienda armándose al lado. Sigue el gesto de la portada:
 * lo que la persona escribe (nombre, color) se ve en el teléfono mientras
 * llena el formulario, y el link que ve es el que va a tener.
 *
 * El formulario es el mismo de siempre; acá solo se le cambian los colores
 * por los de la portada (variables del sistema de diseño) y se escucha su
 * vista previa.
 */

/** Solo lo que es cierto hoy y está en marketing/GUIA.md. */
const INCLUDED = [
  "Precios en dólares y bolívares, con la tasa del BCV",
  "Pago Móvil, Zelle, Binance o efectivo",
  "Pedidos y comprobantes en tu panel",
];

const PRODUCTS = [SAMPLE.franela, SAMPLE.gorra, SAMPLE.tote, SAMPLE.lentes].map((p) => ({
  name: p.name,
  usd: p.usd,
  photo: p.photo,
}));

type FormProps = Omit<React.ComponentProps<typeof SignupForm>, "onPreview">;

export function SignupShell({
  intro,
  footer,
  formProps,
  usdRate,
}: {
  intro: React.ReactNode;
  footer: React.ReactNode;
  formProps: FormProps;
  usdRate: number | null;
}) {
  const [preview, setPreview] = useState({ name: "", slug: "mi-tienda", color: "#0EA5E9" });
  const onPreview = useCallback((p: typeof preview) => setPreview(p), []);

  const store: ExampleStore = {
    name: preview.name.trim() || "Tu tienda",
    rubro: "",
    slug: preview.slug,
    theme: {
      p: preview.color,
      pi: "#FFFFFF",
      a: "#FFFFFF",
      ai: preview.color,
      s: "#FFFFFF",
      k: "#0B1B2B",
      sf: "var(--font-landing-display)",
      r: "10px",
    },
    kick: "Nueva colección",
    title: "Lo nuevo de la semana",
    cats: ["Todo", "Franelas", "Gorras", "Bolsos"],
    products: PRODUCTS,
    option: { label: "", values: [], selected: 0 },
    cart: [],
    method: "pm",
    order: 0,
  };

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-14">
      <div className="min-w-0">
        {intro}
        <div className="mt-8" style={FORM_TOKENS}>
          <SignupForm {...formProps} onPreview={onPreview} />
        </div>
        {footer}
      </div>

      {/* La tienda armándose. En el teléfono se esconde: ahí el formulario ya
          muestra el link, y la vista previa lo alargaría el doble. */}
      <aside className="sticky top-6 hidden lg:block" aria-label="Vista previa de tu tienda">
        <div className="relative isolate overflow-hidden rounded-[28px] bg-brand-500 px-9 pt-9 text-noche">
          <TagOutline className="pointer-events-none absolute -right-[30%] -top-[20%] -z-10 w-[130%] text-white/30" />
          <p className="font-landing-mono text-xs font-semibold uppercase tracking-[0.08em]">
            Así se va a ver
          </p>
          <p className="mt-3 max-w-[16ch] text-balance font-landing-display text-[2.1rem] font-extrabold leading-[0.95] tracking-[-0.04em] [font-stretch:84%]">
            Tu tienda, con tu nombre y tu color.
          </p>
          <ul className="mt-5 grid gap-2">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[15px] font-medium leading-snug">
                <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-white text-noche">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          {/* El teléfono asoma desde abajo, cortado por el borde del panel. */}
          <div className="-mb-28 mt-8 flex justify-center">
            <PhoneFrame theme={store.theme} className="shadow-[0_40px_70px_-30px_hsl(var(--noche)/0.65)]">
              <ShowcaseScreen store={store} rate={usdRate} />
            </PhoneFrame>
          </div>
        </div>
      </aside>
    </div>
  );
}
