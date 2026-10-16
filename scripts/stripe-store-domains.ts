/**
 * Registra en Stripe el subdominio de las tiendas Pro (Apple Pay y Google Pay).
 *
 *   npx tsx --env-file=.env.local scripts/stripe-store-domains.ts          (solo mira)
 *   npx tsx --env-file=.env.local scripts/stripe-store-domains.ts --aplica (registra)
 *
 * Es lo mismo que hace cada hora el cron /api/cron/dominios-pago; sirve para
 * no esperar a la próxima corrida (por ejemplo, justo después de lanzar los
 * subdominios) y para ver qué falta sin tocar nada.
 *
 * Sin `--aplica` no escribe nada.
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import { syncStorePaymentDomains } from "@/lib/stripe-domains";
import type { Database } from "@/types/database";

const apply = process.argv.includes("--aplica");

const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

async function main() {
  if (!key || !url || !serviceRole) {
    console.error(
      "Faltan STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  const stripe = new Stripe(key, { typescript: true });
  const db = createClient<Database>(url, serviceRole, { auth: { persistSession: false } });

  const result = await syncStorePaymentDomains(stripe, db, { apply });

  console.log(`Tiendas Pro con subdominio: ${result.wanted}`);
  console.log(`Faltan en Stripe: ${result.missing.length}`);
  for (const d of result.missing) console.log(`  - ${d}`);
  if (!apply) {
    if (result.missing.length) console.log("\nCorre de nuevo con --aplica para registrarlos.");
    return;
  }
  console.log(`Registrados: ${result.registered.length}`);
  for (const f of result.failed) console.log(`  ✗ ${f.domain}: ${f.error}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
