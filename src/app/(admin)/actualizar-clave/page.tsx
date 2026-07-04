import type { Metadata } from "next";
import Link from "next/link";

import { OzLogo } from "@/components/landing/oz-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UpdatePasswordForm } from "./update-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default function ActualizarClavePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex justify-center">
          <OzLogo className="h-12 w-auto" />
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Crear nueva contraseña</CardTitle>
            <CardDescription>
              Elige una contraseña nueva para tu cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpdatePasswordForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
