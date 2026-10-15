import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Official BCV rates via dolarapi (clean JSON, no scraping needed).
const USD_URL = "https://ve.dolarapi.com/v1/dolares/oficial";
const EUR_URL = "https://ve.dolarapi.com/v1/euros/oficial";

export interface BcvRates {
  usd: number | null;
  eur: number | null;
  date: string | null;
}

async function fetchOne(url: string): Promise<{ promedio?: number; fechaActualizacion?: string } | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as { promedio?: number; fechaActualizacion?: string };
  } catch {
    return null;
  }
}

/** Fetch the current BCV USD + EUR rates from the source. */
export async function fetchBcvRates(): Promise<BcvRates | null> {
  const [u, e] = await Promise.all([fetchOne(USD_URL), fetchOne(EUR_URL)]);
  const usd = typeof u?.promedio === "number" ? u.promedio : null;
  const eur = typeof e?.promedio === "number" ? e.promedio : null;
  if (usd == null && eur == null) return null;
  return { usd, eur, date: u?.fechaActualizacion ?? e?.fechaActualizacion ?? null };
}

export interface CachedBcvRates {
  usd: number | null;
  eur: number | null;
  source_date: string | null;
  updated_at: string;
}

/**
 * La tasa USD cacheada, para páginas que se prerenderizan.
 *
 * Usa el cliente admin en vez del de sesión a propósito: `createClient()` lee
 * cookies, y eso obliga a Next a renderizar la página en cada request. La
 * landing es estática y tiene que seguir siéndolo — leer la tasa no puede
 * costar una consulta por visita. La tabla `bcv_rates` es pública de todos
 * modos (una fila, sin datos de nadie).
 */
export async function getPublicUsdRate(): Promise<number | null> {
  try {
    const { data } = await createAdminClient()
      .from("bcv_rates")
      .select("usd")
      .eq("id", "current")
      .maybeSingle();
    return data?.usd != null ? Number(data.usd) : null;
  } catch {
    return null;
  }
}

/**
 * La tasa con la que nace una tienda nueva: la misma del BCV que el cron ya le
 * puso a las demás, con la misma fecha.
 *
 * Las tiendas nacen con la tasa automática (migración 0023), pero el cron pasa
 * una vez al día a las 8 AM. Sin esto, una tienda creada a media tarde se
 * quedaba sin tasa hasta la mañana siguiente: sin precios en bolívares y con el
 * Pago Móvil pidiéndole al cliente el monto en dólares. Justo el día que más
 * tiendas se crean es el de una campaña.
 *
 * Solo USD, que es la moneda con la que nace toda tienda. Devuelve {} si no hay
 * tasa guardada: la tienda queda sin tasa, como antes, y el cron la completa.
 */
export async function initialExchangeRate(): Promise<{
  exchange_rate?: number;
  exchange_rate_updated_at?: string;
}> {
  try {
    const { data } = await createAdminClient()
      .from("bcv_rates")
      .select("usd, updated_at")
      .eq("id", "current")
      .maybeSingle();
    const usd = data?.usd != null ? Number(data.usd) : null;
    if (!data || !usd || usd <= 0) return {};
    return { exchange_rate: usd, exchange_rate_updated_at: data.updated_at };
  } catch {
    return {};
  }
}

/** Read the cached BCV rates (refreshed daily by the cron). */
export async function getCachedBcvRates(): Promise<CachedBcvRates | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("bcv_rates")
    .select("usd, eur, source_date, updated_at")
    .eq("id", "current")
    .maybeSingle();
  if (!data) return null;
  return {
    usd: data.usd != null ? Number(data.usd) : null,
    eur: data.eur != null ? Number(data.eur) : null,
    source_date: data.source_date,
    updated_at: data.updated_at,
  };
}
