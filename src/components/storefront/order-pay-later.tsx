"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentProofUpload } from "@/components/storefront/payment-proof-upload";
import { attachPaymentProof } from "@/app/(public)/[store_slug]/checkout/actions";
import { formatBs, formatUSD } from "@/lib/format";

/** Mismo mapa que el checkout: la clave cruda no se le muestra al cliente. */
const DETAIL_LABELS: Record<string, string> = {
  banco: "Banco",
  telefono: "Teléfono",
  cedula: "Cédula / RIF",
  titular: "Titular",
  cuenta: "N° de cuenta",
  email: "Email",
  email_o_id: "Email o ID",
  usuario: "Usuario",
};

/**
 * La segunda mitad del checkout en dos tiempos.
 *
 * El cliente compró sin haber pagado, se fue a la app de su banco y volvió por
 * el enlace del pedido. Acá tiene otra vez los datos de cobro, el monto exacto
 * y el lugar donde subir la captura — sin volver a llenar nada.
 */
export function OrderPayLater({
  orderId,
  storeId,
  total,
  totalBs,
  payInBs,
  details,
  instructions,
}: {
  orderId: string;
  storeId: string;
  total: number;
  totalBs: number | null;
  payInBs: boolean;
  details: [string, string][];
  instructions: string | null;
}) {
  const router = useRouter();
  const [proofPath, setProofPath] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const showBs = payInBs && totalBs !== null;
  const rawAmount = showBs ? totalBs!.toFixed(2) : total.toFixed(2);

  async function copy(text: string, what = "Dato") {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success(`${what} copiado`);
        return;
      }
      throw new Error("sin clipboard");
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = text;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(el);
        if (ok) {
          toast.success(`${what} copiado`);
          return;
        }
      } catch {
        /* cae al aviso */
      }
      toast.error("Tu navegador no deja copiar", {
        description: "Mantén presionado el dato para seleccionarlo.",
      });
    }
  }

  async function submit() {
    if (!proofPath) {
      toast.error("Sube la foto del comprobante");
      return;
    }
    setSaving(true);
    try {
      const res = await attachPaymentProof({
        order_id: orderId,
        store_id: storeId,
        payment_proof_path: proofPath,
        payment_reference: reference || undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo enviar el comprobante");
        return;
      }
      toast.success("¡Listo! La tienda ya está verificando tu pago.");
      router.refresh();
    } catch {
      toast.error("Se perdió la conexión. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border-2 border-primary/40 bg-primary/[0.03] p-4">
      <h2 className="text-base font-bold tracking-tight">Falta tu pago</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Te guardamos el pedido y el precio. Paga con los datos de abajo y sube la
        foto del comprobante para que la tienda lo confirme.
      </p>

      {/* Monto */}
      <div className="mt-4 rounded-lg border border-primary/30 bg-background p-3">
        <p className="text-xs font-medium text-muted-foreground">
          Transfiere exactamente
        </p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-tight tracking-tight">
              {showBs ? formatBs(totalBs!) : formatUSD(total)}
            </p>
            {showBs && (
              <p className="text-xs text-muted-foreground">
                equivale a {formatUSD(total)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => copy(rawAmount, "Monto")}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <Copy className="size-4" /> Copiar
          </button>
        </div>
      </div>

      {/* Datos de cobro */}
      {details.length > 0 && (
        <ul className="mt-3 space-y-1.5 rounded-lg border bg-background p-3">
          {details.map(([key, val]) => (
            <li key={key} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {DETAIL_LABELS[key] ?? key}
              </span>
              <span className="flex items-center gap-1 font-medium">
                <span className="truncate">{val}</span>
                <button
                  type="button"
                  onClick={() => copy(val, DETAIL_LABELS[key] ?? "Dato")}
                  className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Copiar ${DETAIL_LABELS[key] ?? key}`}
                >
                  <Copy className="size-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {instructions && (
        <p className="mt-2 text-xs text-muted-foreground">{instructions}</p>
      )}

      {/* Comprobante */}
      <div className="mt-4 space-y-3">
        <PaymentProofUpload
          storeId={storeId}
          value={proofPath}
          onChange={setProofPath}
          hint="La tienda lo revisa y confirma tu pedido."
        />
        <div className="space-y-2">
          <Label htmlFor="reference">Referencia (opcional)</Label>
          <Input
            id="reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="N° de referencia / confirmación"
          />
        </div>
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={submit}
          disabled={saving || !proofPath}
        >
          {saving ? <Loader2 className="animate-spin" /> : <Send />}
          Enviar comprobante
        </Button>
      </div>
    </section>
  );
}
