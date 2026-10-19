import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

import { hasStoreSubdomain, platformHost } from "@/lib/store-url";
import type { Database } from "@/types/database";

/**
 * Registra en Stripe el subdominio de cada tienda.
 *
 * Stripe solo muestra Apple Pay y Google Pay en un dominio registrado como
 * "payment method domain", y no acepta comodines: usatiendify.com ya está, pero
 * mitienda.usatiendify.com es otro dominio y hay que registrarlo aparte. Sin
 * esto el formulario de tarjeta funciona igual; solo faltan esos dos botones.
 *
 * Stripe es la fuente de verdad de qué está registrado (no hay columna en la
 * base): se lista lo que tiene, se compara con las tiendas activas y se
 * registra lo que falta. Así se corrige solo cuando se crea una tienda o le
 * cambian el slug. Lo corre el cron /api/cron/dominios-pago y, a mano,
 * scripts/stripe-store-domains.ts.
 *
 * Cuando una tienda se desactiva su dominio queda registrado: no estorba, y si
 * vuelve ya está listo.
 */

/** Tope por corrida, para no chocar con el límite de peticiones de Stripe. */
const MAX_PER_RUN = 50;

export interface PaymentDomainSync {
  /** Subdominios de tiendas que deberían estar registrados. */
  wanted: number;
  /** Los que faltaban en Stripe al empezar. */
  missing: string[];
  registered: string[];
  failed: { domain: string; error: string }[];
}

export async function syncStorePaymentDomains(
  stripe: Stripe,
  db: SupabaseClient<Database>,
  { apply }: { apply: boolean },
): Promise<PaymentDomainSync> {
  const result: PaymentDomainSync = { wanted: 0, missing: [], registered: [], failed: [] };

  // En local el host es localhost:3000: Stripe no registra eso.
  const host = platformHost();
  if (host.includes(":") || host.endsWith("localhost")) return result;

  const { data: stores, error } = await db
    .from("stores")
    .select("slug")
    .eq("active", true);
  if (error) throw error;

  const wanted = (stores ?? [])
    .filter(hasStoreSubdomain)
    .map((s) => `${s.slug}.${host}`);
  result.wanted = wanted.length;

  const existing = new Set<string>();
  for await (const d of stripe.paymentMethodDomains.list({ limit: 100 })) {
    existing.add(d.domain_name.toLowerCase());
  }
  result.missing = wanted.filter((d) => !existing.has(d));

  if (!apply) return result;

  for (const domain of result.missing.slice(0, MAX_PER_RUN)) {
    try {
      await stripe.paymentMethodDomains.create({ domain_name: domain, enabled: true });
      result.registered.push(domain);
    } catch (e) {
      result.failed.push({ domain, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}
