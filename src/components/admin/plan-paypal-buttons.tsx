"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  captureProPaypalPayment,
  createProPaypalOrder,
} from "@/app/(admin)/panel/plan/actions";

interface PaypalButtonsApi {
  FUNDING: { CARD: string };
  Buttons: (opts: {
    fundingSource?: string;
    style?: Record<string, unknown>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onError?: (err: unknown) => void;
    onCancel?: () => void;
  }) => {
    render: (el: HTMLElement) => Promise<void>;
    isEligible?: () => boolean;
  };
}

function loadPaypalSdk(clientId: string): Promise<PaypalButtonsApi | null> {
  return new Promise((resolve) => {
    const w = window as unknown as { paypal?: PaypalButtonsApi };
    if (w.paypal) {
      resolve(w.paypal);
      return;
    }
    const id = "paypal-sdk";
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(w.paypal ?? null));
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      clientId,
    )}&currency=USD&intent=capture&components=buttons`;
    script.onload = () => resolve(w.paypal ?? null);
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
}

/**
 * Smart Buttons de PayPal para pagar el plan Pro. Incluyen la opción de
 * tarjeta de débito/crédito sin cuenta de PayPal.
 *
 * El período se lee con una ref y no como dependencia del efecto: el SDK se
 * monta una sola vez, y si el efecto se re-ejecutara al cambiar de 1 a 12
 * meses los botones se re-renderizarían encima de sí mismos.
 */
export function PlanPaypalButtons({
  clientId,
  months,
  onPaid,
}: {
  clientId: string;
  months: number;
  onPaid: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const monthsRef = useRef(months);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [capturing, setCapturing] = useState(false);

  // Mantiene el período actual disponible dentro de los callbacks del SDK.
  useEffect(() => {
    monthsRef.current = months;
  }, [months]);

  useEffect(() => {
    let cancelled = false;
    loadPaypalSdk(clientId).then((paypal) => {
      if (cancelled) return;
      if (!paypal || !containerRef.current || renderedRef.current) {
        if (!paypal) setFailed(true);
        setLoading(false);
        return;
      }
      renderedRef.current = true;
      setLoading(false);
      const build = (fundingSource?: string) =>
        paypal.Buttons({
          ...(fundingSource ? { fundingSource } : {}),
          style: { layout: "vertical", shape: "rect", label: "pay" },
          createOrder: async () => {
            const res = await createProPaypalOrder(monthsRef.current);
            if (!res.ok || !res.paypalOrderId) {
              throw new Error(res.error ?? "No se pudo iniciar el pago");
            }
            return res.paypalOrderId;
          },
          onApprove: async (data) => {
            setCapturing(true);
            const res = await captureProPaypalPayment(
              data.orderID,
              monthsRef.current,
            );
            setCapturing(false);
            if (!res.ok) {
              toast.error(res.error ?? "No se pudo confirmar el pago");
              return;
            }
            toast.success("¡Plan Pro activado!");
            onPaid();
          },
          onError: (err) => {
            console.error("PayPal error", err);
            const msg =
              err instanceof Error && err.message
                ? err.message
                : "Hubo un problema con el pago. Intentá de nuevo.";
            toast.error(msg.slice(0, 200));
          },
        });

      // Solo tarjeta. Si la cuenta no la admite suelta, se cae a la pila
      // completa: renderizar igual dejaría el contenedor vacío.
      const card = build(paypal.FUNDING?.CARD);
      const target = card.isEligible && !card.isEligible() ? build() : card;
      target.render(containerRef.current).catch(() => setFailed(true));
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
      {capturing && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Confirmando tu pago, no
          cierres esta página…
        </div>
      )}
    </div>
  );
}
