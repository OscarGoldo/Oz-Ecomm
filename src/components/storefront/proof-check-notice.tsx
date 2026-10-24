"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { checkOrderProof } from "@/app/(public)/[store_slug]/pedido/[order_id]/actions";
import { formatBs, formatUSD } from "@/lib/format";
import type { BuyerProofNotice } from "@/lib/proof-rules";

const POLL_MS = 4000;
const MAX_POLLS = 15;

/**
 * Pide la lectura del comprobante al llegar a la página del pedido y, si el
 * monto no alcanza o la imagen no es un comprobante, se lo dice al cliente
 * mientras todavía tiene la app del banco abierta. En cualquier otro caso no
 * muestra nada: la IA no confirma pagos, así que tampoco se le dice al
 * cliente que el suyo "está verificado".
 */
export function ProofCheckNotice({
  orderId,
  storeId,
  hasWhatsapp,
}: {
  orderId: string;
  storeId: string;
  /** Si la página muestra el botón para escribirle a la tienda. */
  hasWhatsapp: boolean;
}) {
  const [notice, setNotice] = useState<BuyerProofNotice | null>(null);

  useEffect(() => {
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      const res = await checkOrderProof({ order_id: orderId, store_id: storeId }).catch(() => null);
      if (cancelled || !res) return;
      if (res.status === "reading" && polls < MAX_POLLS) {
        polls += 1;
        timer = setTimeout(run, POLL_MS);
        return;
      }
      setNotice(res.notice);
    };
    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, storeId]);

  if (!notice) return null;

  const tell = hasWhatsapp ? "avísale a la tienda con el botón de abajo" : "avísale a la tienda";
  const money = (n: number) =>
    notice.kind === "amount_low" && notice.currency === "VES" ? formatBs(n) : formatUSD(n);

  return (
    <div
      role="status"
      className="mt-6 flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
      {notice.kind === "amount_low" ? (
        <div>
          <p className="font-semibold">Revisa el monto de tu pago</p>
          <p className="mt-1 text-muted-foreground">
            Tu comprobante dice {money(notice.paid)} y el pedido es de {money(notice.expected)}. Si
            te faltó una parte, págala y {tell}.
          </p>
        </div>
      ) : (
        <div>
          <p className="font-semibold">Esa imagen no parece un comprobante</p>
          <p className="mt-1 text-muted-foreground">
            Mándale a la tienda la captura de tu pago
            {hasWhatsapp ? " con el botón de abajo" : ""} para que pueda confirmarlo.
          </p>
        </div>
      )}
    </div>
  );
}
