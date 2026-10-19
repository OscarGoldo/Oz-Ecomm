import { CouponsManager, type CouponRow } from "@/components/admin/coupons-manager";
import { ProUpsell } from "@/components/admin/pro-lock";
import { requireStoreUser } from "@/lib/auth";
import { couponStatus } from "@/lib/coupon-status";
import { formatUSD } from "@/lib/format";
import { SALES_STATUSES } from "@/lib/metrics";
import { isPro } from "@/lib/plans";
import { resolvePeriod } from "@/lib/report-period";
import { createClient } from "@/lib/supabase/server";
import type { Coupon } from "@/types/database";

export const metadata = { title: "Descuentos" };

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** De a mil filas hasta el final: PostgREST corta en mil sin avisar. */
async function fetchAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await page(rows.length, rows.length + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000 || rows.length >= 50_000) return rows;
  }
}

/**
 * Los cupones de la tienda como tickets, con su estado y lo que vendió cada
 * uno, y arriba lo que dejaron los cupones este mes. Crear y editar se hace
 * en el panel de al lado (o en pantalla completa en el teléfono).
 */
export default async function DescuentosPage() {
  const { store } = await requireStoreUser();
  const pro = isPro(store);

  const header = (
    <header>
      <p className="font-landing-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
        Catálogo · descuentos
      </p>
      <h1 className="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.028em]">Descuentos</h1>
      <p className="mt-1.5 text-[15px] text-ink-600">Códigos que tus clientes escriben al pagar.</p>
    </header>
  );

  if (!pro) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {header}
        <ProUpsell
          title="Los cupones son del plan Pro"
          text="Crea códigos de descuento por porcentaje, monto fijo o envío gratis, con fecha de inicio, vencimiento y límite de usos. Si ya tenías cupones creados, siguen guardados y vuelven a funcionar al activar Pro."
        />
      </div>
    );
  }

  const supabase = createClient();
  const month = resolvePeriod({ periodo: "este-mes" });
  const [{ data: couponRows }, couponOrders, monthOrders] = await Promise.all([
    supabase.from("coupons").select("*").eq("store_id", store.id).order("created_at", { ascending: false }),
    fetchAll((from, to) =>
      supabase
        .from("orders")
        .select("coupon_code, total, discount_total, created_at")
        .eq("store_id", store.id)
        .in("status", SALES_STATUSES)
        .not("coupon_code", "is", null)
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("orders")
        .select("total")
        .eq("store_id", store.id)
        .in("status", SALES_STATUSES)
        .gte("created_at", month.fromISO)
        .lt("created_at", month.toISO)
        .order("id")
        .range(from, to),
    ),
  ]);

  const coupons = (couponRows ?? []) as Coupon[];

  // Lo que vendió cada código, desde siempre.
  const byCode = new Map<string, { sales: number; revenue: number }>();
  for (const o of couponOrders) {
    const code = o.coupon_code as string;
    const s = byCode.get(code) ?? { sales: 0, revenue: 0 };
    s.sales += 1;
    s.revenue += Number(o.total);
    byCode.set(code, s);
  }

  // Este mes: ventas con cupón, lo que dejaron y lo que se descontó.
  const thisMonth = couponOrders.filter((o) => o.created_at >= month.fromISO && o.created_at < month.toISO);
  const monthCouponUsd = thisMonth.reduce((s, o) => s + Number(o.total), 0);
  const monthUsd = monthOrders.reduce((s, o) => s + Number(o.total), 0);
  const monthDiscount = thisMonth.reduce((s, o) => s + Number(o.discount_total ?? 0), 0);

  const now = Date.now();
  const rows: CouponRow[] = coupons.map((c) => ({
    ...c,
    status: couponStatus(c, now),
    sales: byCode.get(c.code)?.sales ?? 0,
    revenueUsd: byCode.get(c.code)?.revenue ?? 0,
  }));
  const activeCount = rows.filter((r) => r.status === "active").length;

  return (
    <div className="space-y-6">
      {header}

      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <Stat label="Cupones activos" value={String(activeCount)} sub={`de ${rows.length} ${rows.length === 1 ? "creado" : "creados"}`} />
        <Stat
          label="Ventas con cupón este mes"
          value={String(thisMonth.length)}
          sub={
            thisMonth.length > 0
              ? `${formatUSD(monthCouponUsd)} vendidos${monthUsd > 0 ? ` · ${Math.round((monthCouponUsd / monthUsd) * 100)}% de tus ventas` : ""}`
              : "ninguna todavía"
          }
        />
        <Stat label="Lo que descontaste" value={formatUSD(monthDiscount)} sub="este mes" />
      </div>

      <CouponsManager initial={rows} storeName={store.name} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <section className="flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-3 sm:p-5">
      <p className="text-[11.5px] font-semibold leading-snug text-ink-600 sm:text-[13px]">{label}</p>
      <p className="font-display text-xl font-extrabold tracking-[-0.02em] tabular-nums sm:text-[1.65rem]">{value}</p>
      <p className="hidden text-[12.5px] text-ink-500 sm:block">{sub}</p>
    </section>
  );
}
