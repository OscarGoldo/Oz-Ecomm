import { startOfDay, startOfMonth } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import type { Order, OrderStatus, Product } from "@/types/database";

/** Statuses that count as a real sale (revenue). */
export const SALES_STATUSES: OrderStatus[] = [
  "confirmed",
  "preparing",
  "in_delivery",
  "completed",
];

export interface DashboardMetrics {
  todayOrders: number;
  pendingConfirmation: number;
  lowStock: Pick<Product, "id" | "name" | "stock" | "low_stock_threshold">[];
  monthSalesUsd: number;
  monthSalesBs: number;
  monthOrders: number;
  recentOrders: Order[];
}

export async function getDashboardMetrics(
  storeId: string,
): Promise<DashboardMetrics> {
  const supabase = createClient();
  const dayStart = startOfDay(new Date()).toISOString();
  const monthStart = startOfMonth(new Date()).toISOString();

  const [
    { count: todayOrders },
    { count: pendingConfirmation },
    { data: lowStockRaw },
    { data: monthSales },
    { data: recentOrders },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .gte("created_at", dayStart),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", "pending_confirmation"),
    supabase
      .from("products")
      .select("id, name, stock, low_stock_threshold")
      .eq("store_id", storeId)
      .eq("status", "active")
      .eq("track_stock", true),
    supabase
      .from("orders")
      .select("total, total_bs")
      .eq("store_id", storeId)
      .in("status", SALES_STATUSES)
      .gte("created_at", monthStart),
    supabase
      .from("orders")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const lowStock = (lowStockRaw ?? [])
    .filter((p) => p.stock <= p.low_stock_threshold)
    .sort((a, b) => a.stock - b.stock);

  const monthSalesUsd = (monthSales ?? []).reduce((s, o) => s + Number(o.total), 0);
  const monthSalesBs = (monthSales ?? []).reduce(
    (s, o) => s + Number(o.total_bs ?? 0),
    0,
  );

  return {
    todayOrders: todayOrders ?? 0,
    pendingConfirmation: pendingConfirmation ?? 0,
    lowStock,
    monthSalesUsd,
    monthSalesBs,
    monthOrders: (monthSales ?? []).length,
    recentOrders: (recentOrders ?? []) as Order[],
  };
}

export interface FinanceSummary {
  totalUsd: number;
  totalBs: number;
  salesCount: number;
  avgTicketUsd: number;
  monthUsd: number;
  monthCount: number;
  pendingUsd: number;
  pendingCount: number;
  byMethod: { type: string; count: number; usd: number }[];
  recentSales: Order[];
}

export async function getFinanceSummary(
  storeId: string,
): Promise<FinanceSummary> {
  const supabase = createClient();
  const monthStart = startOfMonth(new Date()).toISOString();

  const [{ data: sales }, { data: pending }, { data: recentSales }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("total, total_bs, payment_method_type, created_at")
        .eq("store_id", storeId)
        .in("status", SALES_STATUSES),
      supabase
        .from("orders")
        .select("total")
        .eq("store_id", storeId)
        .eq("status", "pending_confirmation"),
      supabase
        .from("orders")
        .select("*")
        .eq("store_id", storeId)
        .in("status", SALES_STATUSES)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const list = sales ?? [];
  const totalUsd = list.reduce((s, o) => s + Number(o.total), 0);
  const totalBs = list.reduce((s, o) => s + Number(o.total_bs ?? 0), 0);
  const salesCount = list.length;
  const month = list.filter((o) => o.created_at >= monthStart);
  const monthUsd = month.reduce((s, o) => s + Number(o.total), 0);

  const methodMap = new Map<string, { count: number; usd: number }>();
  for (const o of list) {
    const key = o.payment_method_type ?? "other";
    const cur = methodMap.get(key) ?? { count: 0, usd: 0 };
    cur.count += 1;
    cur.usd += Number(o.total);
    methodMap.set(key, cur);
  }
  const byMethod = [...methodMap.entries()]
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => b.usd - a.usd);

  const pendingUsd = (pending ?? []).reduce((s, o) => s + Number(o.total), 0);

  return {
    totalUsd,
    totalBs,
    salesCount,
    avgTicketUsd: salesCount ? totalUsd / salesCount : 0,
    monthUsd,
    monthCount: month.length,
    pendingUsd,
    pendingCount: (pending ?? []).length,
    byMethod,
    recentSales: (recentSales ?? []) as Order[],
  };
}
