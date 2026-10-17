import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Eyebrow, Sticker, wrap } from "@/components/landing/landing-ui";
import {
  FormCard,
  PageShell,
  barPillQuiet,
  pageLead,
  pageTitle,
} from "@/components/landing/page-shell";
import { getSessionContext } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import { storeClosedByOwner } from "@/lib/store-status";
import { ReopenStoreButton } from "./reopen-button";

export const metadata: Metadata = { title: "Tienda cerrada" };

/**
 * Adonde llega el dueño de una tienda que él mismo cerró.
 *
 * Vive fuera de /panel a propósito: el layout del panel manda acá a toda
 * tienda cerrada, así que adentro sería un bucle.
 */
export default async function TiendaCerradaPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (ctx.user.role === "super_admin") redirect("/super");
  if (!ctx.store) redirect("/login?error=no-store");
  if (!storeClosedByOwner(ctx.store)) redirect("/panel");

  return (
    <PageShell
      action={
        // Salir va en la barra, con borde y no en blanco: la acción que se
        // espera acá es reabrir, y esa es la que va en noche.
        <form action={signOut}>
          <button type="submit" className={barPillQuiet}>
            Cerrar sesión
          </button>
        </form>
      }
    >
      <main className={`${wrap} pb-20 pt-8 sm:pt-12`}>
        <div className="mx-auto max-w-[34rem]">
          <Eyebrow>{ctx.store.name}</Eyebrow>
          <h1 className={pageTitle}>
            Tu tienda está <Sticker>cerrada.</Sticker>
          </h1>
          <p className={pageLead}>
            Ya no está en línea y no se te cobra nada. Tus productos, pedidos y
            clientes siguen guardados por si quieres volver.
          </p>

          <FormCard className="mt-8">
            <p className="font-landing-mono text-xs font-semibold uppercase tracking-[0.08em] text-pizarra">
              Tu link
            </p>
            <p className="mt-1 truncate font-landing-mono text-[15px] font-medium text-noche">
              /{ctx.store.slug}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-pizarra">
              Al reabrirla vuelve a estar en línea en el mismo link, con todo lo
              que tenía.
            </p>
            <div className="mt-6">
              <ReopenStoreButton />
            </div>
          </FormCard>
        </div>
      </main>
    </PageShell>
  );
}
