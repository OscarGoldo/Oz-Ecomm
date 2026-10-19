import "server-only";

import { getProductReport } from "@/lib/finance-reports";
import { caracasToday, resolvePeriod } from "@/lib/report-period";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types/database";

/**
 * Lo que necesitan Productos y Categorías del panel: el catálogo entero (en
 * columnas livianas) y cómo le fue a cada producto en los últimos 30 días.
 *
 * El catálogo se lee completo y no de a 40 porque las pestañas cuentan sobre
 * todo ("Stock bajo 3") y el orden por más vendidos necesita a todos para
 * saber quién va primero. Son pocas columnas: 2.000 productos pesan menos que
 * una foto.
 */

/** Los días que miran las tarjetas: "214 vistas · 14 vendidos". */
export const CATALOG_DAYS = 30;

const MAX_ROWS = 50_000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** De a mil filas hasta el final: PostgREST corta en mil sin avisar. */
async function fetchAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await page(rows.length, rows.length + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000 || rows.length >= MAX_ROWS) return rows;
  }
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export type CatalogProductRow = Pick<
  Product,
  | "id"
  | "name"
  | "sku"
  | "category_id"
  | "price"
  | "compare_at_price"
  | "cost"
  | "stock"
  | "track_stock"
  | "low_stock_threshold"
  | "status"
  | "featured"
  | "images"
  | "created_at"
>;

/** Todos los productos de la tienda, del más nuevo al más viejo. */
export async function listCatalog(storeId: string): Promise<CatalogProductRow[]> {
  const supabase = createClient();
  return fetchAll<CatalogProductRow>((from, to) =>
    supabase
      .from("products")
      .select(
        "id, name, sku, category_id, price, compare_at_price, cost, stock, track_stock, low_stock_threshold, status, featured, images, created_at",
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
}

export interface ProductActivity {
  /** Veces que se abrió su página. */
  views: number;
  /** Unidades vendidas. */
  sold: number;
  /** Lo que se cobró por él, con el descuento del pedido repartido. */
  revenueUsd: number;
}

/**
 * Vistas y ventas de cada producto en los últimos 30 días (hoy incluido, días
 * de Caracas). Las ventas salen del mismo reporte de Finanzas, así que cuadran
 * con lo que el comerciante ve allá. Si algo falla, la página sigue sin
 * números: no vale la pena tumbar el catálogo por una estadística.
 */
export async function getCatalogActivity(
  storeId: string,
): Promise<Map<string, ProductActivity>> {
  const today = caracasToday();
  const period = resolvePeriod({ desde: addDays(today, -(CATALOG_DAYS - 1)), hasta: today });
  const supabase = createClient();

  const [views, report] = await Promise.all([
    fetchAll<{ product_id: string | null }>((from, to) =>
      supabase
        .from("store_events")
        .select("product_id")
        .eq("store_id", storeId)
        .eq("event_type", "product_view")
        .not("product_id", "is", null)
        .gte("created_at", period.fromISO)
        .lt("created_at", period.toISO)
        .order("id")
        .range(from, to),
    ).catch(() => []),
    getProductReport(storeId, period).catch(() => null),
  ]);

  const activity = new Map<string, ProductActivity>();
  const get = (id: string) => {
    let a = activity.get(id);
    if (!a) {
      a = { views: 0, sold: 0, revenueUsd: 0 };
      activity.set(id, a);
    }
    return a;
  };
  for (const v of views) if (v.product_id) get(v.product_id).views += 1;
  for (const r of report?.rows ?? []) {
    if (!r.productId) continue;
    const a = get(r.productId);
    a.sold += r.qty;
    a.revenueUsd += r.revenueUsd;
  }
  return activity;
}

/** Sin costo cargado: su ganancia no se puede calcular. */
export function missingCost(p: Pick<CatalogProductRow, "cost">): boolean {
  return p.cost == null || Number(p.cost) <= 0;
}

/** El aviso corto de la tarjeta, si hay alguno. Uno solo: el más urgente. */
export function productWarning(
  p: Pick<CatalogProductRow, "status" | "images" | "cost">,
  a: ProductActivity | undefined,
): string | null {
  if (p.status === "archived") return null;
  if (p.images.length === 0) return "Sin foto";
  if (p.status === "active" && missingCost(p)) return "Sin costo";
  // Mucha gente lo abre y nadie se lo lleva: precio, fotos o descripción.
  if (a && a.views >= 30 && a.sold === 0) return "Se mira, no se vende";
  return null;
}
