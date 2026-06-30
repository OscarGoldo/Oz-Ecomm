"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentProofUpload } from "@/components/storefront/payment-proof-upload";
import { settleStorePayout } from "@/app/(superadmin)/super/pagos/actions";

export function PayoutSettle({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    const res = await settleStorePayout(storeId, proof, reference || null);
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Pago registrado");
    setOpen(false);
    setProof(null);
    setReference("");
    router.refresh();
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Check className="size-4" /> Marcar pagado
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Comprobante del pago (lo verá la tienda)</Label>
        <PaymentProofUpload storeId={storeId} value={proof} onChange={setProof} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Referencia (opcional)</Label>
        <Input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="N° de operación / nota"
          className="h-9"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button size="sm" onClick={confirm} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Confirmar pago
        </Button>
      </div>
    </div>
  );
}
