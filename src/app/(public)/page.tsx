import Link from "next/link";
import {
  BadgeDollarSign,
  ClipboardCheck,
  PackageCheck,
  Palette,
  Smartphone,
  Sparkles,
  Store,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { HeroSignup } from "@/components/storefront/hero-signup";
import { LandingHeader } from "@/components/landing/landing-header";

const features = [
  {
    icon: Smartphone,
    title: "Tienda lista para el celular",
    text: "Tus clientes compran desde el teléfono, rápido y sin fricción.",
  },
  {
    icon: BadgeDollarSign,
    title: "Doble moneda USD / Bs",
    text: "Mostrá precios en dólares con su equivalente en bolívares.",
  },
  {
    icon: Wallet,
    title: "Pagos locales",
    text: "Pago Móvil, Zelle, Binance o efectivo. Subí el comprobante y listo.",
  },
  {
    icon: PackageCheck,
    title: "Pedidos ordenados",
    text: "Confirmá pagos y seguí cada entrega en un solo lugar.",
  },
  {
    icon: Palette,
    title: "Con tu marca",
    text: "Tu logo, tu color, tu link. Tu tienda se ve profesional.",
  },
  {
    icon: ClipboardCheck,
    title: "Sin complicaciones",
    text: "Cargás productos y empezás a vender. Sin código, sin tarjeta.",
  },
];

const steps = [
  { n: "1", title: "Registrate", text: "Creá tu tienda con tu email en un minuto." },
  { n: "2", title: "Cargá productos", text: "Subí fotos, precios y stock desde el panel." },
  { n: "3", title: "Vendé", text: "Compartí tu link y recibí pedidos al instante." },
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-background">
      {/* Nav */}
      <LandingHeader />

      {/* Hero */}
      <section className="container grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" /> Ecommerce para PYMEs de Venezuela
          </span>
          <h1 className="mt-4 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Creá tu tienda online y empezá a vender hoy
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Catálogo, carrito, pagos locales y gestión de pedidos. Dejá el
            desorden de Instagram y WhatsApp y ordená tu negocio.
          </p>
          <div className="mt-7">
            <HeroSignup />
            <p className="mt-2 text-sm text-muted-foreground">
              Gratis. Sin tarjeta. Tu tienda lista en minutos.
            </p>
          </div>
        </div>

        {/* Storefront mock */}
        <div className="relative mx-auto w-full max-w-sm">
          <div className="overflow-hidden rounded-[2rem] border bg-card shadow-2xl">
            <div className="flex items-center gap-2 bg-primary px-4 py-3 text-primary-foreground">
              <span className="grid size-7 place-items-center rounded-md bg-white/90 text-xs font-bold text-primary">
                AF
              </span>
              <span className="text-sm font-semibold">Mi Tienda</span>
              <span className="ml-auto size-4 rounded-full bg-white/30" />
            </div>
            <div className="bg-gradient-to-br from-primary/15 to-transparent p-4">
              <div className="h-3 w-24 rounded bg-foreground/10" />
              <div className="mt-2 h-6 w-40 rounded bg-foreground/15" />
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="overflow-hidden rounded-xl border">
                  <div className="aspect-square bg-muted" />
                  <div className="space-y-1.5 p-2.5">
                    <div className="h-2.5 w-full rounded bg-foreground/10" />
                    <div className="h-3 w-12 rounded bg-primary/70" />
                    <div className="h-6 w-full rounded-lg bg-primary" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -right-3 -top-3 rotate-6 rounded-xl bg-success px-3 py-1.5 text-sm font-bold text-success-foreground shadow-lg">
            ¡Nuevo pedido! 🎉
          </div>
        </div>
      </section>

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
          Empezá en 3 pasos
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
            Creala gratis hoy y empezá a recibir pedidos ordenados.
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
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <span className="grid size-6 place-items-center rounded bg-primary text-primary-foreground">
              <Store className="size-3.5" />
            </span>
            OzShop
          </div>
          <span>© {new Date().getFullYear()} · Hecho en Venezuela 🇻🇪</span>
          <div className="flex gap-4">
            <Link href="/crear-tienda" className="hover:text-foreground">
              Crear tienda
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Ingresar
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
