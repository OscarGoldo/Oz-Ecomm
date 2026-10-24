"use server";

import { z } from "zod";

import { ensureProofCheck } from "@/lib/proof-check";
import { buyerNotice, type BuyerProofNotice } from "@/lib/proof-rules";

const schema = z.object({
  order_id: z.string().uuid(),
  store_id: z.string().uuid(),
});

export interface BuyerProofCheck {
  /** "reading": todavía se está leyendo; "none": no hay nada que decir. */
  status: "reading" | "done" | "none";
  notice: BuyerProofNotice | null;
}

/**
 * Lee el comprobante del pedido apenas el cliente llega a la página de su
 * pedido, que se abre sola al comprar. Así la lectura ya está cuando el
 * comerciante abre el pedido, y si el monto no alcanza el cliente se entera
 * mientras todavía tiene la app del banco abierta.
 *
 * Mismo modelo de acceso que la página: quien tiene el UUID del pedido. Es
 * seguro porque solo lee una captura que ya está en el pedido, una vez, y al
 * cliente le devuelve únicamente lo que sirve para corregir un error honesto
 * (ver `buyerNotice`), nunca las alertas de fraude.
 */
export async function checkOrderProof(input: z.input<typeof schema>): Promise<BuyerProofCheck> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { status: "none", notice: null };

  const check = await ensureProofCheck(parsed.data.order_id, parsed.data.store_id);
  if (!check || check.status === "failed") return { status: "none", notice: null };
  if (check.status === "reading") return { status: "reading", notice: null };
  return { status: "done", notice: buyerNotice(check.flags) };
}
