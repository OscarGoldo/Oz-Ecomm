import type { Metadata } from "next";
import Link from "next/link";

import { Eyebrow, Sticker, wrap } from "@/components/landing/landing-ui";
import {
  BackLink,
  BarLink,
  PageShell,
  pageLead,
  pageTitle,
} from "@/components/landing/page-shell";
import { SignupShell } from "@/components/landing/signup-shell";
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
    <PageShell
      action={
        <BarLink href="/login" hint="¿Ya tienes cuenta?">
          Ingresar
        </BarLink>
      }
    >
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
              <BackLink href="/">Volver al inicio</BackLink>
              <Eyebrow>Crea tu tienda</Eyebrow>
              <h1 className={pageTitle}>
                Tu tienda, lista en <Sticker>un minuto.</Sticker>
              </h1>
              <p className={pageLead}>
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
    </PageShell>
  );
}
