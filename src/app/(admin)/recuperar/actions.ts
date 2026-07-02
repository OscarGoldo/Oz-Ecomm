"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().trim().email("Ingresá un correo válido"),
});

export interface RecoverState {
  ok: boolean;
  message: string;
}

/** Send a password-recovery email (never reveals whether the email exists). */
export async function requestPasswordReset(
  _prev: RecoverState | null,
  formData: FormData,
): Promise<RecoverState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Correo inválido",
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const supabase = createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/callback?next=/actualizar-clave`,
  });

  return {
    ok: true,
    message:
      "Si ese correo tiene una cuenta, te enviamos un enlace para restablecer tu contraseña. Revisá tu bandeja (y el spam).",
  };
}
