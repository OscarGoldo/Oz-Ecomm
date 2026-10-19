import {
  CartsBoard,
  type BoardCart,
  type BoardCoupon,
} from "@/components/admin/carts-board";
import { requireStoreUser } from "@/lib/auth";
import { listCatalog } from "@/lib/catalog-stats";
import { abandonedCartCutoff } from "@/lib/constants";
import { couponBenefit, couponStatus } from "@/lib/coupon-status";
import { formatUSD } from "@/lib/format";
import { isPro } from "@/lib/plans";
import { resolvePeriod } from "@/lib/report-period";
import { getImageUrl } from "@/lib/storage";
import { storeUrl } from "@/lib/store-url";
import { createClient } from "@/lib/supabase/server";
import { agoInline, shortAgo } from "@/lib/time-ago";
import type { AbandonedCart, Coupon } from "@/types/database";

export const metadata = { title: "Carritos" };

const DAY = 86_400_000;
/** Hasta cuándo atrás se muestran los recuperados y los archivados. */
const HISTORY_DAYS = 90;
/** "Escribe pronto": cuánto es pronto. */
const FAST_HOURS = 3;

/**
 * Los carritos que quedaron a medias, para escribirles por WhatsApp.
 *
 * Ojo con "recuperado": el carrito se crea apenas alguien llena sus datos en
 * el checkout y se marca recuperado cuando compra, así que casi todas las
 * compras dejan un carrito "recuperado" aunque nunca se hayan abandonado. Aquí
 * solo cuentan los que compraron DESPUÉS de que el comerciante les escribió:
 * esos son ventas que salvó él.
 */
export default async function CarritosPage() {
  const { store } = await requireStoreUser();
  const supabase = createClient();
  const now = Date.now();
  const historyFrom = new Date(now - HISTORY_DAYS * DAY).toISOString();
  const month = resolvePeriod({ periodo: "este-mes" });
  const pro = isPro(store);

  const [{ data: openRows }, { data: recoveredRows }, { data: archivedRows }, { data: monthRows }, couponsRes, catalog] =
    await Promise.all([
      supabase
        .from("abandoned_carts")
        .select("*")
        .eq("store_id", store.id)
        .is("recovered_at", null)
        .is("dismissed_at", null)
        .lt("updated_at", abandonedCartCutoff())
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase
        .from("abandoned_carts")
        .select("*")
        .eq("store_id", store.id)
        .not("recovered_at", "is", null)
        .not("last_contacted_at", "is", null)
        .gte("recovered_at", historyFrom)
        .order("recovered_at", { ascending: false })
        .limit(100),
      supabase
        .from("abandoned_carts")
        .select("*")
        .eq("store_id", store.id)
        .not("dismissed_at", "is", null)
        .gte("dismissed_at", historyFrom)
        .order("dismissed_at", { ascending: false })
        .limit(60),
      // A quiénes se les escribió este mes, para saber cuántos compraron.
      supabase
        .from("abandoned_carts")
        .select("recovered_at")
        .eq("store_id", store.id)
        .gte("last_contacted_at", month.fromISO)
        .limit(2000),
      pro
        ? supabase.from("coupons").select("*").eq("store_id", store.id).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as Coupon[] }),
      listCatalog(store.id).catch(() => []),
    ]);

  const open = (openRows ?? []) as AbandonedCart[];
  const recovered = (recoveredRows ?? []) as AbandonedCart[];
  const archived = (archivedRows ?? []) as AbandonedCart[];

  // Las fotos salen del catálogo por nombre: el carrito guarda el nombre, no el id.
  const coverByName = new Map<string, string>();
  for (const p of catalog) {
    const url = getImageUrl(p.images[0]);
    if (url && !coverByName.has(p.name)) coverByName.set(p.name, url);
  }

  const recoveredOrderIds = recovered.map((c) => c.recovered_order_id).filter((id): id is string => !!id);
  const { data: recoveredOrders } = recoveredOrderIds.length
    ? await supabase.from("orders").select("id, order_number, total").in("id", recoveredOrderIds)
    : { data: [] as { id: string; order_number: number; total: number }[] };
  const orderById = new Map((recoveredOrders ?? []).map((o) => [o.id, o]));

  function toBoard(c: AbandonedCart, state: BoardCart["state"]): BoardCart {
    const items = (c.items ?? []).map((i) => ({
      name: i.name,
      variant: i.variant,
      qty: i.qty,
      price: Number(i.price),
      cover: coverByName.get(i.name) ?? null,
    }));
    // Escribirle toca `updated_at`: después de eso, cuándo lo dejó lo dice `created_at`.
    const leftAt = c.last_contacted_at ? c.created_at : c.updated_at;
    const hours = (now - new Date(leftAt).getTime()) / 3_600_000;
    const order = c.recovered_order_id ? orderById.get(c.recovered_order_id) : undefined;
    let note: string;
    if (state === "pending") note = "Todavía no le escribiste";
    else if (state === "contacted") note = `Le escribiste ${agoInline(c.last_contacted_at!, now)}, todavía no compra`;
    else if (state === "recovered") {
      const after = (new Date(c.recovered_at!).getTime() - new Date(c.last_contacted_at!).getTime()) / 3_600_000;
      const when = after < 1 ? "menos de 1 h" : after < 24 ? `${Math.round(after)} h` : `${Math.round(after / 24)} días`;
      note = `Compró ${when} después de tu mensaje${order ? ` · pedido #${order.order_number}` : ""}`;
    } else note = `Lo archivaste ${agoInline(c.dismissed_at!, now)}`;

    return {
      id: c.id,
      state,
      name: c.customer_name,
      phone: c.customer_phone,
      items,
      subtotal: Number(c.subtotal),
      age: state === "recovered" ? "Compró" : state === "archived" ? "Archivado" : shortAgo(leftAt, now),
      heat: state === "recovered" ? "done" : state === "archived" ? "cold" : hours < 3 ? "hot" : hours < 24 ? "warm" : "cold",
      note,
      orderId: order?.id ?? null,
    };
  }

  const pending = open.filter((c) => !c.last_contacted_at);
  const contacted = open.filter((c) => c.last_contacted_at);
  const carts: BoardCart[] = [
    ...pending.map((c) => toBoard(c, "pending")),
    ...contacted.map((c) => toBoard(c, "contacted")),
    ...recovered.map((c) => toBoard(c, "recovered")),
    ...archived.map((c) => toBoard(c, "archived")),
  ];

  // ── Cifras ──
  const atStakeUsd = open.reduce((s, c) => s + Number(c.subtotal), 0);
  const recoveredMonth = recovered.filter((c) => c.recovered_at! >= month.fromISO);
  const recoveredMonthUsd = recoveredMonth.reduce((s, c) => {
    const o = c.recovered_order_id ? orderById.get(c.recovered_order_id) : undefined;
    return s + Number(o?.total ?? c.subtotal);
  }, 0);
  const contactedMonth = monthRows ?? [];
  const boughtMonth = contactedMonth.filter((r) => r.recovered_at).length;
  const newest = pending[0];

  // ── Lo que más se queda: productos en carritos que no se cerraron (30 días) ──
  const from30 = new Date(now - 30 * DAY).toISOString();
  const stuckCount = new Map<string, number>();
  for (const c of [...open, ...archived]) {
    if (c.created_at < from30) continue;
    for (const name of new Set((c.items ?? []).map((i) => i.name))) {
      stuckCount.set(name, (stuckCount.get(name) ?? 0) + 1);
    }
  }
  const stuck = [...stuckCount.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // ── Escribe pronto ──
  const fast = recovered.filter(
    (c) => new Date(c.last_contacted_at!).getTime() - new Date(c.created_at).getTime() <= FAST_HOURS * 3_600_000,
  ).length;
  const tip =
    recovered.length >= 3 && fast / recovered.length >= 0.5
      ? `${fast} de tus ${recovered.length} carritos recuperados fueron con un mensaje en las primeras ${FAST_HOURS} horas.`
      : "Mientras más fresco el carrito, más fácil es cerrar la venta: escríbeles el mismo día.";

  const coupons: BoardCoupon[] = ((couponsRes.data ?? []) as Coupon[])
    .filter((c) => couponStatus(c, now) === "active")
    .map((c) => ({ code: c.code, benefit: couponBenefit(c.type, c.value) }));

  return (
    <div className="space-y-5">
      <header>
        <p className="font-landing-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          Ventas · carritos
        </p>
        <h1 className="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.028em]">Carritos</h1>
        <p className="mt-1.5 text-[15px] text-ink-600">
          Gente que dejó sus datos y no terminó de comprar. Escríbeles y recupera la venta.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="En juego"
          value={formatUSD(atStakeUsd).replace(/\.00$/, "")}
          sub={open.length === 0 ? "Nada pendiente" : `${open.length} ${open.length === 1 ? "carrito sin cerrar" : "carritos sin cerrar"}`}
        />
        <Stat
          tone="good"
          label={`Recuperados en ${new Intl.DateTimeFormat("es-VE", { month: "long", timeZone: "America/Caracas" }).format(new Date(now))}`}
          value={formatUSD(recoveredMonthUsd).replace(/\.00$/, "")}
          sub={
            recoveredMonth.length === 0
              ? "Todavía ninguno este mes"
              : `${recoveredMonth.length} ${recoveredMonth.length === 1 ? "venta que casi se pierde" : "ventas que casi se pierden"}`
          }
        />
        <Stat
          label="De los que escribiste, compraron"
          value={contactedMonth.length >= 3 ? `${Math.round((boughtMonth / contactedMonth.length) * 100)}%` : "—"}
          sub={
            contactedMonth.length >= 3
              ? `${boughtMonth} de ${contactedMonth.length} este mes`
              : "Escríbeles a algunos para medirlo"
          }
        />
        <Stat
          label="Por escribir"
          value={String(pending.length)}
          sub={newest ? `El más nuevo, ${agoInline(newest.updated_at, now)}` : "Estás al día"}
        />
      </div>

      <CartsBoard
        carts={carts}
        coupons={coupons}
        couponsAvailable={pro}
        storeName={store.name}
        storeUrl={storeUrl(store)}
        stuck={stuck}
        tip={tip}
      />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" }) {
  return (
    <section
      className={
        tone === "good"
          ? "flex min-w-0 flex-col gap-1 rounded-2xl border border-[#BBE7CB] bg-[#F0FBF4] p-3 sm:p-5"
          : "flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-3 sm:p-5"
      }
    >
      <p className={`text-[11.5px] font-semibold leading-snug sm:text-[13px] ${tone === "good" ? "text-[#166534]" : "text-ink-600"}`}>
        {label}
      </p>
      <p className={`font-display text-xl font-extrabold tracking-[-0.02em] tabular-nums sm:text-[1.65rem] ${tone === "good" ? "text-[#14532D]" : ""}`}>
        {value}
      </p>
      <p className={`text-[11.5px] leading-snug sm:text-[12.5px] ${tone === "good" ? "text-[#166534]" : "text-ink-500"}`}>{sub}</p>
    </section>
  );
}
