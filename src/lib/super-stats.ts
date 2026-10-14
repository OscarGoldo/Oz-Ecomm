import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { StoreStat } from "@/lib/super-segments";
import type {
  PlanSource,
  StorePlan,
  SubscriptionState,
  SubscriptionStatus,
} from "@/types/database";

/**
 * Los números del super admin. Los calcula Postgres (migración 0030), no Node:
 * ver ese archivo para el porqué. Todo acá se lee con service role, así que
 * quien llame tiene que haber pasado antes por `requireSuperAdmin()`.
 */

/** numeric llega como string o number según el driver. */
function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

export interface SuperOverview {
  stores: number;
  activeStores: number;
  newStores: number;
  newStoresPrev: number;
  paying: number;
  comped: number;
  storesWithProducts: number;
  storesWithSale: number;
  productsTotal: number;
  mrr: number;
  /** Planes cobrados en toda la historia, antes de comisiones. */
  collectedTotal: number;
  feesTotal: number;
  /** Planes cobrados en el período, antes de comisiones. */
  collected: number;
  fees: number;
  collectedPrev: number;
  feesPrev: number;
  pendingSubs: number;
  pendingSubsUsd: number;
  gmvTotal: number;
  salesTotal: number;
  gmv: number;
  gmvPrev: number;
  /** Ventas con tarjeta cobradas por Tiendify y todavía no pagadas. */
  owed: number;
  owedStores: number;
}

/**
 * Totales de la plataforma para los últimos `days` días contra los `days`
 * anteriores. null si la migración 0030 todavía no se corrió.
 */
export async function getSuperOverview(days = 30): Promise<SuperOverview | null> {
  const { data, error } = await createAdminClient().rpc("super_overview", {
    p_days: days,
  });
  if (error || !data) return null;
  const r = data as Record<string, unknown>;

  return {
    stores: num(r.stores),
    activeStores: num(r.active_stores),
    newStores: num(r.new_stores),
    newStoresPrev: num(r.new_stores_prev),
    paying: num(r.paying),
    comped: num(r.comped),
    storesWithProducts: num(r.stores_with_products),
    storesWithSale: num(r.stores_with_sale),
    productsTotal: num(r.products_total),
    mrr: num(r.mrr),
    collectedTotal: num(r.collected_total),
    feesTotal: num(r.fees_total),
    collected: num(r.collected),
    fees: num(r.fees),
    collectedPrev: num(r.collected_prev),
    feesPrev: num(r.fees_prev),
    pendingSubs: num(r.pending_subs),
    pendingSubsUsd: num(r.pending_subs_usd),
    gmvTotal: num(r.gmv_total),
    salesTotal: num(r.sales_total),
    gmv: num(r.gmv),
    gmvPrev: num(r.gmv_prev),
    owed: num(r.owed),
    owedStores: num(r.owed_stores),
  };
}

export interface StoreStatsResult {
  stores: StoreStat[];
  /**
   * false cuando la migración 0030 no está: la lista sale igual, pero sin
   * ventas, GMV, actividad ni origen. Quien la muestre tiene que decirlo.
   */
  complete: boolean;
}

/** Todas las tiendas con sus números, de la más nueva a la más vieja. */
export async function getStoreStats(): Promise<StoreStatsResult> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("super_store_stats");

  if (!error && Array.isArray(data)) {
    const stores = (data as Record<string, unknown>[]).map(
      (r): StoreStat => ({
        id: String(r.id),
        slug: String(r.slug),
        name: String(r.name),
        whatsapp: str(r.whatsapp),
        active: r.active === true,
        subscription_status: (str(r.subscription_status) ??
          "active") as SubscriptionStatus,
        plan: (str(r.plan) ?? "free") as StorePlan,
        plan_source: (str(r.plan_source) ?? "free") as PlanSource,
        plan_expires_at: str(r.plan_expires_at),
        plan_note: str(r.plan_note),
        stripe_subscription_status: str(
          r.stripe_subscription_status,
        ) as SubscriptionState | null,
        paypal_subscription_status: str(
          r.paypal_subscription_status,
        ) as SubscriptionState | null,
        created_at: String(r.created_at),
        owner_name: str(r.owner_name),
        owner_email: str(r.owner_email),
        last_sign_in_at: str(r.last_sign_in_at),
        last_activity_at: str(r.last_activity_at),
        products: num(r.products),
        sales: num(r.sales),
        gmv: num(r.gmv),
        first_sale_at: str(r.first_sale_at),
        last_order_at: str(r.last_order_at),
        paid_total: num(r.paid_total),
        owed: num(r.owed),
        promo_code: str(r.promo_code),
        referred_by: str(r.referred_by),
      }),
    );
    return { stores, complete: true };
  }

  // Sin la migración no hay agregados, pero perder la lista de tiendas por eso
  // sería peor que mostrarla con los números en cero.
  const [{ data: stores }, { data: owners }] = await Promise.all([
    db.from("stores").select("*").order("created_at", { ascending: false }),
    db
      .from("users")
      .select("store_id, full_name, email")
      .eq("role", "store_owner")
      .order("created_at"),
  ]);
  const ownerByStore = new Map<string, { full_name: string; email: string }>();
  for (const o of owners ?? []) {
    if (o.store_id && !ownerByStore.has(o.store_id)) ownerByStore.set(o.store_id, o);
  }

  return {
    complete: false,
    stores: (stores ?? []).map((s) => {
      const owner = ownerByStore.get(s.id);
      return {
        id: s.id,
        slug: s.slug,
        name: s.name,
        whatsapp: s.whatsapp,
        active: s.active,
        subscription_status: s.subscription_status,
        plan: s.plan,
        plan_source: s.plan_source,
        plan_expires_at: s.plan_expires_at,
        plan_note: s.plan_note,
        stripe_subscription_status: s.stripe_subscription_status,
        paypal_subscription_status: s.paypal_subscription_status,
        created_at: s.created_at,
        owner_name: owner?.full_name ?? null,
        owner_email: owner?.email ?? null,
        last_sign_in_at: null,
        last_activity_at: null,
        products: 0,
        sales: 0,
        gmv: 0,
        first_sale_at: null,
        last_order_at: null,
        paid_total: 0,
        owed: 0,
        promo_code: null,
        referred_by: null,
      };
    }),
  };
}
