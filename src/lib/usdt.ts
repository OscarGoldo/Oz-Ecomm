import { unstable_cache } from "next/cache";

/**
 * El precio del USDT en bolívares, para la calculadora de la tasa del panel.
 *
 * Es una referencia para el comerciante y nada más: no calcula ningún precio
 * de la tienda y no sale del panel (ni la tienda pública, ni la portada, ni
 * una tabla que se pueda leer desde afuera). Se presenta como "precio del USDT
 * en Binance P2P" y no como "dólar paralelo" a propósito: en 2025 hubo
 * detenciones por publicar el paralelo, y esto es el precio de un activo en un
 * mercado concreto.
 *
 * Se lee de tres lados a la vez y gana el primero de esta lista que responde:
 *
 * 1. Binance P2P directo: la mediana de los primeros anuncios de compra y la
 *    de los de venta, y el punto medio entre las dos. Es la API que usa la web
 *    de Binance, sin clave ni contrato, así que puede cambiar o cerrarse.
 * 2. CriptoYa: la misma Binance P2P, leída desde sus servidores. Cubre el caso
 *    de que Binance rechace a los de Vercel, que corren en EE. UU.
 * 3. Yadio: su propio promedio P2P en bolívares.
 *
 * Se guarda 15 minutos en la caché de datos de Next en vez de en la base: no
 * queda en ninguna tabla pública y no hace falta otro cron.
 */

export type UsdtSource = "binance" | "criptoya" | "yadio";

export interface UsdtRate {
  /** Bolívares por USDT. */
  rate: number;
  source: UsdtSource;
  /** Cuándo se leyó. */
  at: string;
}

/** Cuánto se espera a cada fuente. */
const TIMEOUT_MS = 4000;
/** Cuántos anuncios de cada lado entran en la mediana. */
const ADS = 10;
/** Lo más que el panel espera el precio cuando la caché está vacía. */
const PANEL_WAIT_MS = 2500;

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function isRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * La mediana de los primeros anuncios de un lado del P2P. Mediana y no
 * promedio: el primer anuncio suele ser uno destacado con un precio que nadie
 * más tiene (hoy, 980 contra 1.006 del resto).
 */
async function binanceSide(tradeType: "BUY" | "SELL"): Promise<number | null> {
  const data = await getJson("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      asset: "USDT",
      fiat: "VES",
      tradeType,
      page: 1,
      rows: ADS,
      payTypes: [],
      publisherType: null,
    }),
  });
  const ads = (data as { data?: { adv?: { price?: unknown } }[] } | null)?.data;
  if (!Array.isArray(ads)) return null;
  const prices = ads.map((ad) => Number(ad?.adv?.price)).filter(isRate);
  // Con menos de tres anuncios la "mediana" es un anuncio suelto.
  return prices.length >= 3 ? median(prices) : null;
}

async function fromBinance(): Promise<number | null> {
  const [buy, sell] = await Promise.all([binanceSide("BUY"), binanceSide("SELL")]);
  return buy && sell ? (buy + sell) / 2 : null;
}

async function fromCriptoYa(): Promise<number | null> {
  const data = await getJson("https://criptoya.com/api/binancep2p/USDT/VES/1");
  const { ask, bid } = (data ?? {}) as { ask?: unknown; bid?: unknown };
  return isRate(ask) && isRate(bid) ? (ask + bid) / 2 : null;
}

async function fromYadio(): Promise<number | null> {
  const data = await getJson("https://api.yadio.io/rate/VES/USD");
  const { rate } = (data ?? {}) as { rate?: unknown };
  return isRate(rate) ? rate : null;
}

async function readUsdtRate(): Promise<UsdtRate> {
  const [binance, criptoya, yadio] = await Promise.all([
    fromBinance(),
    fromCriptoYa(),
    fromYadio(),
  ]);
  const at = new Date().toISOString();
  const round = (n: number) => Math.round(n * 100) / 100;
  if (binance) return { rate: round(binance), source: "binance", at };
  if (criptoya) return { rate: round(criptoya), source: "criptoya", at };
  if (yadio) return { rate: round(yadio), source: "yadio", at };
  // Sin ninguna respuesta se lanza en vez de devolver null: así la caché sigue
  // sirviendo el último precio bueno (con su hora) en vez de guardar un hueco.
  throw new Error("Ninguna fuente respondió el precio del USDT");
}

const cachedUsdtRate = unstable_cache(readUsdtRate, ["usdt-ves"], { revalidate: 900 });

/**
 * El precio del USDT para el panel, o null si no hay. Con la caché caliente es
 * inmediato; con la caché vacía (un deploy nuevo) el panel no espera más de
 * 2,5 s: si no llegó, esa vez se muestra sin USDT.
 */
export async function getUsdtRate(): Promise<UsdtRate | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const giveUp = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), PANEL_WAIT_MS);
  });
  try {
    return await Promise.race([cachedUsdtRate(), giveUp]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
