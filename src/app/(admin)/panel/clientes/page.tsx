import Link from "next/link";
import { Download, RotateCcw, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CustomersBoard,
  type ClientRow,
  type SegmentTab,
} from "@/components/admin/customers-board";
import { requireStoreUser } from "@/lib/auth";
import { ORDER_STATUS_META } from "@/lib/constants";
import { couponBenefit, couponStatus } from "@/lib/coupon-status";
import {
  NEW_DAYS,
  SLEEP_DAYS,
  getCustomersOverview,
  getFavoriteProducts,
  type CustomerRow,
} from "@/lib/customers-overview";
import { formatUSD } from "@/lib/format";
import { isPro } from "@/lib/plans";
import { storeUrl } from "@/lib/store-url";
import { createClient } from "@/lib/supabase/server";
import { shortAgo } from "@/lib/time-ago";
import type { Coupon } from "@/types/database";

export const metadata = { title: "Clientes" };

const PAGE_SIZE = 50;

const SEGMENTS = [
  { id: "todos", label: "Todos", dot: "#0B1B2B", match: () => true },
  { id: "frecuentes", label: "Frecuentes", dot: "#0284C7", match: (c: CustomerRow) => c.isFreq },
  { id: "mejores", label: "Tus mejores", dot: "#E0B400", match: (c: CustomerRow) => c.isTop },
  { id: "nuevos", label: "Nuevos", dot: "#1baf7a", match: (c: CustomerRow) => c.isNew },
  { id: "reactivar", label: "Para reactivar", dot: "#eb6834", match: (c: CustomerRow) => c.isSleep },
] as const;

type SegmentId = (typeof SEGMENTS)[number]["id"];

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "marzo 2026", en hora de Caracas. */
function monthYear(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "numeric" }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")?.value;
  const m = Number(parts.find((p) => p.type === "month")?.value);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "14 oct", en hora de Caracas. */
function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("es-VE", { timeZone: "America/Caracas", day: "numeric", month: "short" })
    .format(new Date(iso))
    .replace(".", "");
}

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Los clientes por tipo (frecuentes, los mejores, nuevos, los que dejaron de
 * venir), con su ficha al lado y mensajes listos para escribirles.
 */
export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { seg?: string; q?: string; ver?: string };
}) {
  const { store } = await requireStoreUser();
  const now = Date.now();
  const pro = isPro(store);
  const supabase = createClient();

  const [overview, couponsRes] = await Promise.all([
    getCustomersOverview(store.id, now),
    pro
      ? supabase.from("coupons").select("*").eq("store_id", store.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Coupon[] }),
  ]);
  const { customers } = overview;

  const seg: SegmentId = SEGMENTS.some((s) => s.id === searchParams.seg) ? (searchParams.seg as SegmentId) : "todos";
  const q = searchParams.q?.trim() ?? "";
  const needle = fold(q);
  const digits = q.replace(/\D/g, "");
  const searched = customers.filter(
    (c) =>
      !needle ||
      fold(c.name).includes(needle) ||
      (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)) ||
      (c.email ?? "").toLowerCase().includes(needle),
  );
  const segment = SEGMENTS.find((s) => s.id === seg)!;
  let list = searched.filter(segment.match);
  // Los mejores y los que hay que reactivar, por lo que gastaron: primero los que más importan.
  if (seg === "mejores" || seg === "reactivar") list = [...list].sort((a, b) => b.spentUsd - a.spentUsd);

  const shown = Math.min(2000, Math.max(PAGE_SIZE, Number(searchParams.ver) || PAGE_SIZE));
  const page = list.slice(0, shown);
  const favorites = await getFavoriteProducts(page).catch(() => new Map());

  const rows: ClientRow[] = page.map((c) => ({
    phone: c.phone,
    name: c.name,
    email: c.email,
    sales: c.sales,
    spentUsd: c.spentUsd,
    segment: c.segment,
    lastLabel: shortAgo(c.lastAt, now),
    sinceLabel: c.isNew ? `Primer pedido ${shortAgo(c.firstAt, now).toLowerCase()}` : `Cliente desde ${monthYear(c.firstAt)}`,
    favorites: favorites.get(c.phone) ?? [],
    orders: c.orders.slice(0, 10).map((o) => ({
      id: o.id,
      number: o.number,
      dateLabel: shortDate(o.at),
      statusLabel: ORDER_STATUS_META[o.status]?.label ?? o.status,
      total: o.total,
    })),
    detailHref: `/panel/clientes/${encodeURIComponent(c.phone)}`,
  }));

  const href = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams();
    const merged = { seg: seg === "todos" ? null : seg, q: q || null, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/panel/clientes?${s}` : "/panel/clientes";
  };
  const segments: SegmentTab[] = SEGMENTS.filter(
    (s) => s.id === "todos" || s.id === seg || searched.some(s.match),
  ).map((s) => ({
    id: s.id,
    label: s.label,
    count: searched.filter(s.match).length,
    href: href({ seg: s.id === "todos" ? null : s.id }),
    active: s.id === seg,
    dot: s.dot,
  }));

  const activeCoupon = ((couponsRes.data ?? []) as Coupon[]).find((c) => couponStatus(c, now) === "active");
  const coupon = activeCoupon ? { code: activeCoupon.code, benefit: couponBenefit(activeCoupon.type, activeCoupon.value) } : null;

  const footer =
    list.length === 0
      ? ""
      : list.length > page.length
        ? `Mostrando ${page.length} de ${list.length}.`
        : seg === "todos" && !q
          ? `${list.length} ${list.length === 1 ? "cliente" : "clientes"}, del que compró más reciente al más antiguo.`
          : `${list.length} ${list.length === 1 ? "cliente" : "clientes"}.`;

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <header>
        <p className="font-landing-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          Ventas · clientes
        </p>
        <h1 className="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.028em]">Clientes</h1>
        <p className="mt-1.5 text-[15px] text-ink-600">Quién te compra, cada cuánto y quién dejó de venir.</p>
      </header>
      {customers.length > 0 && (
        <Button asChild variant="outline" className="h-10">
          <a href="/panel/clientes/csv" download>
            <Download /> Descargar lista
          </a>
        </Button>
      )}
    </div>
  );

  if (customers.length === 0) {
    return (
      <div className="space-y-5">
        {header}
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-12 text-center">
          <Users className="mb-3 size-9 text-ink-400" />
          <p className="font-medium">Todavía no hay clientes</p>
          <p className="mt-1 text-sm text-ink-500">Cuando entren pedidos, tus clientes aparecen aquí.</p>
        </div>
      </div>
    );
  }

  const { buyers, repeatBuyers, newCount, totalSpentUsd, salesCount, top10SharePct, sleepers } = overview;

  return (
    <div className="space-y-5">
      {header}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="Clientes"
          value={String(customers.length)}
          sub={newCount > 0 ? `${newCount} ${newCount === 1 ? "nuevo" : "nuevos"} en los últimos ${NEW_DAYS} días` : `Ninguno nuevo en ${NEW_DAYS} días`}
        />
        <Stat
          label="Vuelven a comprar"
          value={buyers > 0 ? `${Math.round((repeatBuyers / buyers) * 100)}%` : "—"}
          sub={buyers > 0 ? `${repeatBuyers} de ${buyers} hicieron más de un pedido` : "Todavía sin ventas confirmadas"}
        />
        <Stat
          label="Gasto por cliente"
          value={buyers > 0 ? formatUSD(totalSpentUsd / buyers).replace(/\.00$/, "") : "—"}
          sub="en promedio, desde su primer pedido"
        />
        {top10SharePct != null ? (
          <Stat label="Tus 10 mejores" value={`${Math.round(top10SharePct)}%`} sub="de todo lo que vendiste" />
        ) : (
          <Stat
            label="Ticket promedio"
            value={salesCount > 0 ? formatUSD(totalSpentUsd / salesCount).replace(/\.00$/, "") : "—"}
            sub="por pedido confirmado"
          />
        )}
      </div>

      {sleepers.count >= 3 && seg !== "reactivar" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-noche px-4 py-3.5 text-[#D7E1EB]">
          <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-[#eb6834]/20 text-[#F59A6F]" aria-hidden="true">
            <RotateCcw className="size-4" />
          </span>
          <p className="min-w-0 flex-[1_1_320px] text-sm leading-normal">
            <b className="text-white">
              {sleepers.count} clientes no compran hace más de {SLEEP_DAYS} días.
            </b>{" "}
            Entre todos gastaron {formatUSD(sleepers.spentUsd).replace(/\.00$/, "")} contigo.{" "}
            {coupon ? "Un mensaje con un cupón suele traer de vuelta a varios." : "Un mensaje a tiempo suele traer de vuelta a varios."}
          </p>
          <Link
            href={href({ seg: "reactivar", ver: null })}
            className="inline-flex h-[38px] shrink-0 items-center rounded-[10px] bg-sol px-3.5 text-[13.5px] font-bold text-noche transition-opacity hover:opacity-90"
          >
            Ver quiénes son
          </Link>
        </div>
      )}

      <CustomersBoard
        segments={segments}
        rows={rows}
        footer={footer}
        storeName={store.name}
        storeUrl={storeUrl(store)}
        coupon={coupon}
      />

      {list.length > page.length && (
        <div className="flex justify-center">
          <Link
            href={href({ ver: String(shown + PAGE_SIZE) })}
            prefetch={false}
            scroll={false}
            className="inline-flex h-11 items-center rounded-lg border bg-card px-5 text-sm font-medium hover:bg-muted"
          >
            Ver más clientes
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <section className="flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-3 sm:p-5">
      <p className="text-[11.5px] font-semibold leading-snug text-ink-600 sm:text-[13px]">{label}</p>
      <p className="font-display text-xl font-extrabold tracking-[-0.02em] tabular-nums sm:text-[1.65rem]">{value}</p>
      <p className="text-[11.5px] leading-snug text-ink-500 sm:text-[12.5px]">{sub}</p>
    </section>
  );
}
