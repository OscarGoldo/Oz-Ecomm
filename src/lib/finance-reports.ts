import { createClient } from "@/lib/supabase/server";
import { SALES_STATUSES } from "@/lib/metrics";
import type { ReportPeriod } from "@/lib/report-period";
import type { Expense, Order, OrderItem } from "@/types/database";

/**
 * Las filas de los reportes de Finanzas (ventas, productos, gastos). Las usan
 * la tabla en pantalla y la descarga en CSV: los dos leen de acá para que el
 * archivo nunca diga otra cosa que la página.
 *
 * Los totales del período no se calculan acá sino en Postgres
 * (`finance_range`, vía `getPeriodReport`). Lo de este archivo es el detalle.
 */

export const REPORT_TYPES = [
  { id: "resumen", label: "Resumen" },
  { id: "ventas", label: "Ventas" },
  { id: "productos", label: "Productos" },
  { id: "gastos", label: "Gastos" },
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]["id"];

export function resolveReportType(v: string | undefined): ReportType {
  return REPORT_TYPES.find((t) => t.id === v)?.id ?? "resumen";
}

/** El tope de filas que PostgREST devuelve por pedido, sin avisar. */
const PAGE = 1000;

/**
 * Freno para una descarga. Ninguna tienda llega cerca, pero un rango de diez
 * años no puede dejar al servidor leyendo para siempre.
 */
export const MAX_EXPORT_ROWS = 100_000;

/** Pedidos por consulta al buscar sus ítems: ~7 KB de URL, lejos del límite. */
const ID_CHUNK = 200;

type Period = Pick<ReportPeriod, "from" | "to" | "fromISO" | "toISO">;
type Supabase = ReturnType<typeof createClient>;

/**
 * Trae filas de a mil hasta `max`. Pide una de más para que la pantalla sepa
 * si hay "Ver más" sin un COUNT aparte.
 *
 * Un error corta todo: un reporte que se queda con la mitad de las filas y no
 * lo dice es peor que uno que no carga.
 */
async function fetchRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  max: number,
): Promise<{ rows: T[]; hasMore: boolean }> {
  const rows: T[] = [];
  while (rows.length <= max) {
    const from = rows.length;
    const to = Math.min(from + PAGE - 1, max);
    const { data, error } = await page(from, to);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < to - from + 1) break;
  }
  return { rows: rows.slice(0, max), hasMore: rows.length > max };
}

// ── Ventas ──────────────────────────────────────────────────────────────────

export type SaleRow = Pick<
  Order,
  | "id"
  | "order_number"
  | "created_at"
  | "status"
  | "customer_name"
  | "customer_phone"
  | "customer_email"
  | "fulfillment_type"
  | "payment_method_type"
  | "payment_reference"
  | "coupon_code"
  | "subtotal"
  | "discount_total"
  | "shipping_cost"
  | "total"
  | "exchange_rate"
  | "total_bs"
  | "payment_fee"
  | "payment_net"
>;

/**
 * Las ventas del período: los mismos estados que cuentan como ingreso en
 * Finanzas. Los pedidos por confirmar y los cancelados no son ventas.
 */
export async function listSales(
  storeId: string,
  period: Period,
  { max = MAX_EXPORT_ROWS, newestFirst = true } = {},
): Promise<{ rows: SaleRow[]; hasMore: boolean }> {
  const supabase = createClient();
  return fetchRows<SaleRow>(
    (from, to) =>
      supabase
        .from("orders")
        .select(
          "id, order_number, created_at, status, customer_name, customer_phone, customer_email, fulfillment_type, payment_method_type, payment_reference, coupon_code, subtotal, discount_total, shipping_cost, total, exchange_rate, total_bs, payment_fee, payment_net",
        )
        .eq("store_id", storeId)
        .in("status", SALES_STATUSES)
        .gte("created_at", period.fromISO)
        .lt("created_at", period.toISO)
        .order("created_at", { ascending: !newestFirst })
        .order("id")
        .range(from, to),
    max,
  );
}

// ── Productos ───────────────────────────────────────────────────────────────

export interface ProductReportRow {
  /** null para lo vendido de un producto que ya se borró. */
  productId: string | null;
  name: string;
  qty: number;
  revenueUsd: number;
  costUsd: number;
  profitUsd: number;
  /** null cuando no hubo ingreso: no hay margen que calcular. */
  marginPct: number | null;
  /** Alguna unidad se vendió sin costo cargado: su ganancia está inflada. */
  missingCost: boolean;
}

export interface ProductReport {
  rows: ProductReportRow[];
  totals: { qty: number; revenueUsd: number; costUsd: number; profitUsd: number };
  /** Cuántos productos tienen ventas sin costo cargado. */
  missingCost: number;
}

type ItemRow = Pick<
  OrderItem,
  "order_id" | "product_id" | "product_name" | "quantity" | "subtotal" | "unit_cost"
>;

async function itemsForOrders(supabase: Supabase, orderIds: string[]) {
  return (
    await fetchRows<ItemRow>(
      (from, to) =>
        supabase
          .from("order_items")
          .select("order_id, product_id, product_name, quantity, subtotal, unit_cost")
          .in("order_id", orderIds)
          .order("id")
          .range(from, to),
      MAX_EXPORT_ROWS,
    )
  ).rows;
}

/**
 * Qué se vendió, producto por producto, y cuánto dejó.
 *
 * El descuento de un pedido (cupón, código promocional) se reparte entre sus
 * productos según lo que pesa cada uno en el subtotal. Sin eso, un producto
 * vendido con 70% de descuento figuraba con su precio de lista y una ganancia
 * que nunca entró. El envío no es de ningún producto y queda fuera, así que
 * la suma da los ingresos del resumen menos el envío.
 *
 * Se agrupa por producto y no por nombre: si le cambiaste el nombre a mitad
 * de mes, sigue siendo una sola fila (con el nombre más reciente). Lo que se
 * vendió de un producto ya borrado se agrupa por el nombre que tenía.
 */
export async function getProductReport(
  storeId: string,
  period: Period,
): Promise<ProductReport> {
  const supabase = createClient();

  const { rows: orders } = await fetchRows<
    Pick<Order, "id" | "subtotal" | "discount_total">
  >(
    (from, to) =>
      supabase
        .from("orders")
        .select("id, subtotal, discount_total")
        .eq("store_id", storeId)
        .in("status", SALES_STATUSES)
        .gte("created_at", period.fromISO)
        .lt("created_at", period.toISO)
        // Del más nuevo al más viejo: la posición es la "edad" del pedido,
        // y con ella se elige el nombre más reciente de cada producto.
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    MAX_EXPORT_ROWS,
  );

  const recency = new Map(orders.map((o, i) => [o.id, i]));
  // Qué parte de cada peso de lista se cobró de verdad en ese pedido.
  const paidShare = new Map(
    orders.map((o) => {
      const subtotal = Number(o.subtotal);
      const share =
        subtotal > 0 ? (subtotal - Number(o.discount_total)) / subtotal : 1;
      return [o.id, Math.min(1, Math.max(0, share))];
    }),
  );
  const chunks: string[][] = [];
  for (let i = 0; i < orders.length; i += ID_CHUNK) {
    chunks.push(orders.slice(i, i + ID_CHUNK).map((o) => o.id));
  }
  // De a cinco consultas a la vez: rápido sin ahogar la conexión.
  const items: ItemRow[] = [];
  for (let i = 0; i < chunks.length; i += 5) {
    const batch = await Promise.all(
      chunks.slice(i, i + 5).map((ids) => itemsForOrders(supabase, ids)),
    );
    for (const rows of batch) items.push(...rows);
  }

  const byProduct = new Map<string, ProductReportRow>();
  const nameRank = new Map<string, number>();
  for (const it of items) {
    const key = it.product_id ?? `nombre:${it.product_name}`;
    const qty = Number(it.quantity);
    const revenue = Number(it.subtotal) * (paidShare.get(it.order_id) ?? 1);
    const cost = Number(it.unit_cost) * qty;
    const rank = recency.get(it.order_id) ?? Infinity;
    const row =
      byProduct.get(key) ??
      {
        productId: it.product_id,
        name: it.product_name,
        qty: 0,
        revenueUsd: 0,
        costUsd: 0,
        profitUsd: 0,
        marginPct: null,
        missingCost: false,
      };
    if (rank < (nameRank.get(key) ?? Infinity)) {
      row.name = it.product_name;
      nameRank.set(key, rank);
    }
    row.qty += qty;
    row.revenueUsd += revenue;
    row.costUsd += cost;
    row.profitUsd += revenue - cost;
    if (!(Number(it.unit_cost) > 0)) row.missingCost = true;
    byProduct.set(key, row);
  }

  const rows = [...byProduct.values()]
    .map((r) => ({
      ...r,
      marginPct: r.revenueUsd > 0 ? (r.profitUsd / r.revenueUsd) * 100 : null,
    }))
    .sort((a, b) => b.revenueUsd - a.revenueUsd || b.qty - a.qty);

  const totals = rows.reduce(
    (t, r) => ({
      qty: t.qty + r.qty,
      revenueUsd: t.revenueUsd + r.revenueUsd,
      costUsd: t.costUsd + r.costUsd,
      profitUsd: t.profitUsd + r.profitUsd,
    }),
    { qty: 0, revenueUsd: 0, costUsd: 0, profitUsd: 0 },
  );

  return { rows, totals, missingCost: rows.filter((r) => r.missingCost).length };
}

// ── Gastos ──────────────────────────────────────────────────────────────────

export type ExpenseRow = Pick<
  Expense,
  "id" | "spent_at" | "description" | "category" | "amount"
>;

/** `spent_at` es una fecha sin hora: se compara contra los días del período. */
export async function listExpenses(
  storeId: string,
  period: Period,
  { max = MAX_EXPORT_ROWS, newestFirst = true } = {},
): Promise<{ rows: ExpenseRow[]; hasMore: boolean }> {
  const supabase = createClient();
  return fetchRows<ExpenseRow>(
    (from, to) =>
      supabase
        .from("expenses")
        .select("id, spent_at, description, category, amount")
        .eq("store_id", storeId)
        .gte("spent_at", period.from)
        .lte("spent_at", period.to)
        .order("spent_at", { ascending: !newestFirst })
        .order("created_at", { ascending: !newestFirst })
        .order("id")
        .range(from, to),
    max,
  );
}
