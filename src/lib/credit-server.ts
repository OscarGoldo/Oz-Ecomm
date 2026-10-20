import "server-only";

import {
  CREDIT_EXCLUDED_SLUGS,
  scoreStore,
  type CreditOrder,
  type CreditScore,
  type CreditStoreInput,
} from "@/lib/credit-score";
import { SALES_STATUSES } from "@/lib/metrics";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreStats } from "@/lib/super-stats";
import type { StoreStat } from "@/lib/super-segments";

/**
 * Los datos de /super/credito. Se leen con service role, así que quien llame
 * tiene que haber pasado antes por `requireSuperAdmin()`.
 *
 * Los pedidos se traen todos y se puntúan en Node. Con el volumen de hoy es lo
 * simple; el día que pese, el cálculo pasa a Postgres como `super_store_stats()`
 * (0030). Se pagina a mano porque PostgREST corta en 1.000 filas sin avisar.
 */

const PAGE = 1_000;
const DAY_MS = 86_400_000;

export interface CreditRow {
  store: StoreStat;
  now: CreditScore;
  /** El mismo puntaje con lo que se sabía hace 30 días. */
  before: CreditScore;
}

export interface CreditOverview {
  rows: CreditRow[];
  /** Tiendas de prueba que no se evalúan, por nombre. */
  excluded: string[];
}

type OrderRow = {
  store_id: string;
  total: number | string;
  status: string;
  payment_method_type: string | null;
  customer_phone: string;
  customer_email: string | null;
  confirmed_at: string | null;
  created_at: string;
};

async function allOrders(): Promise<OrderRow[]> {
  const db = createAdminClient();
  const rows: OrderRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("orders")
      .select(
        "store_id, total, status, payment_method_type, customer_phone, customer_email, confirmed_at, created_at",
      )
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as OrderRow[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function getCreditOverview(): Promise<CreditOverview> {
  const db = createAdminClient();
  // Con las demo, para nombrar las de prueba que no se evalúan.
  const [{ stores }, orders, { data: contacts }] = await Promise.all([
    getStoreStats({ includeDemo: true }),
    allOrders(),
    db.from("stores").select("id, phone"),
  ]);

  const phoneByStore = new Map((contacts ?? []).map((s) => [s.id, s.phone]));
  const ordersByStore = new Map<string, CreditOrder[]>();
  for (const o of orders) {
    const list = ordersByStore.get(o.store_id) ?? [];
    list.push({
      total: Number(o.total) || 0,
      createdAt: Date.parse(o.created_at),
      sale: (SALES_STATUSES as string[]).includes(o.status),
      cancelledAfterPaid: o.status === "cancelled" && o.confirmed_at !== null,
      verified: o.payment_method_type === "stripe" || o.payment_method_type === "paypal",
      customer_phone: o.customer_phone,
      customer_email: o.customer_email,
    });
    ordersByStore.set(o.store_id, list);
  }

  const now = Date.now();
  const excluded: string[] = [];
  const rows: CreditRow[] = [];
  for (const s of stores) {
    // Las páginas ejemplo no tienen pedidos ni se nombran: no son tiendas.
    if (s.example) continue;
    if (s.demo || CREDIT_EXCLUDED_SLUGS.has(s.slug)) {
      excluded.push(s.name);
      continue;
    }
    const input: CreditStoreInput = {
      id: s.id,
      slug: s.slug,
      name: s.name,
      active: s.active,
      createdAt: s.created_at,
      ownerPhones: [s.whatsapp, phoneByStore.get(s.id) ?? null],
      ownerEmail: s.owner_email,
      paidTiendify: s.paid_total,
      orders: ordersByStore.get(s.id) ?? [],
    };
    rows.push({
      store: s,
      now: scoreStore(input, now),
      before: scoreStore(input, now - 30 * DAY_MS),
    });
  }

  rows.sort(
    (a, b) =>
      b.now.score - a.now.score || b.now.metrics.sales6m - a.now.metrics.sales6m,
  );
  return { rows, excluded };
}
