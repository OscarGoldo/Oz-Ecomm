import { createClient } from "@/lib/supabase/server";
import { groupByCustomer, phoneKey } from "@/lib/customer-identity";
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

/** Del más nuevo al más viejo: el primero del grupo es el pedido más reciente. */
const NEWEST_FIRST = <T extends { created_at: string }>(a: T, b: T) =>
  a.created_at < b.created_at ? 1 : -1;

/**
 * Los clientes salen de los pedidos, agrupados por persona (mismo teléfono o
 * mismo email — ver `customer-identity.ts`) y no por el texto exacto del
 * teléfono. "Total gastado" cuenta solo las ventas confirmadas.
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

  const customers = groupByCustomer(orders ?? []).map((group) => {
    // El grupo puede haber quedado desordenado al fundir dos clientes.
    const sorted = [...group].sort(NEWEST_FIRST);
    const last = sorted[0]!;
    return {
      // Los datos del pedido más reciente: es como el cliente se identifica hoy.
      phone: last.customer_phone,
      name: last.customer_name,
      email: sorted.find((o) => o.customer_email)?.customer_email ?? null,
      ordersCount: sorted.length,
      totalSpentUsd: sorted
        .filter((o) => SALES_STATUSES.includes(o.status))
        .reduce((sum, o) => sum + Number(o.total), 0),
      lastOrderAt: last.created_at,
    };
  });

  return customers.sort((a, b) => (a.lastOrderAt < b.lastOrderAt ? 1 : -1));
}

/**
 * Todos los pedidos de un cliente. El teléfono es el que muestra el listado,
 * pero se devuelve el grupo entero: si pidió con dos números distintos, esos
 * pedidos siguen siendo suyos.
 */
export async function getCustomerOrders(
  storeId: string,
  phone: string,
): Promise<Order[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  const orders = (data ?? []) as Order[];
  const key = phoneKey(phone);
  const group = groupByCustomer(orders).find((g) =>
    g.some((o) =>
      key ? phoneKey(o.customer_phone) === key : o.customer_phone === phone,
    ),
  );

  return (group ?? []).sort(NEWEST_FIRST);
}
