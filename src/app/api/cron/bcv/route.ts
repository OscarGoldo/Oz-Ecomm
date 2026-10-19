import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchBcvRates } from "@/lib/bcv";
import { autoRate, rateSettings, type RateInputs } from "@/lib/exchange-rate";
import { reportError } from "@/lib/report-error";
import { fetchUsdtRate } from "@/lib/usdt";
import type { Store } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * Cada hora (vercel.json). Lee las tasas del BCV (dólar y euro) y el precio
 * del USDT, guarda las del BCV y le pone a cada tienda con tasa automática la
 * que eligió: dólar BCV, euro BCV o USDT, con su ajuste en % (ver
 * lib/exchange-rate.ts).
 *
 * Antes corría 8 veces al día porque solo seguía al BCV, que publica en la
 * tarde la tasa del día hábil siguiente. El USDT se mueve todo el día, así que
 * ahora corre cada hora; las tiendas con BCV reciben el mismo número hasta que
 * el BCV publique otro.
 *
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */

/**
 * Lo que se acepta como precio del USDT, contra el dólar BCV. Por debajo del
 * oficial o más del triple es una lectura rota (una API que cambió, un anuncio
 * absurdo), no el mercado: esa hora las tiendas con USDT se quedan con la
 * última tasa buena y se avisa.
 */
const USDT_MIN_VS_BCV = 0.9;
const USDT_MAX_VS_BCV = 3;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const [rates, usdtRead] = await Promise.all([fetchBcvRates(), fetchUsdtRate()]);
  if (!rates && !usdtRead) {
    return NextResponse.json({ ok: false, error: "fetch failed" }, { status: 502 });
  }

  const db = createAdminClient();
  const now = new Date().toISOString();

  if (rates) {
    await db.from("bcv_rates").upsert({
      id: "current",
      usd: rates.usd,
      eur: rates.eur,
      source_date: rates.date,
      updated_at: now,
    });
  }

  // El USDT se compara con el dólar BCV, aunque esta hora el BCV no haya
  // respondido (se usa el guardado).
  let usdt = usdtRead?.rate ?? null;
  if (usdt != null) {
    let bcvUsd = rates?.usd ?? null;
    if (bcvUsd == null) {
      const { data } = await db.from("bcv_rates").select("usd").eq("id", "current").maybeSingle();
      bcvUsd = data?.usd != null ? Number(data.usd) : null;
    }
    if (bcvUsd && (usdt < bcvUsd * USDT_MIN_VS_BCV || usdt > bcvUsd * USDT_MAX_VS_BCV)) {
      reportError("cron/bcv:usdt", new Error("Precio del USDT fuera de rango"), {
        usdt,
        bcvUsd,
        source: usdtRead?.source,
      });
      usdt = null;
    }
  }

  // Sin dato esta hora, la tienda se queda como está: ni el número ni la
  // fecha se tocan, para que "actualizada" siga diciendo la verdad.
  const inputs: RateInputs = {
    usd: rates?.usd ?? null,
    eur: rates?.eur ?? null,
    usdt,
  };

  // `*` y no columnas sueltas: si la migración 0036 todavía no corrió, pedir
  // `exchange_rate_source` haría fallar toda la consulta.
  const { data: stores } = await db
    .from("stores")
    .select("*")
    .eq("auto_exchange_rate", true)
    .eq("active", true);

  let updated = 0;
  await Promise.all(
    ((stores ?? []) as Store[]).map((s) => {
      const rate = autoRate(rateSettings(s), inputs);
      if (rate == null) return Promise.resolve();
      updated += 1;
      return db
        .from("stores")
        .update({ exchange_rate: rate, exchange_rate_updated_at: now })
        .eq("id", s.id);
    }),
  );

  return NextResponse.json({
    ok: true,
    usd: rates?.usd ?? null,
    eur: rates?.eur ?? null,
    usdt,
    storesUpdated: updated,
  });
}
