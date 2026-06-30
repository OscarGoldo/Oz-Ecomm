"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createOrder,
  createPaypalOrderAction,
  type CheckoutInput,
} from "@/app/(public)/[store_slug]/checkout/actions";

interface PaypalButtonsApi {
  Buttons: (opts: {
    style?: Record<string, unknown>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onError?: (err: unknown) => void;
    onCancel?: () => void;
  }) => { render: (el: HTMLElement) => Promise<void> };
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
 * PayPal Smart Buttons (PayPal + credit/debit card). Charges the server
 * computed total and, on success, creates the order as paid.
 */
export function PaypalButtons({
  clientId,
  getInput,
  onSuccess,
}: {
  clientId: string;
  getInput: () => CheckoutInput | null;
  onSuccess: (orderId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

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
      paypal
        .Buttons({
          style: { layout: "vertical", shape: "rect", label: "pay" },
          createOrder: async () => {
            const input = getInput();
            if (!input) throw new Error("Completá tus datos primero");
            const res = await createPaypalOrderAction(input);
            if (!res.ok || !res.paypalOrderId) {
              throw new Error(res.error ?? "No se pudo iniciar el pago");
            }
            return res.paypalOrderId;
          },
          onApprove: async (data) => {
            const input = getInput();
            if (!input) return;
            const res = await createOrder({
              ...input,
              paypal_order_id: data.orderID,
            });
            if (!res.ok || !res.orderId) {
              toast.error(res.error ?? "No se pudo confirmar el pago");
              return;
            }
            onSuccess(res.orderId);
          },
          onError: (err) => {
            // Surface the real reason (helps diagnose mobile-only failures).
            console.error("PayPal error", err);
            const msg =
              err instanceof Error && err.message
                ? err.message
                : typeof err === "string" && err
                  ? err
                  : "Hubo un problema con el pago. Intentá de nuevo.";
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
    </div>
  );
}
