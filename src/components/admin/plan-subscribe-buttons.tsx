"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { registerProSubscription } from "@/app/(admin)/panel/plan/actions";

interface PaypalSdk {
  Buttons: (opts: {
    style?: Record<string, unknown>;
    createSubscription: (
      data: unknown,
      actions: { subscription: { create: (o: Record<string, unknown>) => Promise<string> } },
    ) => Promise<string>;
    onApprove: (data: { subscriptionID?: string | null }) => Promise<void>;
    onError?: (err: unknown) => void;
  }) => { render: (el: HTMLElement) => Promise<void> };
}

/**
 * El SDK para suscripciones se carga distinto que para pagos únicos
 * (`vault=true&intent=subscription`), y PayPal no permite las dos variantes en
 * la misma página. Por eso este componente usa su propio id de script y esta
 * pantalla ofrece suscripción o pago único, nunca los dos a la vez.
 */
function loadSdk(clientId: string): Promise<PaypalSdk | null> {
  return new Promise((resolve) => {
    const w = window as unknown as { paypal?: PaypalSdk };
    const id = "paypal-sdk-subscriptions";
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (w.paypal) resolve(w.paypal);
      else existing.addEventListener("load", () => resolve(w.paypal ?? null));
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src =
      `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}` +
      `&vault=true&intent=subscription&currency=USD&components=buttons`;
    script.onload = () => resolve(w.paypal ?? null);
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
}

/**
 * Botones de suscripción recurrente. Incluyen la opción de tarjeta de
 * débito/crédito sin cuenta de PayPal.
 *
 * El plan y el storeId se leen por ref para que cambiar de mensual a anual no
 * re-monte los botones encima de sí mismos.
 */
export function PlanSubscribeButtons({
  clientId,
  planId,
  storeId,
  onSubscribed,
}: {
  clientId: string;
  planId: string;
  storeId: string;
  onSubscribed: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const planRef = useRef(planId);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    planRef.current = planId;
  }, [planId]);

  useEffect(() => {
    let cancelled = false;
    loadSdk(clientId).then((paypal) => {
      if (cancelled) return;
      if (!paypal || !containerRef.current || renderedRef.current) {
        if (!paypal) setFailed(true);
        setLoading(false);
        return;
      }
      renderedRef.current = true;
      setLoading(false);
      paypal
        .Buttons({
          style: { layout: "vertical", shape: "rect", label: "subscribe" },
          createSubscription: (_data, actions) =>
            actions.subscription.create({
              plan_id: planRef.current,
              // El servidor usa esto para saber de qué tienda es el cobro,
              // incluso si el registro posterior falla.
              custom_id: storeId,
            }),
          onApprove: async (data) => {
            if (!data.subscriptionID) {
              toast.error("PayPal no devolvió la suscripción");
              return;
            }
            setWorking(true);
            const res = await registerProSubscription(data.subscriptionID);
            setWorking(false);
            if (!res.ok) {
              toast.error(res.error ?? "No se pudo registrar la suscripción");
              return;
            }
            toast.success("¡Suscripción activada!", {
              description:
                "Tu plan se activa apenas PayPal confirme el primer cobro.",
            });
            onSubscribed();
          },
          onError: (err) => {
            console.error("PayPal subscription error", err);
            const msg =
              err instanceof Error && err.message
                ? err.message
                : "Hubo un problema. Intentá de nuevo.";
            toast.error(msg.slice(0, 200));
          },
        })
        .render(containerRef.current)
        .catch(() => setFailed(true));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (failed) {
    return (
      <p className="text-sm text-destructive">
        No se pudo cargar PayPal. Revisá tu conexión e intentá de nuevo.
      </p>
    );
  }

  return (
    <div>
      {loading && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando PayPal…
        </div>
      )}
      <div ref={containerRef} />
      {working && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Registrando tu
          suscripción…
        </div>
      )}
    </div>
  );
}
