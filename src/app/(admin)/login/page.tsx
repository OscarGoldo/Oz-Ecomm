import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertCircle, PackageCheck, Receipt, Wallet } from "lucide-react";

import { Eyebrow, Sticker, TagOutline, wrap } from "@/components/landing/landing-ui";
import {
  BackLink,
  BarLink,
  FormCard,
  PageShell,
  pageLead,
  pageTitle,
} from "@/components/landing/page-shell";
import { getSessionContext } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Ingresar",
};

/** Lo que el dueño encuentra del otro lado. Da contexto en vez de decorar. */
const HIGHLIGHTS = [
  { icon: Receipt, text: "Confirma comprobantes y despacha en un solo lugar" },
  { icon: Wallet, text: "Precios en dólares con su equivalente en bolívares" },
  { icon: PackageCheck, text: "Stock que se descuenta solo al confirmar el pago" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  // Already signed in → go where they belong.
  const ctx = await getSessionContext();
  if (ctx) {
    redirect(ctx.user.role === "super_admin" ? "/super" : "/panel");
  }

  const error =
    searchParams.error === "no-store"
      ? "Tu cuenta no tiene una tienda asignada. Contacta al administrador."
      : searchParams.error === "auth"
        ? "El enlace expiró o no es válido. Pide uno nuevo."
        : null;

  /**
   * Con la cara del registro: el formulario a un lado y, desde lg, el panel
   * azul de la marca con lo que el dueño encuentra adentro. La tarjeta
   * centrada sobre gris es la plantilla de acceso de todo el mundo; así el
   * producto se presenta antes de que la persona escriba una letra. En el
   * teléfono queda solo el formulario, que es lo que vino a hacer.
   */
  return (
    <PageShell
      action={
        <BarLink href="/crear-tienda" hint="¿No tienes cuenta?">
          Crear tienda
        </BarLink>
      }
    >
      <main className={`${wrap} pb-20 pt-8 sm:pt-12`}>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div className="min-w-0 max-w-[34rem]">
            <BackLink href="/">Volver al inicio</BackLink>
            <Eyebrow>Tu panel</Eyebrow>
            <h1 className={pageTitle}>
              Entra a tu <Sticker>tienda.</Sticker>
            </h1>
            <p className={pageLead}>
              Gestiona pedidos, productos y pagos desde un solo panel.
            </p>

            {error && (
              <p
                role="alert"
                className="mt-6 flex items-start gap-2 rounded-xl border border-destructive-border bg-destructive-surface p-3 text-sm text-destructive-text"
              >
                <AlertCircle className="mt-px size-4 shrink-0" />
                {error}
              </p>
            )}

            <FormCard className="mt-8">
              <LoginForm />
            </FormCard>
          </div>

          {/* Panel de marca. Solo desde lg: por debajo le robaría la pantalla
              al formulario. */}
          <aside
            className="sticky top-6 hidden lg:block"
            aria-label="Lo que encuentras en tu panel"
          >
            <div className="relative isolate overflow-hidden rounded-[28px] bg-brand-500 p-9 text-noche">
              <TagOutline className="pointer-events-none absolute -right-[30%] -top-[20%] -z-10 w-[130%] text-white/30" />
              <p className="font-landing-mono text-xs font-semibold uppercase tracking-[0.08em]">
                Del otro lado
              </p>
              <p className="mt-3 max-w-[16ch] text-balance font-landing-display text-[2.1rem] font-extrabold leading-[0.95] tracking-[-0.04em] [font-stretch:84%]">
                Tu catálogo en línea, sin complicaciones.
              </p>
              <ul className="mt-6 grid gap-3">
                {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                  <li
                    key={text}
                    className="flex items-start gap-3 text-[15px] font-medium leading-snug"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-noche">
                      <Icon className="size-4" />
                    </span>
                    <span className="max-w-[34ch] pt-1.5">{text}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-12 text-sm font-medium text-noche/70">
                Un producto de OzAI · Hecho en Venezuela
              </p>
            </div>
          </aside>
        </div>
      </main>
    </PageShell>
  );
}
