import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SignupForm } from "@/components/storefront/signup-form";
import { TiendifyLogo } from "@/components/landing/tiendify-logo";

export const metadata: Metadata = {
  title: { absolute: "Crea tu tienda · Tiendify" },
  description: "Crea tu tienda online gratis en minutos.",
};

export default function CrearTiendaPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center">
          <TiendifyLogo className="h-7 w-auto" />
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Ya tengo cuenta
        </Link>
      </div>

      <div className="container max-w-lg pb-16 pt-4">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Volver
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Crea tu tienda</h1>
        <p className="mt-1 mb-6 text-muted-foreground">
          En un minuto tienes tu tienda online lista para vender.
        </p>
        <SignupForm prefillEmail={searchParams.email ?? ""} />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Al crear tu tienda aceptas los{" "}
          <Link href="/terminos" className="font-medium text-primary hover:underline">
            Términos y condiciones
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" className="font-medium text-primary hover:underline">
            Política de privacidad
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
