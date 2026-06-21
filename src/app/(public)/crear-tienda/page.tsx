import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";

import { SignupForm } from "@/components/storefront/signup-form";

export const metadata: Metadata = {
  title: { absolute: "Creá tu tienda · Oz Ecom" },
  description: "Creá tu tienda online gratis en minutos.",
};

export default function CrearTiendaPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-5" />
          </span>
          Oz Ecom
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
        <h1 className="text-3xl font-bold tracking-tight">Creá tu tienda</h1>
        <p className="mt-1 mb-6 text-muted-foreground">
          En un minuto tenés tu tienda online lista para vender.
        </p>
        <SignupForm prefillEmail={searchParams.email ?? ""} />
      </div>
    </main>
  );
}
