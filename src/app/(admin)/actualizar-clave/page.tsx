import type { Metadata } from "next";

import { Eyebrow, Sticker, wrap } from "@/components/landing/landing-ui";
import {
  BarLink,
  FormCard,
  PageShell,
  pageLead,
  pageTitle,
} from "@/components/landing/page-shell";
import { UpdatePasswordForm } from "./update-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default function ActualizarClavePage() {
  return (
    <PageShell action={<BarLink href="/login">Ingresar</BarLink>}>
      <main className={`${wrap} pb-20 pt-8 sm:pt-12`}>
        <div className="mx-auto max-w-[34rem]">
          <Eyebrow>Nueva contraseña</Eyebrow>
          <h1 className={pageTitle}>
            Crea tu contraseña <Sticker>nueva.</Sticker>
          </h1>
          <p className={pageLead}>
            Elige una contraseña nueva para tu cuenta. Al guardarla entras
            directo a tu panel.
          </p>

          <FormCard className="mt-8">
            <UpdatePasswordForm />
          </FormCard>
        </div>
      </main>
    </PageShell>
  );
}
