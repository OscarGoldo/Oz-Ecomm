"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().trim().email("Ingresá un correo válido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export interface LoginState {
  ok: boolean;
  message: string;
}

/** Email + password sign-in. Redirects to the right panel on success. */
export async function signIn(
  _prev: LoginState | null,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, message: "Correo o contraseña incorrectos." };
  }

  // Role-based destination.
  let dest = "/panel";
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role === "super_admin") dest = "/super";
  }

  redirect(dest);
}
