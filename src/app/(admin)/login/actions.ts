"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email("Ingresá un correo válido"),
});

export interface LoginState {
  ok: boolean;
  message: string;
}

/**
 * Sends a magic link to a pre-provisioned store owner. `shouldCreateUser` is
 * false so only existing accounts (created via seed / super-admin) can sign in.
 */
export async function sendMagicLink(
  _prev: LoginState | null,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Correo inválido",
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${appUrl}/auth/callback?next=/panel`,
    },
  });

  if (error) {
    return {
      ok: false,
      message:
        "No pudimos enviar el enlace. Verificá que el correo esté registrado.",
    };
  }

  return {
    ok: true,
    message: "Te enviamos un enlace de acceso. Revisá tu correo.",
  };
}
