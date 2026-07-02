"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, type RecoverState } from "./actions";

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
          <Send /> Enviar enlace
        </>
      )}
    </Button>
  );
}

export function RecoverForm() {
  const [state, formAction] = useFormState<RecoverState | null, FormData>(
    requestPasswordReset,
    null,
  );

  if (state?.ok) {
    return (
      <p className="rounded-md bg-success/10 p-4 text-center text-sm text-success">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Correo de tu cuenta</Label>
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
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
      <SubmitButton />
    </form>
  );
}
