import "server-only";

import { groupByCustomer } from "@/lib/customer-identity";
import type { CustomerSegment } from "@/lib/customer-segments";
import { SALES_STATUSES } from "@/lib/metrics";
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderStatus } from "@/types/database";

/**
 * Los clientes de la tienda con lo que hace falta para tratarlos distinto:
 * quién vuelve, quién es nuevo, quién dejó de venir y quién deja más plata.
 *
 * Igual que `customers.ts`, salen de los pedidos agrupados por persona (mismo
 * teléfono o email). La diferencia: los pedidos se leen de a mil hasta el
 * final (antes una sola consulta cortaba en mil sin avisar) y lo vendido
 * cuenta solo ventas confirmadas, como en Finanzas.
 */

/** Primer pedido hace menos de esto: cliente nuevo. */
export const NEW_DAYS = 30;
/** Sin comprar hace más de esto: para reactivar. */
export const SLEEP_DAYS = 60;

const DAY = 86_400_000;
const MAX_ROWS = 50_000;

type OrderRow = Pick<
  Order,
  "id" | "order_number" | "customer_name" | "customer_phone" | "customer_email" | "total" | "status" | "created_at"
>;

export interface CustomerRow {
  /** El teléfono del pedido más reciente: con él se abre la ficha. */
  phone: string;
  name: string;
  email: string | null;
  /** Pedidos confirmados (ventas). */
  sales: number;
  spentUsd: number;
  /** Pedidos que todavía no son venta (por confirmar). */
  pending: number;
  firstAt: string;
  lastAt: string;
  lastSaleAt: string | null;
  isTop: boolean;
  isFreq: boolean;
  isNew: boolean;
  isSleep: boolean;
  /** La etiqueta que se muestra: la más útil de las que tiene. */
  segment: CustomerSegment;
  /** Del más nuevo al más viejo. */
  orders: { id: string; number: number; at: string; status: OrderStatus; total: number }[];
}

export interface CustomersOverview {
  customers: CustomerRow[];
  buyers: number;
  repeatBuyers: number;
  newCount: number;
  totalSpentUsd: number;
  salesCount: number;
  /** Lo que dejaron los 10 que más compran, sobre el total. null con pocos clientes. */
  top10SharePct: number | null;
  sleepers: { count: number; spentUsd: number };
}

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function fetchAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await page(rows.length, rows.length + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000 || rows.length >= MAX_ROWS) return rows;
  }
}

export async function getCustomersOverview(storeId: string, now = Date.now()): Promise<CustomersOverview> {
  const supabase = createClient();
  const orders = await fetchAll<OrderRow>((from, to) =>
    supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, customer_email, total, status, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );

  const newFrom = new Date(now - NEW_DAYS * DAY).toISOString();
  const sleepBefore = new Date(now - SLEEP_DAYS * DAY).toISOString();

  const customers: CustomerRow[] = groupByCustomer(orders).map((group) => {
    const sorted = [...group].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const last = sorted[0]!;
    const sales = sorted.filter((o) => SALES_STATUSES.includes(o.status));
    const spentUsd = sales.reduce((s, o) => s + Number(o.total), 0);
    const firstAt = sorted[sorted.length - 1]!.created_at;
    const lastSaleAt = sales[0]?.created_at ?? null;
    return {
      phone: last.customer_phone,
      name: last.customer_name,
      email: sorted.find((o) => o.customer_email)?.customer_email ?? null,
      sales: sales.length,
      spentUsd,
      pending: sorted.length - sales.length,
      firstAt,
      lastAt: last.created_at,
      lastSaleAt,
      isTop: false,
      isFreq: sales.length >= 2,
      isNew: firstAt >= newFrom,
      isSleep: lastSaleAt !== null && lastSaleAt < sleepBefore,
      segment: "none",
      orders: sorted.map((o) => ({
        id: o.id,
        number: o.order_number,
        at: o.created_at,
        status: o.status,
        total: Number(o.total),
      })),
    };
  });

  // Los mejores: el 10% que más gastó, con al menos 5 clientes que compraron
  // (con dos clientes, "tus mejores" no dice nada).
  const buyersList = customers.filter((c) => c.sales > 0).sort((a, b) => b.spentUsd - a.spentUsd);
  if (buyersList.length >= 5) {
    for (const c of buyersList.slice(0, Math.max(1, Math.ceil(buyersList.length * 0.1)))) c.isTop = true;
  }
  for (const c of customers) {
    c.segment = c.isTop
      ? "top"
      : c.isSleep
        ? "sleep"
        : c.isNew && c.sales <= 1
          ? "new"
          : c.isFreq
            ? "freq"
            : c.sales === 1
              ? "one"
              : "none";
  }

  const totalSpentUsd = buyersList.reduce((s, c) => s + c.spentUsd, 0);
  const sleepers = customers.filter((c) => c.isSleep);
  return {
    customers: customers.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)),
    buyers: buyersList.length,
    repeatBuyers: customers.filter((c) => c.isFreq).length,
    newCount: customers.filter((c) => c.isNew).length,
    totalSpentUsd,
    salesCount: customers.reduce((s, c) => s + c.sales, 0),
    top10SharePct:
      buyersList.length >= 15 && totalSpentUsd > 0
        ? (buyersList.slice(0, 10).reduce((s, c) => s + c.spentUsd, 0) / totalSpentUsd) * 100
        : null,
    sleepers: { count: sleepers.length, spentUsd: sleepers.reduce((s, c) => s + c.spentUsd, 0) },
  };
}

/**
 * Lo que más compra cada cliente (hasta 3 productos, por unidades), solo
 * para los que se muestran: leer los ítems de toda la historia no hace falta.
 */
export async function getFavoriteProducts(
  customers: Pick<CustomerRow, "phone" | "orders">[],
): Promise<Map<string, { name: string; qty: number }[]>> {
  const owner = new Map<string, string>();
  for (const c of customers) {
    for (const o of c.orders) if (SALES_STATUSES.includes(o.status)) owner.set(o.id, c.phone);
  }
  const ids = [...owner.keys()];
  const result = new Map<string, { name: string; qty: number }[]>();
  if (ids.length === 0) return result;

  const supabase = createClient();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
  const items: { order_id: string; product_name: string; quantity: number }[] = [];
  for (let i = 0; i < chunks.length; i += 5) {
    const batch = await Promise.all(
      chunks.slice(i, i + 5).map((chunk) =>
        fetchAll<{ order_id: string; product_name: string; quantity: number }>((from, to) =>
          supabase
            .from("order_items")
            .select("order_id, product_name, quantity")
            .in("order_id", chunk)
            .order("id")
            .range(from, to),
        ).catch(() => []),
      ),
    );
    for (const rows of batch) items.push(...rows);
  }

  const tally = new Map<string, Map<string, number>>();
  for (const it of items) {
    const phone = owner.get(it.order_id);
    if (!phone) continue;
    const t = tally.get(phone) ?? new Map<string, number>();
    t.set(it.product_name, (t.get(it.product_name) ?? 0) + Number(it.quantity));
    tally.set(phone, t);
  }
  for (const [phone, t] of tally) {
    result.set(
      phone,
      [...t.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, qty]) => ({ name, qty })),
    );
  }
  return result;
}
