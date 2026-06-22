import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchBcvRates } from "@/lib/bcv";

export const dynamic = "force-dynamic";

/**
 * Daily cron (8:00 AM Venezuela). Fetches the BCV USD/EUR rates, caches them,
 * and updates the exchange_rate of stores that opted into auto-update.
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const rates = await fetchBcvRates();
  if (!rates) {
    return NextResponse.json({ ok: false, error: "fetch failed" }, { status: 502 });
  }

  const db = createAdminClient();
  const now = new Date().toISOString();

  await db.from("bcv_rates").upsert({
    id: "current",
    usd: rates.usd,
    eur: rates.eur,
    source_date: rates.date,
    updated_at: now,
  });

  // Auto-update opted-in stores' exchange_rate (USD or EUR per their currency).
  const { data: stores } = await db
    .from("stores")
    .select("id, currency_primary")
    .eq("auto_exchange_rate", true)
    .eq("active", true);

  let updated = 0;
  await Promise.all(
    (stores ?? []).map((s) => {
      const rate = s.currency_primary === "EUR" ? rates.eur : rates.usd;
      if (rate == null) return Promise.resolve();
      updated += 1;
      return db
        .from("stores")
        .update({ exchange_rate: rate, exchange_rate_updated_at: now })
        .eq("id", s.id);
    }),
  );

  return NextResponse.json({ ok: true, usd: rates.usd, eur: rates.eur, storesUpdated: updated });
}
