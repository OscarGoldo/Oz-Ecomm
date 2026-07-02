import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { OzLogo } from "@/components/landing/oz-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RecoverForm } from "./recover-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecuperarPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex justify-center">
          <OzLogo className="h-12 w-auto" />
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Recuperar contraseña</CardTitle>
            <CardDescription>
              Te enviamos un enlace a tu correo para crear una nueva.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecoverForm />
            <Link
              href="/login"
              className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Volver a ingresar
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
