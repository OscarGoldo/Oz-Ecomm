"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approveReferral,
  discardReferral,
} from "@/app/(superadmin)/super/referidos/actions";

/** Acreditar o descartar un referido que quedó esperando revisión. */
export function ReferralReview({ referralId }: { referralId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function approve() {
    setBusy(true);
    const res = await approveReferral(referralId);
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Mes acreditado");
    router.refresh();
  }

  async function discard() {
    setBusy(true);
    const res = await discardReferral(referralId, reason);
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Referido descartado");
    setRejecting(false);
    setReason("");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={approve} disabled={busy}>
          <Check className="mr-1.5 size-4" /> Acreditar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRejecting((v) => !v)}
          disabled={busy}
        >
          <X className="mr-1.5 size-4" /> Descartar
        </Button>
      </div>

      {rejecting && (
        <div className="flex gap-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (queda guardado)"
            className="h-9"
          />
          <Button size="sm" variant="destructive" onClick={discard} disabled={busy}>
            Confirmar
          </Button>
        </div>
      )}
    </div>
  );
}
