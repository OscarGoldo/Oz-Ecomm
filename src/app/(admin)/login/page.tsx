import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Store } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionContext } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Ingresar",
};

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

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2 text-lg font-bold"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-5" />
          </span>
          Oz Ecom
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Panel de tu tienda</CardTitle>
            <CardDescription>
              Ingresá con tu correo para gestionar pedidos y productos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {searchParams.error === "no-store" && (
              <p className="mb-4 rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
                Tu cuenta no tiene una tienda asignada. Contactá al
                administrador.
              </p>
            )}
            {searchParams.error === "auth" && (
              <p className="mb-4 rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
                El enlace expiró o no es válido. Pedí uno nuevo.
              </p>
            )}
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
