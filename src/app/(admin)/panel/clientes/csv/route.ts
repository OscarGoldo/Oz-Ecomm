import { requireStoreUser } from "@/lib/auth";
import { money, toCsv } from "@/lib/csv";
import { SEGMENT_META } from "@/lib/customer-segments";
import { getCustomersOverview } from "@/lib/customers-overview";
import { csvDateTime } from "@/lib/report-period";

/**
 * La lista de clientes en CSV, para pasarla a una hoja de cálculo o a una
 * campaña. Los pedidos pasan por RLS: solo sale lo de la tienda de la sesión.
 */
export async function GET() {
  const { store } = await requireStoreUser();
  const { customers } = await getCustomersOverview(store.id);

  const header = [
    "Nombre",
    "Teléfono",
    "Correo",
    "Pedidos confirmados",
    "Gastado USD",
    "Primer pedido",
    "Último pedido",
    "Tipo",
  ];
  const rows = customers.map((c) => [
    c.name,
    c.phone,
    c.email,
    c.sales,
    money(c.spentUsd),
    csvDateTime(c.firstAt),
    csvDateTime(c.lastAt),
    SEGMENT_META[c.segment].label,
  ]);

  return new Response(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${store.slug}-clientes.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
