import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CustomerPanel } from "@/components/admin/customers-board";
import { requireStoreUser } from "@/lib/auth";
import { ORDER_STATUS_META } from "@/lib/constants";
import { couponBenefit, couponStatus } from "@/lib/coupon-status";
import { phoneKey } from "@/lib/customer-identity";
import { getCustomerOrders } from "@/lib/customers";
import { getCustomersOverview, getFavoriteProducts } from "@/lib/customers-overview";
import { isPro } from "@/lib/plans";
import { storeUrl } from "@/lib/store-url";
import { createClient } from "@/lib/supabase/server";
import { shortAgo } from "@/lib/time-ago";
import type { Coupon } from "@/types/database";

export const metadata = { title: "Cliente" };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function monthYear(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "numeric" }).formatToParts(new Date(iso));
  return `${MONTHS[Number(parts.find((p) => p.type === "month")?.value) - 1]} ${parts.find((p) => p.type === "year")?.value}`;
}

function longDate(iso: string): string {
  return new Intl.DateTimeFormat("es-VE", { timeZone: "America/Caracas", day: "numeric", month: "short", year: "numeric" })
    .format(new Date(iso))
    .replace(".", "");
}

/** La ficha de un cliente: la misma del costado de la lista, con todos sus pedidos. */
export default async function CustomerDetailPage({ params }: { params: { phone: string } }) {
  const { store } = await requireStoreUser();
  const phone = decodeURIComponent(params.phone);
  const now = Date.now();
  const supabase = createClient();

  const [overview, couponsRes] = await Promise.all([
    getCustomersOverview(store.id, now),
    isPro(store)
      ? supabase.from("coupons").select("*").eq("store_id", store.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Coupon[] }),
  ]);

  // Por el teléfono del listado; si pidió con otro número, por sus pedidos.
  const key = phoneKey(phone);
  let customer = overview.customers.find((c) => (key ? phoneKey(c.phone) === key : c.phone === phone));
  if (!customer) {
    const ids = new Set((await getCustomerOrders(store.id, phone)).map((o) => o.id));
    customer = overview.customers.find((c) => c.orders.some((o) => ids.has(o.id)));
  }
  if (!customer) notFound();

  const favorites = await getFavoriteProducts([customer]).catch(() => new Map());
  const activeCoupon = ((couponsRes.data ?? []) as Coupon[]).find((c) => couponStatus(c, now) === "active");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/panel/clientes" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-foreground">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <CustomerPanel
        customer={{
          phone: customer.phone,
          name: customer.name,
          email: customer.email,
          sales: customer.sales,
          spentUsd: customer.spentUsd,
          segment: customer.segment,
          lastLabel: shortAgo(customer.lastAt, now),
          sinceLabel: customer.isNew
            ? `Primer pedido ${shortAgo(customer.firstAt, now).toLowerCase()}`
            : `Cliente desde ${monthYear(customer.firstAt)}`,
          favorites: favorites.get(customer.phone) ?? [],
          orders: customer.orders.map((o) => ({
            id: o.id,
            number: o.number,
            dateLabel: longDate(o.at),
            statusLabel: ORDER_STATUS_META[o.status]?.label ?? o.status,
            total: o.total,
          })),
          detailHref: `/panel/clientes/${encodeURIComponent(customer.phone)}`,
        }}
        storeName={store.name}
        storeUrl={storeUrl(store)}
        coupon={activeCoupon ? { code: activeCoupon.code, benefit: couponBenefit(activeCoupon.type, activeCoupon.value) } : null}
      />
    </div>
  );
}
