import { createClient } from "@/lib/supabase/server";

// Venezuela rates via dolarapi (clean JSON, no scraping needed).
const USD_URL = "https://ve.dolarapi.com/v1/dolares/oficial";
const EUR_URL = "https://ve.dolarapi.com/v1/euros/oficial";
const PARALELO_URL = "https://ve.dolarapi.com/v1/dolares/paralelo";

export interface BcvRates {
  usd: number | null;
  eur: number | null;
  paralelo: number | null;
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

/** Fetch the current BCV USD/EUR + parallel rates from the source. */
export async function fetchBcvRates(): Promise<BcvRates | null> {
  const [u, e, p] = await Promise.all([
    fetchOne(USD_URL),
    fetchOne(EUR_URL),
    fetchOne(PARALELO_URL),
  ]);
  const usd = typeof u?.promedio === "number" ? u.promedio : null;
  const eur = typeof e?.promedio === "number" ? e.promedio : null;
  const paralelo = typeof p?.promedio === "number" ? p.promedio : null;
  if (usd == null && eur == null && paralelo == null) return null;
  return {
    usd,
    eur,
    paralelo,
    date: u?.fechaActualizacion ?? e?.fechaActualizacion ?? p?.fechaActualizacion ?? null,
  };
}

export interface CachedBcvRates {
  usd: number | null;
  eur: number | null;
  paralelo: number | null;
  source_date: string | null;
  updated_at: string;
}

/** Read the cached market rates (refreshed daily by the cron). */
export async function getCachedBcvRates(): Promise<CachedBcvRates | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("bcv_rates")
    .select("usd, eur, paralelo, source_date, updated_at")
    .eq("id", "current")
    .maybeSingle();
  if (!data) return null;
  return {
    usd: data.usd != null ? Number(data.usd) : null,
    eur: data.eur != null ? Number(data.eur) : null,
    paralelo: data.paralelo != null ? Number(data.paralelo) : null,
    source_date: data.source_date,
    updated_at: data.updated_at,
  };
}
