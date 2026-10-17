import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { landingFonts } from "@/components/landing/fonts";
import { Eyebrow, Sticker, wrap } from "@/components/landing/landing-ui";
import { SignupShell } from "@/components/landing/signup-shell";
import { TiendifyLogo } from "@/components/landing/tiendify-logo";
import { getPublicUsdRate } from "@/lib/bcv";
import { FREE_MAX_PRODUCTS } from "@/lib/plans";
import { normalizePromoCode } from "@/lib/promo";
import { lookupPromoCode } from "@/lib/promo-server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "Crea tu tienda · Tiendify" },
  description: "Crea tu tienda online gratis en minutos.",
};

/**
 * El registro, con la misma cara que la portada: barra noche, titular negro
 * con calcomanía y, al lado del formulario, la tienda de la persona armándose
 * con el nombre y el color que va eligiendo (SignupShell).
 */
export default async function CrearTiendaPage({
  searchParams,
}: {
  searchParams: { email?: string; ref?: string; codigo?: string; nombre?: string };
}) {
  // El nombre que escribió en la landing. Recortado al mismo largo que deja
  // escribir ese campo; si alguien arma el link a mano, el server action lo
  // valida igual que si lo hubiera tipeado acá.
  const prefillName = (searchParams.nombre ?? "").trim().slice(0, 60);
  // El link de una campaña trae el código (?codigo=…). Se revisa acá para
  // decirle qué le toca antes de que llene nada, y para no dejarle puesto en el
  // formulario un código agotado que después le frenaría el registro.
  const linkCode = normalizePromoCode(searchParams.codigo);
  const [offer, usdRate] = await Promise.all([
    linkCode ? lookupPromoCode(linkCode) : Promise.resolve(null),
    getPublicUsdRate(),
  ]);

  return (
    <div className={cn(landingFonts, "min-h-dvh bg-claro font-landing-body text-noche antialiased")}>
      <div className="px-4 pt-3">
        <header className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 rounded-[18px] border border-white/[0.08] bg-noche pl-4 pr-2.5 text-white shadow-[0_20px_44px_-22px_hsl(var(--noche)/0.6)] sm:pl-5">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Tiendify, inicio">
            <TiendifyLogo variant="white" className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/70 sm:inline">¿Ya tienes cuenta?</span>
            <Link
              href="/login"
              className="inline-flex min-h-[42px] items-center rounded-full bg-white px-[18px] text-[14.5px] font-bold text-noche transition-transform active:scale-[0.97]"
            >
              Ingresar
            </Link>
          </div>
        </header>
      </div>

      <main className={cn(wrap, "pb-20 pt-8 sm:pt-12")}>
        <SignupShell
          usdRate={usdRate}
          formProps={{
            prefillEmail: searchParams.email ?? "",
            prefillStoreName: prefillName,
            referralCode: searchParams.ref ?? "",
            promoOffer: offer,
            promoUnavailable: linkCode && !offer ? linkCode : null,
          }}
          intro={
            <>
              <Link
                href="/"
                className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-pizarra transition-colors hover:text-noche"
              >
                <ArrowLeft className="size-4" /> Volver al inicio
              </Link>
              <Eyebrow>Crea tu tienda</Eyebrow>
              <h1 className="mt-3 text-balance font-landing-display text-[clamp(2.4rem,1.6rem+2.6vw,3.6rem)] font-extrabold leading-[0.95] tracking-[-0.045em] [font-stretch:84%]">
                Tu tienda, lista en <Sticker>un minuto.</Sticker>
              </h1>
              <p className="mt-4 max-w-[46ch] text-pretty text-[clamp(1.02rem,0.98rem+0.2vw,1.15rem)] leading-relaxed text-pizarra">
                Gratis hasta {FREE_MAX_PRODUCTS} productos y sin tarjeta de crédito.
                Cargas tus productos, compartes el link y empiezas a vender.
              </p>
            </>
          }
          footer={
            <p className="mt-4 text-center text-xs text-pizarra">
              Al crear tu tienda aceptas los{" "}
              <Link href="/terminos" className="font-semibold text-brand-700 hover:underline">
                Términos y condiciones
              </Link>{" "}
              y la{" "}
              <Link href="/privacidad" className="font-semibold text-brand-700 hover:underline">
                Política de privacidad
              </Link>
              .
            </p>
          }
        />
      </main>
    </div>
  );
}
