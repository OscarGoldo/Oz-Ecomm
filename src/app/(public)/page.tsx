import Link from "next/link";
import {
  BadgeDollarSign,
  ClipboardCheck,
  PackageCheck,
  Palette,
  Smartphone,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { TiendifyLogo } from "@/components/landing/tiendify-logo";

const features = [
  {
    icon: Smartphone,
    title: "Tienda lista para el celular",
    text: "Tus clientes compran desde el teléfono, rápido y sin fricción.",
  },
  {
    icon: BadgeDollarSign,
    title: "Doble moneda USD / Bs",
    text: "Muestra precios en dólares con su equivalente en bolívares.",
  },
  {
    icon: Wallet,
    title: "Pagos locales",
    text: "Pago Móvil, Zelle, Binance o efectivo. Sube el comprobante y listo.",
  },
  {
    icon: PackageCheck,
    title: "Pedidos ordenados",
    text: "Confirma pagos y sigue cada entrega en un solo lugar.",
  },
  {
    icon: Palette,
    title: "Con tu marca",
    text: "Tu logo, tu color, tu link. Tu tienda se ve profesional.",
  },
  {
    icon: ClipboardCheck,
    title: "Sin complicaciones",
    text: "Cargas productos y empiezas a vender. Sin código, sin tarjeta.",
  },
];

const steps = [
  { n: "1", title: "Regístrate", text: "Crea tu tienda con tu correo en un minuto." },
  { n: "2", title: "Carga productos", text: "Sube fotos, precios y stock desde el panel." },
  { n: "3", title: "Vende", text: "Comparte tu link y recibe pedidos al instante." },
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-background">
      {/* Nav */}
      <LandingHeader />

      {/* Hero */}
      <LandingHero />

      {/* Features */}
      <section className="border-t bg-muted/30">
        <div className="container py-16">
          <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            Todo lo que tu negocio necesita para vender online
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-card p-6">
                <span className="mb-4 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </span>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Empieza en 3 pasos
        </h2>
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="text-center">
              <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                {s.n}
              </span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-primary text-primary-foreground">
        <div className="container flex flex-col items-center gap-6 py-16 text-center">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Tu tienda online te está esperando
          </h2>
          <p className="max-w-md text-primary-foreground/90">
            Créala gratis hoy y empieza a recibir pedidos ordenados.
          </p>
          <Button asChild size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90">
            <Link href="/crear-tienda">
              Crear mi tienda gratis <span aria-hidden>→</span>
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container flex flex-col items-center justify-between gap-3 py-8 text-sm text-muted-foreground sm:flex-row">
          <TiendifyLogo />
          <span>
            © {new Date().getFullYear()} · Un producto de{" "}
            <span className="font-medium text-foreground">OzAI</span> · Hecho en
            Venezuela 🇻🇪
          </span>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/crear-tienda" className="hover:text-foreground">
              Crear tienda
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Ingresar
            </Link>
            <Link href="/terminos" className="hover:text-foreground">
              Términos
            </Link>
            <Link href="/privacidad" className="hover:text-foreground">
              Privacidad
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
