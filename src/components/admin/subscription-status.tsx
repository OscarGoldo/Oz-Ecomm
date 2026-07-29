"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cancelProSubscription } from "@/app/(admin)/panel/plan/actions";
import type { SubscriptionState } from "@/types/database";

/**
 * Estado de la renovación automática, con la opción de cancelarla.
 *
 * Cancelar corta la renovación pero NO el plan: lo que ya pagó corre hasta su
 * vencimiento. El texto lo dice explícito para que nadie dude antes de tocar.
 */
export function SubscriptionStatus({
  status,
  expiresAt,
}: {
  status: SubscriptionState;
  expiresAt: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const until = expiresAt
    ? new Date(expiresAt).toLocaleDateString("es-VE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  async function cancel() {
    setBusy(true);
    const res = await cancelProSubscription();
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "No se pudo cancelar");
    toast.success("Renovación cancelada", {
      description: until ? `Tu plan sigue activo hasta el ${until}.` : undefined,
    });
    setConfirming(false);
    router.refresh();
  }

  if (status === "suspended") {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle className="size-4" /> No pudimos cobrar tu renovación
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          PayPal no pudo procesar el cobro — suele ser una tarjeta vencida o sin
          fondos. Revisa tu método de pago en PayPal.
          {until && ` Tu plan sigue activo hasta el ${until}.`}
        </p>
      </div>
    );
  }

  if (status === "cancelled" || status === "expired") {
    return (
      <div className="rounded-xl border bg-card p-4">
        <p className="font-medium">Renovación automática cancelada</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {until
            ? `Tu plan Pro sigue activo hasta el ${until}. Después pasa a Gratis.`
            : "Tu plan pasa a Gratis al vencer."}{" "}
          Puedes volver a suscribirte cuando quieras.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-2 font-medium">
        <RefreshCw className="size-4 text-primary" /> Renovación automática
        activa
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {until
          ? `Se renueva sola el ${until}. No tienes que hacer nada.`
          : "Se renueva sola al final de cada período."}
      </p>

      {confirming ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm">
            Al cancelar dejas de pagar, pero{" "}
            <span className="font-medium">
              sigues con Pro {until ? `hasta el ${until}` : "hasta el vencimiento"}
            </span>
            . ¿Confirmas?
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={cancel} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Sí, cancelar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              No, seguir
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
        >
          Cancelar renovación automática
        </button>
      )}
    </div>
  );
}
