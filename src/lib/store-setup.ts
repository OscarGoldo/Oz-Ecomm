import "server-only";

import { cache } from "react";

import { PAYMENT_METHOD_META } from "@/lib/constants";
import { formatUSD } from "@/lib/format";
import { paypalEnabled } from "@/lib/paypal";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethodType, Store } from "@/types/database";

/**
 * Cómo está configurada la tienda, dicho corto: lo que muestran las pestañas
 * de Ajustes debajo de cada nombre y la lista de "lista para vender".
 */

export interface SetupItem {
  label: string;
  done: boolean;
  href: string;
  /** Qué tocar cuando falta: "Subir", "Agregar". */
  action: string;
}

export interface StoreSetup {
  summaries: {
    tienda: { text: string; warn?: boolean };
    pagos: { text: string; warn?: boolean };
    entrega: { text: string; warn?: boolean };
  };
  checklist: SetupItem[];
}

function joinEs(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

/** Una vez por pedido de página: la usan el layout y la página de Ajustes. */
export const getStoreSetup = cache(async (store: Store): Promise<StoreSetup> => {
  const supabase = createClient();
  const { data } = await supabase
    .from("payment_methods")
    .select("type")
    .eq("store_id", store.id)
    .eq("active", true)
    .order("display_order");
  const showPaypal = paypalEnabled();
  const types = [
    ...new Set(
      ((data ?? []) as { type: PaymentMethodType }[])
        .map((m) => m.type)
        .filter((t) => showPaypal || t !== "paypal"),
    ),
  ];

  const delivery: string[] = [];
  if (store.offers_delivery) {
    delivery.push(Number(store.delivery_fee) > 0 ? `Delivery ${formatUSD(Number(store.delivery_fee)).replace(/\.00$/, "")}` : "Delivery gratis");
  }
  if (store.offers_pickup) delivery.push("retiro en tienda");

  const payLabels = types.map((t) => PAYMENT_METHOD_META[t]?.label ?? t);
  const missing = [
    !store.whatsapp && "WhatsApp",
    !store.logo_url && "logo",
  ].filter(Boolean) as string[];

  return {
    summaries: {
      tienda: missing.length
        ? { text: `Falta ${joinEs(missing)}`, warn: !store.whatsapp }
        : { text: "Nombre, logo, contacto y tasa" },
      pagos: payLabels.length ? { text: joinEs(payLabels) } : { text: "Ninguna forma de pago activa", warn: true },
      entrega: delivery.length
        ? { text: delivery.join(" · ").replace(/^./, (c) => c.toUpperCase()) }
        : { text: "Sin delivery ni retiro", warn: true },
    },
    checklist: [
      { label: "Logo y nombre", done: !!store.logo_url, href: "/panel/configuracion#identidad", action: "Subir" },
      {
        label: "Descripción",
        done: (store.description ?? "").trim().length >= 10,
        href: "/panel/configuracion#identidad",
        action: "Escribir",
      },
      { label: "WhatsApp para recibir pedidos", done: !!store.whatsapp, href: "/panel/configuracion#contacto", action: "Agregar" },
      {
        label: types.length > 1 ? `${types.length} formas de pago` : "Una forma de pago",
        done: types.length > 0,
        href: "/panel/configuracion/pagos",
        action: "Agregar",
      },
      {
        label: "Delivery o retiro",
        done: store.offers_delivery || store.offers_pickup,
        href: "/panel/configuracion/entrega",
        action: "Configurar",
      },
      { label: "Instagram", done: !!store.instagram, href: "/panel/configuracion#contacto", action: "Agregar" },
      { label: "Banner", done: !!store.banner_url, href: "/panel/configuracion#identidad", action: "Subir" },
    ],
  };
});
