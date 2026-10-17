import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { landingFonts } from "@/components/landing/fonts";
import { FORM_TOKENS } from "@/components/landing/landing-ui";
import { TiendifyLogo } from "@/components/landing/tiendify-logo";
import { cn } from "@/lib/utils";

/**
 * El marco de las páginas sueltas (registro, ingreso, recuperar la clave,
 * tienda cerrada, legales), con la misma cara que la portada: fondo claro,
 * las tipografías de la landing y la barra noche arriba con una sola acción a
 * la derecha.
 */
export function PageShell({
  action,
  children,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(landingFonts, "min-h-dvh bg-claro font-landing-body text-noche antialiased")}>
      <div className="px-4 pt-3">
        <header className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 rounded-[18px] border border-white/[0.08] bg-noche pl-4 pr-2.5 text-white shadow-[0_20px_44px_-22px_hsl(var(--noche)/0.6)] sm:pl-5">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Tiendify, inicio">
            <TiendifyLogo variant="white" className="h-8 w-auto" />
          </Link>
          {action && <div className="flex items-center gap-3">{action}</div>}
        </header>
      </div>
      {children}
    </div>
  );
}

/** Píldora de la barra. Blanca para la acción que se espera, como "Ingresar". */
export const barPill =
  "inline-flex min-h-[42px] items-center whitespace-nowrap rounded-full bg-white px-[18px] text-[14.5px] font-bold text-noche transition-transform active:scale-[0.97]";

/** La misma píldora, solo con borde: para salir, no para seguir. */
export const barPillQuiet =
  "inline-flex min-h-[42px] items-center whitespace-nowrap rounded-full border border-white/20 px-[18px] text-[14.5px] font-semibold text-white transition-[background-color,transform] hover:bg-white/[0.08] active:scale-[0.97]";

/** Un enlace de la barra con su pregunta al lado (la pregunta, solo desde sm). */
export function BarLink({
  href,
  hint,
  children,
}: {
  href: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {hint && <span className="hidden text-sm text-white/70 sm:inline">{hint}</span>}
      <Link href={href} className={barPill}>
        {children}
      </Link>
    </>
  );
}

/** El "volver" de arriba del rótulo. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-pizarra transition-colors hover:text-noche"
    >
      <ArrowLeft className="size-4" /> {children}
    </Link>
  );
}

/**
 * Titular de las páginas sueltas: el mismo del registro. Lleva el tamaño
 * antes del interlineado a propósito (tailwind-merge descarta un leading-*
 * que venga antes de un text-[tamaño]).
 */
export const pageTitle =
  "mt-3 text-balance font-landing-display text-[clamp(2.4rem,1.6rem+2.6vw,3.6rem)] font-extrabold leading-[0.95] tracking-[-0.045em] [font-stretch:84%]";

/** La bajada del titular. */
export const pageLead =
  "mt-4 max-w-[46ch] text-pretty text-[clamp(1.02rem,0.98rem+0.2vw,1.15rem)] leading-relaxed text-pizarra";

/* --- Legales (términos, privacidad) ---------------------------------------
   Solo el marco y la tipografía: el texto legal es el mismo de siempre, en
   una hoja blanca para que se lea largo sin cansar. */

export const legalArticle =
  "space-y-6 rounded-[28px] border border-linea bg-white p-6 text-[15px] leading-relaxed text-pizarra sm:p-10 [&_strong]:text-noche";

export const legalTitle =
  "mt-3 text-balance font-landing-display text-[clamp(2.1rem,1.6rem+1.8vw,3rem)] font-extrabold leading-[0.95] tracking-[-0.045em] text-noche [font-stretch:84%]";

export const legalUpdated = "mt-3 font-landing-mono text-xs text-gris";

export const legalHeading =
  "pt-2 font-landing-display text-[1.3rem] font-extrabold leading-tight tracking-[-0.025em] text-noche [font-stretch:90%]";

export const legalLink = "font-semibold text-brand-700 hover:underline";

export const legalFooter = "border-t border-linea pt-5 text-sm";

/**
 * La tarjeta blanca del formulario, igual a la del registro. Los Input y
 * Button de adentro toman los colores de la portada por FORM_TOKENS.
 */
export function FormCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      style={FORM_TOKENS}
      className={cn("rounded-2xl border bg-card p-6 text-card-foreground sm:p-8", className)}
    >
      {children}
    </div>
  );
}
