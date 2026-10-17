import type { Metadata } from "next";

import { Eyebrow, Sticker, wrap } from "@/components/landing/landing-ui";
import {
  BackLink,
  BarLink,
  FormCard,
  PageShell,
  pageLead,
  pageTitle,
} from "@/components/landing/page-shell";
import { RecoverForm } from "./recover-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecuperarPage() {
  return (
    <PageShell
      action={
        <BarLink href="/login" hint="¿Ya la recordaste?">
          Ingresar
        </BarLink>
      }
    >
      <main className={`${wrap} pb-20 pt-8 sm:pt-12`}>
        <div className="mx-auto max-w-[34rem]">
          <BackLink href="/login">Volver a ingresar</BackLink>
          <Eyebrow>Recuperar contraseña</Eyebrow>
          <h1 className={pageTitle}>
            ¿Olvidaste tu <Sticker>contraseña?</Sticker>
          </h1>
          <p className={pageLead}>
            Te enviamos un enlace a tu correo para crear una nueva.
          </p>

          <FormCard className="mt-8">
            <RecoverForm />
          </FormCard>
        </div>
      </main>
    </PageShell>
  );
}
