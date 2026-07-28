"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approveSubscriptionPayment,
  getProofUrl,
  rejectSubscriptionPayment,
} from "@/app/(superadmin)/super/suscripciones/actions";

/** Aprobar / rechazar un comprobante de suscripción, con ver el comprobante. */
export function SubscriptionReview({
  paymentId,
  proofPath,
}: {
  paymentId: string;
  proofPath: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  async function openProof() {
    if (!proofPath) return;
    const url = await getProofUrl(proofPath);
    if (!url) return toast.error("No se pudo abrir el comprobante");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function approve() {
    setBusy(true);
    const res = await approveSubscriptionPayment(paymentId);
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Plan activado");
    router.refresh();
  }

  async function reject() {
    setBusy(true);
    const res = await rejectSubscriptionPayment(paymentId, note);
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Comprobante rechazado");
    setRejecting(false);
    setNote("");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {proofPath && (
          <Button size="sm" variant="outline" onClick={openProof}>
            <ExternalLink className="size-4" /> Ver comprobante
          </Button>
        )}
        <Button size="sm" onClick={approve} disabled={busy}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Aprobar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setRejecting((v) => !v)}
          disabled={busy}
        >
          <X className="size-4" /> Rechazar
        </Button>
      </div>

      {rejecting && (
        <div className="flex gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motivo (lo ve el comerciante)"
            className="h-9"
            maxLength={200}
          />
          <Button size="sm" variant="destructive" onClick={reject} disabled={busy}>
            Confirmar
          </Button>
        </div>
      )}
    </div>
  );
}
