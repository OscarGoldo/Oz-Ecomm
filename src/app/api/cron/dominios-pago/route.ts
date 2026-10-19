import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/report-error";
import { getStripe } from "@/lib/stripe";
import { syncStorePaymentDomains } from "@/lib/stripe-domains";

export const dynamic = "force-dynamic";

/**
 * Cron cada hora. Registra en Stripe el subdominio de las tiendas que todavía
 * no lo tienen, para que su checkout muestre Apple Pay y Google Pay (ver
 * src/lib/stripe-domains.ts). Una tienda nueva queda lista en menos de una
 * hora; mientras tanto paga con tarjeta igual.
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

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ ok: true, skipped: "stripe not configured" });

  try {
    const result = await syncStorePaymentDomains(stripe, createAdminClient(), { apply: true });
    if (result.failed.length > 0) {
      reportError("cron/dominios-pago", new Error("Stripe rechazó dominios"), {
        failed: result.failed,
      });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    reportError("cron/dominios-pago", error);
    return NextResponse.json({ ok: false, error: "sync failed" }, { status: 500 });
  }
}
