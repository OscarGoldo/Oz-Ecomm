import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Official BCV rates via dolarapi (clean JSON, no scraping needed).
 *
 * Por moneda se leen dos cosas y gana la de fecha valor más nueva:
 *
 * - `/historicos/…/oficial`: cada tasa que publicó el BCV con su fecha valor,
 *   desde que sale. Es la que manda.
 * - `/…/oficial`: la tasa *vigente*. Queda de respaldo si el histórico falla.
 *
 * Antes se leía solo la vigente, y dolarapi recién pasa a la nueva cuando llega
 * su fecha valor. Pero el BCV publica en la tarde la del día hábil siguiente
 * (el viernes, la del lunes), y desde ese momento es la que muestra su web y la
 * que usan los comercios. Tiendify quedaba una tasa por detrás hasta el cron de
 * la mañana siguiente, y el fin de semana entero.
 *
 * Directo de bcv.org.ve no se puede: su certificado viene con la cadena
 * incompleta y fetch lo rechaza (UNABLE_TO_VERIFY_LEAF_SIGNATURE).
 */
const SOURCE = "https://ve.dolarapi.com/v1";

export interface BcvRates {
  usd: number | null;
  eur: number | null;
  /** Fecha valor: desde qué día rige la tasa, no cuándo se leyó. */
  date: string | null;
}

/** Una tasa del BCV con su fecha valor. */
interface Reading {
  rate: number;
  date: string | null;
}

async function getJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function isRate(value: unknown): value is number {
  return typeof value === "number" && value > 0;
}

/** La tasa más nueva que publicó el BCV para una moneda. */
async function latestRate(currency: "dolares" | "euros"): Promise<Reading | null> {
  const [history, current] = await Promise.all([
    getJson(`${SOURCE}/historicos/${currency}/oficial`),
    getJson(`${SOURCE}/${currency}/oficial`),
  ]);

  const readings: Reading[] = [];
  if (Array.isArray(history)) {
    for (const item of history) {
      const { promedio, fecha } = (item ?? {}) as { promedio?: unknown; fecha?: unknown };
      // El histórico trae solo el día ("2026-10-19"); se guarda como la
      // vigente, a medianoche de Caracas (UTC-4 todo el año).
      if (isRate(promedio) && typeof fecha === "string") {
        readings.push({ rate: promedio, date: `${fecha}T00:00:00-04:00` });
      }
    }
  }
  const { promedio, fechaActualizacion } = (current ?? {}) as {
    promedio?: unknown;
    fechaActualizacion?: unknown;
  };
  if (isRate(promedio)) {
    readings.push({
      rate: promedio,
      date: typeof fechaActualizacion === "string" ? fechaActualizacion : null,
    });
  }

  // Sin fecha cuenta como la más vieja: solo gana si no hay otra.
  const time = (r: Reading) => (r.date ? Date.parse(r.date) || 0 : 0);
  return readings.reduce<Reading | null>(
    (newest, r) => (!newest || time(r) > time(newest) ? r : newest),
    null,
  );
}

/** Las tasas BCV USD + EUR más nuevas, con la fecha valor de la del dólar. */
export async function fetchBcvRates(): Promise<BcvRates | null> {
  const [usd, eur] = await Promise.all([latestRate("dolares"), latestRate("euros")]);
  if (!usd && !eur) return null;
  return {
    usd: usd?.rate ?? null,
    eur: eur?.rate ?? null,
    date: usd?.date ?? eur?.date ?? null,
  };
}

export interface CachedBcvRates {
  usd: number | null;
  eur: number | null;
  /** Fecha valor de la tasa. */
  source_date: string | null;
  /** Cuándo la leyó el cron. */
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
 * Las tiendas nacen con la tasa automática (migración 0023), pero el cron solo
 * pasa a ciertas horas (ver vercel.json). Sin esto, una tienda creada entre una
 * pasada y otra se quedaba sin tasa hasta la siguiente: sin precios en bolívares y con el
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

/** Read the cached BCV rates (refreshed by the cron, see vercel.json). */
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
