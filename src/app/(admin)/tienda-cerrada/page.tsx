import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TiendifyLogo } from "@/components/landing/tiendify-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <main className="chrome-admin flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex justify-center">
          <TiendifyLogo className="h-12 w-auto" />
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Tu tienda está cerrada</CardTitle>
            <CardDescription>
              {ctx.store.name} ya no está en línea y no se te cobra nada. Tus
              productos, pedidos y clientes siguen guardados por si quieres
              volver.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ReopenStoreButton />
            <form action={signOut}>
              <button
                type="submit"
                className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Cerrar sesión
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
