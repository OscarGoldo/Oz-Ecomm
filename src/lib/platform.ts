import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { paypalCredsFromEnv } from "@/lib/paypal";
import {
  DEFAULT_PRO_PRICE_QUARTERLY_USD,
  DEFAULT_PRO_PRICE_USD,
  DEFAULT_PRO_PRICE_YEARLY_USD,
  type PlanPrices,
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
  prices: PlanPrices;
  /** Métodos manuales: el comerciante copia los datos y sube comprobante. */
  payments: PlatformPayment[];
  /**
   * PayPal se cobra online, no se copia. Va aparte de `payments` porque no
   * son datos que el comerciante transcribe, sino un botón que cobra y activa
   * el plan al instante. Depende solo de las credenciales de entorno.
   */
  paypalEnabled: boolean;
}

const FALLBACK: PlatformConfig = {
  prices: {
    monthly: DEFAULT_PRO_PRICE_USD,
    quarterly: DEFAULT_PRO_PRICE_QUARTERLY_USD,
    yearly: DEFAULT_PRO_PRICE_YEARLY_USD,
  },
  payments: [],
  paypalEnabled: false,
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
  const paypalEnabled = paypalCredsFromEnv() !== null;

  const db = createAdminClient();
  const { data } = await db.from("platform_settings").select("*").maybeSingle();
  if (!data) return { ...FALLBACK, paypalEnabled };

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
  ].filter((p) => p.fields.length > 0);

  return {
    prices: {
      monthly: Number(data.pro_price_usd) || DEFAULT_PRO_PRICE_USD,
      // Si la migración 0022 todavía no corrió, la columna no viene y el
      // trimestre cae a 3× el mensual en vez de a 0.
      quarterly:
        Number(data.pro_price_quarterly_usd) ||
        (Number(data.pro_price_usd) || DEFAULT_PRO_PRICE_USD) * 3,
      yearly: Number(data.pro_price_yearly_usd) || DEFAULT_PRO_PRICE_YEARLY_USD,
    },
    payments,
    paypalEnabled,
  };
}
