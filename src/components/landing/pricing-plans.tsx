"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import {
  SectionHeading,
  bs,
  headingXl,
  pill,
  sectionY,
  wrap,
} from "@/components/landing/landing-ui";
import { cn } from "@/lib/utils";

function PlanFeature({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <li className="flex items-start gap-[11px] text-[15.5px] leading-snug">
      <Check
        aria-hidden="true"
        className={cn("mt-px size-5 shrink-0", dark ? "text-sol" : "text-brand-700")}
        strokeWidth={2.5}
      />
      <span>{children}</span>
    </li>
  );
}

/**
 * Precios. El monto de Pro también sale en bolívares a la tasa BCV: es como
 * se piensa un precio acá, y es la función principal demostrada otra vez.
 *
 * Pro va en noche y no con un borde azul de dos píxeles: el plan recomendado
 * tiene que ganar por peso visual, no por un contorno de color.
 */
export function PricingPlans({
  usdRate,
  freeMaxProducts,
  freeLayouts,
  allLayouts,
  proMonthly,
  proYearly,
}: {
  usdRate: number | null;
  freeMaxProducts: number;
  freeLayouts: number;
  allLayouts: number;
  proMonthly: number;
  proYearly: number;
}) {
  const [yearly, setYearly] = useState(false);
  const price = yearly ? proYearly : proMonthly;
  // Lo que ahorra el anual, en meses, sale de los precios y no se escribe a mano.
  const freeMonths = Math.round(12 - proYearly / proMonthly);
  const perMonth = (proYearly / 12).toFixed(2).replace(".", ",");

  const toggle =
    "inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[14.5px] font-bold transition-colors";

  return (
    <section id="precios" className={cn(sectionY, "scroll-mt-20")}>
      <div className={wrap}>
        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-10">
          <SectionHeading
            eyebrow="Precios"
            title="Empieza gratis. Crece cuando quieras."
            text="Sin tarjeta de crédito. Pasas a Pro desde tu panel cuando lo necesites."
          />
          <div
            role="group"
            aria-label="Forma de pago de Pro"
            className="inline-flex justify-self-start rounded-full border border-linea bg-white p-1"
          >
            <button
              type="button"
              aria-pressed={!yearly}
              onClick={() => setYearly(false)}
              className={cn(toggle, !yearly ? "bg-noche text-claro" : "text-pizarra")}
            >
              Mensual
            </button>
            <button
              type="button"
              aria-pressed={yearly}
              onClick={() => setYearly(true)}
              className={cn(toggle, yearly ? "bg-noche text-claro" : "text-pizarra")}
            >
              Anual
              <small className="rounded-[5px] bg-sol px-1.5 py-1 font-landing-mono text-[11px] font-semibold leading-none text-noche">
                {freeMonths} meses gratis
              </small>
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-[18px] md:grid-cols-2">
          {/* Gratis */}
          <article className="flex min-w-0 flex-col gap-[22px] rounded-[30px] border border-linea bg-white p-[26px] sm:p-[34px]">
            <span className="font-landing-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-gris">
              Gratis
            </span>
            <p className={cn(headingXl, "flex items-baseline gap-1.5 text-[clamp(3.4rem,2.8rem+2vw,4.6rem)] leading-[0.85] tabular-nums")}>
              $0
              <small className="font-landing-body text-[17px] font-semibold tracking-normal text-gris">
                para siempre
              </small>
            </p>
            <p className="-mt-2 text-[14.5px] text-pizarra">
              Todo lo que necesitas para empezar a vender.
            </p>
            <ul className="grid gap-[11px] border-t border-linea pt-[22px]">
              <PlanFeature>Hasta {freeMaxProducts} productos</PlanFeature>
              <PlanFeature>{freeLayouts} plantillas, una por rubro</PlanFeature>
              <PlanFeature>Pedidos y pagos ilimitados</PlanFeature>
              <PlanFeature>Precios en dólares y bolívares</PlanFeature>
              <PlanFeature>Finanzas, clientes y carritos abandonados</PlanFeature>
            </ul>
            <Link
              href="/crear-tienda"
              className={cn(pill, "mt-auto text-noche shadow-[inset_0_0_0_1.5px_hsl(var(--linea-fuerte))] hover:shadow-[inset_0_0_0_1.5px_hsl(var(--noche))]")}
            >
              Crear mi tienda
            </Link>
          </article>

          {/* Pro */}
          <article className="relative flex min-w-0 flex-col gap-[22px] overflow-hidden rounded-[30px] bg-noche p-[26px] text-claro shadow-[0_2px_4px_hsl(var(--noche)/0.06),0_28px_56px_-22px_hsl(var(--noche)/0.32)] sm:p-[34px]">
            {/* La etiqueta del logo, girada, como marca de agua */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-[60px] -top-[60px] size-[260px] rounded-[30px] border-2 border-white/[0.08] [rotate:45deg]"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="font-landing-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-niebla">
                Pro
              </span>
              <span className="rounded-full bg-sol px-2.5 py-[7px] font-landing-mono text-[11.5px] font-bold uppercase leading-none tracking-[0.06em] text-noche">
                Recomendado
              </span>
            </div>
            <p className={cn(headingXl, "flex items-baseline gap-1.5 text-[clamp(3.4rem,2.8rem+2vw,4.6rem)] leading-[0.85] tabular-nums")}>
              ${price}
              <small className="font-landing-body text-[17px] font-semibold tracking-normal text-niebla">
                {yearly ? "/año" : "/mes"}
              </small>
            </p>
            <div className="-mt-2 grid gap-1 text-niebla" aria-live="polite">
              {usdRate && (
                <p className="font-landing-mono text-[13.5px] tabular-nums">
                  ≈ {bs(price, usdRate)} a la tasa BCV
                </p>
              )}
              <p className="text-[14.5px]">
                {yearly
                  ? `Te sale en $${perMonth} al mes: ${freeMonths} meses gratis.`
                  : `o $${proYearly} al año, con ${freeMonths} meses gratis.`}
              </p>
            </div>
            <ul className="grid gap-[11px] border-t border-white/[0.12] pt-[22px]">
              <PlanFeature dark>Productos ilimitados</PlanFeature>
              <PlanFeature dark>
                Tu propia dirección:{" "}
                <span className="font-landing-mono text-[14px]">tutienda.usatiendify.com</span>
              </PlanFeature>
              <PlanFeature dark>Las {allLayouts} plantillas</PlanFeature>
              <PlanFeature dark>Analítica completa de tu tienda</PlanFeature>
              <PlanFeature dark>Cupones de descuento</PlanFeature>
              <PlanFeature dark>Sin el sello de Tiendify</PlanFeature>
            </ul>
            <Link href="/crear-tienda" className={cn(pill, "mt-auto bg-sol text-noche")}>
              Empezar gratis
            </Link>
            <p className="-mt-2.5 text-center text-[13.5px] text-niebla">
              Activas Pro desde tu panel. Lo pagas por Pago Móvil, Zelle, Binance o tarjeta.
            </p>
          </article>
        </div>

        {/* Lo que nunca se cobra: es la duda que frena el registro. "Sin
            comisiones" no se puede decir (la tarjeta lleva la de Stripe); esto sí. */}
        <div className="mt-[18px] flex gap-4 rounded-[22px] border-[1.5px] border-dashed border-linea-fuerte px-6 py-5 max-sm:flex-col max-sm:gap-2">
          <span
            aria-hidden="true"
            className="shrink-0 font-landing-display text-[44px] font-extrabold leading-[0.9] tracking-[-0.05em] text-brand-700 [font-stretch:78%]"
          >
            0%
          </span>
          <div>
            <b className="mb-0.5 block font-landing-display text-xl font-extrabold tracking-[-0.02em] [font-stretch:92%]">
              Tiendify no se queda con un porcentaje de tus ventas.
            </b>
            <p className="max-w-[80ch] text-[15px] text-pizarra">
              Lo que te pagan por Pago Móvil, Zelle, Binance o en efectivo llega
              directo a tu cuenta. Si cobras con tarjeta, solo se descuenta la
              comisión de Stripe, que procesa el pago.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
