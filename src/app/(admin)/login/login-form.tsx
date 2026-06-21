"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" /> Enviando…
        </>
      ) : (
        <>
          <Mail /> Enviar enlace de acceso
        </>
      )}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState<LoginState | null, FormData>(
    sendMagicLink,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  if (state?.ok) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center text-sm">
        <Mail className="mx-auto mb-2 size-6 text-success" />
        <p className="font-medium">Revisá tu correo</p>
        <p className="mt-1 text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          required
        />
      </div>
      <SubmitButton />
      <p className="text-center text-xs text-muted-foreground">
        Te enviaremos un enlace mágico. No necesitás contraseña.
      </p>
    </form>
  );
}
