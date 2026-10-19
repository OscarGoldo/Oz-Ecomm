import { createClient } from "@/lib/supabase/server";
import { groupByCustomer, phoneKey } from "@/lib/customer-identity";
import type { Order } from "@/types/database";

/** Del más nuevo al más viejo: el primero del grupo es el pedido más reciente. */
const NEWEST_FIRST = <T extends { created_at: string }>(a: T, b: T) =>
  a.created_at < b.created_at ? 1 : -1;

// La lista de clientes con sus tipos y cifras vive en `customers-overview.ts`.

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
