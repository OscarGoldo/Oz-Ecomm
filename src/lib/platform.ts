import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_PRO_PRICE_USD,
  DEFAULT_PRO_PRICE_YEARLY_USD,
} from "@/lib/plans";
import type { SubscriptionMethod } from "@/types/database";

/** Datos de cobro de la plataforma (los tuyos), ya normalizados. */
export interface PlatformPayment {
  method: SubscriptionMethod;
  label: string;
  /** Pares etiqueta/valor para mostrar y copiar. */
  fields: { label: string; value: string }[];
}

export interface PlatformConfig {
  prices: { monthly: number; yearly: number };
  payments: PlatformPayment[];
}

const FALLBACK: PlatformConfig = {
  prices: { monthly: DEFAULT_PRO_PRICE_USD, yearly: DEFAULT_PRO_PRICE_YEARLY_USD },
  payments: [],
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function fields(
  raw: unknown,
  defs: { key: string; label: string }[],
): { label: string; value: string }[] {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return defs
    .map((d) => ({ label: d.label, value: str(obj[d.key]) }))
    .filter((f) => f.value !== "");
}

/**
 * Configuración de cobro de la plataforma. Se lee con service role a propósito:
 * `platform_settings` no tiene policy de lectura para tenants, así que solo la
 * ve el Server Component que la renderiza, nunca el cliente directamente.
 *
 * Si la tabla todavía no existe (migración sin correr), devuelve precios por
 * defecto y sin métodos de pago, en vez de romper el panel.
 */
export async function getPlatformConfig(): Promise<PlatformConfig> {
  const db = createAdminClient();
  const { data } = await db.from("platform_settings").select("*").maybeSingle();
  if (!data) return FALLBACK;

  const payments: PlatformPayment[] = [
    {
      method: "pago_movil" as const,
      label: "Pago Móvil",
      fields: fields(data.pago_movil, [
        { key: "banco", label: "Banco" },
        { key: "telefono", label: "Teléfono" },
        { key: "cedula", label: "Cédula / RIF" },
        { key: "titular", label: "Titular" },
      ]),
    },
    {
      method: "zelle" as const,
      label: "Zelle",
      fields: fields(data.zelle, [
        { key: "email", label: "Email" },
        { key: "titular", label: "Titular" },
      ]),
    },
    {
      method: "binance" as const,
      label: "Binance",
      fields: fields(data.binance, [
        { key: "email_o_id", label: "Email o ID" },
      ]),
    },
    {
      method: "paypal" as const,
      label: "PayPal",
      fields: fields(data.paypal, [{ key: "email", label: "Email" }]),
    },
  ].filter((p) => p.fields.length > 0);

  return {
    prices: {
      monthly: Number(data.pro_price_usd) || DEFAULT_PRO_PRICE_USD,
      yearly: Number(data.pro_price_yearly_usd) || DEFAULT_PRO_PRICE_YEARLY_USD,
    },
    payments,
  };
}
