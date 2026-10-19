"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import {
  SectionHeading,
  bs,
  headingXl,
  pill,
  reveal,
  sectionY,
  wrap,
} from "@/components/landing/landing-ui";
import { GRACE_DAYS, TRIAL_DAYS } from "@/lib/plans";
import { LAUNCH_PROMO_CODE, LAUNCH_SIGNUP_HREF } from "@/lib/promo";
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
 * Precios. Desde octubre de 2026 hay un solo plan (ver lib/plans): Pro, con el
 * primer mes gratis usando el código de la portada. El monto también sale en
 * bolívares a la tasa BCV: es como se piensa un precio acá, y es la función
 * principal demostrada otra vez.
 *
 * Pro va en noche y no con un borde azul de dos píxeles: es el plan, tiene que
 * ganar por peso visual. Al lado, el código como un ticket, igual que los
 * cupones del panel: se lee como algo que se recorta y se usa.
 */
export function PricingPlans({
  usdRate,
  allLayouts,
  proMonthly,
  proYearly,
}: {
  usdRate: number | null;
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
            title="Un solo plan. El primer mes, gratis."
            text="Todo incluido desde el primer día. Para empezar no necesitas tarjeta de crédito."
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

        <div className="mt-12 grid gap-[18px] md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Pro */}
          <article {...reveal()} className="relative flex min-w-0 flex-col gap-[22px] overflow-hidden rounded-[30px] bg-noche p-[26px] text-claro shadow-[0_2px_4px_hsl(var(--noche)/0.06),0_28px_56px_-22px_hsl(var(--noche)/0.32)] sm:p-[34px]">
            {/* La etiqueta del logo, girada, como marca de agua */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-[60px] -top-[60px] size-[260px] rounded-[30px] border-2 border-white/[0.08] [rotate:45deg]"
            />
            <span className="font-landing-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-niebla">
              Pro
            </span>
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
            <ul className="grid gap-[11px] border-t border-white/[0.12] pt-[22px] sm:grid-cols-2 sm:gap-x-6">
              <PlanFeature dark>Productos ilimitados</PlanFeature>
              <PlanFeature dark>Pedidos y pagos ilimitados</PlanFeature>
              <PlanFeature dark>
                Tu dirección:{" "}
                <span className="font-landing-mono text-[14px]">tutienda.usatiendify.com</span>
              </PlanFeature>
              <PlanFeature dark>Las {allLayouts} plantillas</PlanFeature>
              <PlanFeature dark>Precios en dólares y bolívares</PlanFeature>
              <PlanFeature dark>Finanzas, clientes y carritos</PlanFeature>
              <PlanFeature dark>Analítica de tu tienda</PlanFeature>
              <PlanFeature dark>Cupones de descuento</PlanFeature>
              <PlanFeature dark>Sin el sello de Tiendify</PlanFeature>
            </ul>
            <Link href={LAUNCH_SIGNUP_HREF} className={cn(pill, "mt-auto bg-sol text-noche")}>
              Empezar mi mes gratis
            </Link>
            <p className="-mt-2.5 text-center text-[13.5px] text-niebla">
              Después lo pagas por Pago Móvil, Binance o tarjeta.
            </p>
          </article>

          {/* El código, como un ticket */}
          <article {...reveal(140)} className="flex min-w-0 flex-col gap-[22px] rounded-[30px] border-[1.5px] border-dashed border-linea-fuerte bg-white p-[26px] sm:p-[34px]">
            <span className="font-landing-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-gris">
              Tu primer mes
            </span>
            <p className={cn(headingXl, "text-[clamp(2.4rem,2rem+1.4vw,3.2rem)] leading-[0.9]")}>
              Gratis, con este código
            </p>
            <p
              className="self-start rounded-2xl border-2 border-dashed border-brand-700 bg-brand-50 px-4 py-3 font-landing-mono text-[clamp(1.25rem,1rem+1vw,1.6rem)] font-bold tracking-[0.04em] text-brand-700 [overflow-wrap:anywhere]"
            >
              {LAUNCH_PROMO_CODE}
            </p>
            <ul className="grid gap-[11px] border-t border-linea pt-[22px]">
              <PlanFeature>Pro completo por 30 días, sin tarjeta</PlanFeature>
              <PlanFeature>
                Los botones de esta página ya lo llevan puesto
              </PlanFeature>
              <PlanFeature>Sin código, igual lo pruebas {TRIAL_DAYS} días</PlanFeature>
              <PlanFeature>
                Si no renuevas, tu tienda sigue {GRACE_DAYS} días más. No se borra nada.
              </PlanFeature>
            </ul>
            <Link
              href={LAUNCH_SIGNUP_HREF}
              className={cn(pill, "mt-auto text-noche shadow-[inset_0_0_0_1.5px_hsl(var(--linea-fuerte))] hover:shadow-[inset_0_0_0_1.5px_hsl(var(--noche))]")}
            >
              Crear mi tienda con el código
            </Link>
          </article>
        </div>

        {/* Lo que nunca se cobra: es la duda que frena el registro. "Sin
            comisiones" no se puede decir (la tarjeta lleva la de Stripe); esto sí. */}
        <div {...reveal(220)} className="mt-[18px] flex gap-4 rounded-[22px] border-[1.5px] border-dashed border-linea-fuerte px-6 py-5 max-sm:flex-col max-sm:gap-2">
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
