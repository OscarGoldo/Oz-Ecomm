"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  cancelProStripeSubscription,
  cancelProSubscription,
} from "@/app/(admin)/panel/plan/actions";
import type { SubscriptionState } from "@/types/database";

/**
 * La suscripción que se cobra sola, con el botón para darla de baja.
 *
 * Cancelar corta los cobros pero NO el plan: lo que ya pagó corre hasta su
 * vencimiento. El texto lo dice explícito para que nadie dude antes de tocar.
 *
 * El botón es un botón y no un enlace gris al pie: darse de baja tiene que ser
 * tan fácil de encontrar como suscribirse. Escondido, lo único que se logra es
 * que el comerciante lo pida por WhatsApp o desconozca el cobro con su banco.
 *
 * Las fechas llegan ya escritas desde el servidor: formateadas acá saldrían en
 * la zona horaria del navegador y no coincidirían con las del resto de la
 * página.
 */
export function SubscriptionStatus({
  status,
  until,
  charge,
  provider = "paypal",
}: {
  status: SubscriptionState;
  /** Hasta cuándo tiene Pro ("9 de noviembre de 2026"). null = sin fecha. */
  until: string | null;
  /**
   * Qué se cobra y cuándo toca de nuevo, deducido del último cobro que entró.
   * null si todavía no hay ninguno registrado.
   */
  charge: { label: string; nextDate: string } | null;
  /** Quién cobra la renovación. Decide a quién se le cancela. */
  provider?: "paypal" | "stripe";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    const res =
      provider === "stripe"
        ? await cancelProStripeSubscription()
        : await cancelProSubscription();
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "No se pudo cancelar");
    toast.success("Suscripción cancelada", {
      description: until ? `Tu plan sigue activo hasta el ${until}.` : undefined,
    });
    setConfirming(false);
    router.refresh();
  }

  if (status === "cancelled" || status === "expired") {
    return (
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <p className="font-medium">Suscripción cancelada</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ya no se te cobra nada.{" "}
          {until
            ? `Tu plan Pro sigue activo hasta el ${until} y después pasa a Gratis.`
            : "Tu plan pasa a Gratis al vencer."}{" "}
          Puedes volver a suscribirte cuando quieras.
        </p>
      </div>
    );
  }

  // JSX en una variable y no en un componente anidado, igual que en el
  // checkout: lo usan los dos estados de abajo.
  const cancelControl = confirming ? (
    <div className="mt-3 space-y-2.5 rounded-lg border bg-background p-3">
      <p className="text-sm">
        Si cancelas, no se te cobra más.{" "}
        <span className="font-medium">
          Sigues con Pro {until ? `hasta el ${until}` : "hasta el vencimiento"}
        </span>{" "}
        y después pasas a Gratis. ¿Confirmas?
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="destructive" onClick={cancel} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Sí, cancelar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirming(false)}
          disabled={busy}
        >
          No, seguir suscrito
        </Button>
      </div>
    </div>
  ) : (
    <Button
      size="sm"
      variant="outline"
      className="mt-3"
      onClick={() => setConfirming(true)}
    >
      Cancelar suscripción
    </Button>
  );

  if (status === "suspended") {
    return (
      <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle className="size-4 shrink-0" /> No pudimos cobrar tu
          renovación
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {provider === "stripe" ? "No se pudo" : "PayPal no pudo"} procesar el
          cobro — suele ser una tarjeta vencida o sin fondos.
          {until && ` Tu plan sigue activo hasta el ${until}.`} Mientras esta
          suscripción siga abierta puede volver a intentar el cobro: si
          prefieres pagar de otra forma, cancélala primero para que no se te
          cobre dos veces.
        </p>
        {cancelControl}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Tu suscripción</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
          <RefreshCw className="size-3" /> Se renueva sola
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {charge
          ? `Pro · ${charge.label}. Próximo cobro el ${charge.nextDate}.`
          : "Pro. Se cobra sola al final de cada período."}{" "}
        No tienes que hacer nada.
      </p>
      {cancelControl}
    </div>
  );
}
