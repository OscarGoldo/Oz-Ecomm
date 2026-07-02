"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { KeyRound, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword, type UpdatePasswordState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" /> Guardando…
        </>
      ) : (
        <>
          <KeyRound /> Guardar contraseña
        </>
      )}
    </Button>
  );
}

export function UpdatePasswordForm() {
  const [state, formAction] = useFormState<UpdatePasswordState | null, FormData>(
    updatePassword,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          required
          minLength={8}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Repetir contraseña</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="La misma contraseña"
          required
        />
      </div>
      {state && !state.ok && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{state.message}</p>
          <Link
            href="/recuperar"
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            Pedir un enlace nuevo
          </Link>
        </div>
      )}
      <SubmitButton />
    </form>
  );
}
