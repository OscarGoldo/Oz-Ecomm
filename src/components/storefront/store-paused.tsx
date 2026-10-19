import { MessageCircle, PauseCircle } from "lucide-react";

import { whatsappUrl } from "@/lib/whatsapp";
import type { Store } from "@/types/database";

/**
 * Lo que ve el cliente en una tienda en pausa: una tienda nueva que dejó vencer
 * su plan y pasó la gracia (ver isPaused en lib/plans).
 *
 * No es un 404 ni la portada de Tiendify: el cliente llegó por el link del
 * comerciante y tiene que poder hablarle. Por eso vive dentro del layout de la
 * tienda (header, footer, WhatsApp) y lleva el botón para escribirle. Los
 * pedidos que ya estaban no pasan por acá: su página sigue abierta para pagar
 * o subir el comprobante.
 */
export function StorePaused({ store }: { store: Pick<Store, "name" | "whatsapp"> }) {
  const chat = whatsappUrl(
    store.whatsapp,
    `Hola! Quería comprar en ${store.name} y la tienda está en pausa.`,
  );

  return (
    <main className="container grid min-h-[55vh] place-items-center py-12">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <PauseCircle className="size-7" />
        </span>
        <h1 className="text-xl font-bold tracking-tight">
          {store.name} está en pausa
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Por ahora no se pueden hacer compras en esta tienda.
          {chat ? " Escríbele directamente para comprar o saber cuándo vuelve." : ""}
        </p>
        {chat && (
          <a
            href={chat}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <MessageCircle className="size-4" />
            Escribir por WhatsApp
          </a>
        )}
      </div>
    </main>
  );
}
