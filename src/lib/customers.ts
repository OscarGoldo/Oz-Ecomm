import { createClient } from "@/lib/supabase/server";
import { SALES_STATUSES } from "@/lib/metrics";
import type { Order } from "@/types/database";

export interface CustomerSummary {
  phone: string;
  name: string;
  email: string | null;
  ordersCount: number;
  totalSpentUsd: number;
  lastOrderAt: string;
}

/**
 * Customers are derived from guest orders, grouped by phone number (the most
 * reliable identifier for guest checkout). "Total spent" counts confirmed
 * sales only.
 */
export async function getStoreCustomers(
  storeId: string,
): Promise<CustomerSummary[]> {
  const supabase = createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("customer_name, customer_phone, customer_email, total, status, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  const byPhone = new Map<string, CustomerSummary>();
  for (const o of orders ?? []) {
    const phone = o.customer_phone;
    const existing = byPhone.get(phone);
    const isSale = SALES_STATUSES.includes(o.status);
    if (existing) {
      existing.ordersCount += 1;
      if (isSale) existing.totalSpentUsd += Number(o.total);
    } else {
      byPhone.set(phone, {
        phone,
        name: o.customer_name,
        email: o.customer_email,
        ordersCount: 1,
        totalSpentUsd: isSale ? Number(o.total) : 0,
        lastOrderAt: o.created_at, // first seen = newest (ordered desc)
      });
    }
  }

  return [...byPhone.values()].sort((a, b) =>
    a.lastOrderAt < b.lastOrderAt ? 1 : -1,
  );
}

/** All orders for one customer (by phone). */
export async function getCustomerOrders(
  storeId: string,
  phone: string,
): Promise<Order[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("store_id", storeId)
    .eq("customer_phone", phone)
    .order("created_at", { ascending: false });
  return (data ?? []) as Order[];
}
