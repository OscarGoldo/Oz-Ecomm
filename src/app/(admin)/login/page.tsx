import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, PackageCheck, Receipt, Wallet } from "lucide-react";

import { TiendifyLogo, TiendifyLogoMark } from "@/components/landing/tiendify-logo";
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
   * Dos columnas en escritorio en vez de la tarjeta centrada sobre gris. La
   * tarjeta flotando en el medio de la pantalla es la plantilla de acceso por
   * defecto de todo el mundo; partir la pantalla y darle a la marca su propio
   * lado cuesta lo mismo y hace que el producto se presente antes de que el
   * dueño escriba una sola letra. En móvil se colapsa a la columna del form.
   */
  return (
    <main className="chrome-admin grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Columna del formulario */}
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-[24rem]">
          <Link href="/" className="inline-flex" aria-label="Ir al inicio">
            <TiendifyLogo className="h-7 w-auto" />
          </Link>

          <h1 className="mt-9 font-display text-display-sm font-semibold text-balance">
            Entra a tu tienda
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-500">
            Gestiona pedidos, productos y pagos desde un solo panel.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-lg border border-destructive-border bg-destructive-surface p-3 text-sm text-destructive-text"
            >
              <AlertCircle className="mt-px size-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="mt-7">
            <LoginForm />
          </div>
        </div>
      </div>

      {/* Panel de marca. Solo desde lg: por debajo le robaría la pantalla al
          formulario, que es lo único que la persona vino a hacer acá. */}
      <aside className="relative hidden overflow-hidden bg-ink-950 lg:flex lg:flex-col lg:justify-between lg:p-14">
        {/* Halo de marca. Dos radiales muy abiertos en lugar de un degradado
            lineal de esquina a esquina: el degradado diagonal es el fondo de
            plantilla por excelencia. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.55]"
          style={{
            background:
              "radial-gradient(60% 55% at 78% 12%, hsl(var(--brand-500) / 0.5), transparent 70%), radial-gradient(55% 50% at 8% 92%, hsl(var(--brand-700) / 0.55), transparent 72%)",
          }}
        />
        {/* Retícula tenue: le da escala a un fondo que si no queda plano. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <TiendifyLogoMark className="relative h-9 w-auto" />

        <div className="relative">
          <p className="max-w-[22ch] font-display text-display-md font-semibold text-ink-0 text-balance">
            Tu catálogo en línea, sin complicaciones.
          </p>
          <ul className="mt-9 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-px grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 text-brand-300 ring-1 ring-inset ring-white/15">
                  <Icon className="size-3.5" />
                </span>
                <span className="max-w-[34ch] text-[0.9375rem] leading-relaxed text-ink-300">
                  {text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-2xs text-ink-400">
          Un producto de OzAI · Hecho en Venezuela
        </p>
      </aside>
    </main>
  );
}
