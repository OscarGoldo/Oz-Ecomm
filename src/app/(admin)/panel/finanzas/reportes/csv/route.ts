import { requireStoreUser } from "@/lib/auth";
import { money, toCsv, type CsvValue } from "@/lib/csv";
import {
  getProductReport,
  listExpenses,
  listSales,
  resolveReportType,
} from "@/lib/finance-reports";
import { getPeriodReport } from "@/lib/metrics";
import { csvDateTime, resolvePeriod, type ReportPeriod } from "@/lib/report-period";
import { ORDER_STATUS_META, PAYMENT_METHOD_META } from "@/lib/constants";
import type { PaymentMethodType } from "@/types/database";

/**
 * Descarga en CSV de los reportes de Finanzas. Lee las mismas filas que la
 * página (`finance-reports.ts`), pero todas: la pantalla corta en mil, el
 * archivo no.
 *
 * La sesión la verifica `requireStoreUser()` y las consultas pasan por RLS:
 * aunque alguien cambie la URL, solo sale lo de su tienda.
 */
export async function GET(request: Request) {
  const { store } = await requireStoreUser();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const tipo = resolveReportType(params.tipo);
  const period = resolvePeriod(params);

  const { header, rows } = await build(tipo, store.id, period);
  const name = `${store.slug}-${tipo}-${period.from}_${period.to}.csv`;

  return new Response(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

function methodLabel(type: string | null): string {
  if (!type) return "";
  return PAYMENT_METHOD_META[type as PaymentMethodType]?.label ?? type;
}

async function build(
  tipo: ReturnType<typeof resolveReportType>,
  storeId: string,
  period: ReportPeriod,
): Promise<{ header: string[]; rows: CsvValue[][] }> {
  switch (tipo) {
    case "ventas": {
      // Del más viejo al más nuevo: así lo lee un libro de ventas.
      const { rows } = await listSales(storeId, period, { newestFirst: false });
      return {
        header: [
          "Fecha",
          "Pedido",
          "Estado",
          "Cliente",
          "Teléfono",
          "Correo",
          "Entrega",
          "Método de pago",
          "Referencia",
          "Cupón",
          "Subtotal USD",
          "Descuento USD",
          "Envío USD",
          "Total USD",
          "Tasa Bs/USD",
          "Total Bs",
          "Comisión USD",
          "Neto USD",
        ],
        rows: rows.map((o) => [
          csvDateTime(o.created_at),
          o.order_number,
          ORDER_STATUS_META[o.status]?.label ?? o.status,
          o.customer_name,
          o.customer_phone,
          o.customer_email,
          o.fulfillment_type === "delivery" ? "Delivery" : "Retiro en tienda",
          methodLabel(o.payment_method_type),
          o.payment_reference,
          o.coupon_code,
          money(o.subtotal),
          money(o.discount_total),
          money(o.shipping_cost),
          money(o.total),
          o.exchange_rate != null ? String(o.exchange_rate) : "",
          money(o.total_bs),
          money(o.payment_fee),
          // Sin comisión registrada (pagos fuera de la tarjeta), lo que entra
          // es el total.
          money(o.payment_net ?? o.total),
        ]),
      };
    }

    case "productos": {
      const { rows } = await getProductReport(storeId, period);
      return {
        header: [
          "Producto",
          "Unidades",
          "Ingreso USD",
          "Costo USD",
          "Ganancia USD",
          "Margen %",
          "Costo cargado",
        ],
        rows: rows.map((p) => [
          p.name,
          p.qty,
          money(p.revenueUsd),
          money(p.costUsd),
          money(p.profitUsd),
          p.marginPct !== null ? p.marginPct.toFixed(1) : "",
          p.missingCost ? "No" : "Sí",
        ]),
      };
    }

    case "gastos": {
      const { rows } = await listExpenses(storeId, period, { newestFirst: false });
      return {
        header: ["Fecha", "Descripción", "Categoría", "Monto USD"],
        rows: rows.map((e) => [
          e.spent_at,
          e.description,
          e.category || "Otros",
          money(e.amount),
        ]),
      };
    }

    case "resumen": {
      // Tres columnas fijas en vez de varias tablas pegadas: así se puede
      // filtrar por sección en una hoja de cálculo.
      const r = await getPeriodReport(storeId, period);
      const res = "Resultados";
      const met = "Métricas";
      return {
        header: ["Sección", "Concepto", "Valor"],
        rows: [
          ["Período", "Desde", period.from],
          ["Período", "Hasta", period.to],
          [res, "Ingresos por ventas USD", money(r.incomeUsd)],
          [res, "Ingresos por ventas Bs", money(r.incomeBs)],
          [res, "Costo de mercadería USD", money(r.cogsUsd)],
          [res, "Ganancia bruta USD", money(r.grossUsd)],
          [res, "Margen bruto %", r.marginPct.toFixed(1)],
          [res, "Gastos USD", money(r.expensesUsd)],
          [res, "Ganancia neta USD", money(r.netUsd)],
          [met, "Ventas", r.salesCount],
          [met, "Ticket promedio USD", money(r.avgTicketUsd)],
          [met, "Unidades vendidas", r.unitsSold],
          [met, "Clientes", r.customers],
          [met, `Ingresos USD en ${period.previous.label}`, money(r.prevIncomeUsd)],
          [met, `Ganancia neta USD en ${period.previous.label}`, money(r.prevNetUsd)],
          ...r.expensesByCategory.map((c): CsvValue[] => [
            "Gastos por categoría USD",
            c.category,
            money(c.usd),
          ]),
          ...r.byMethod.map((m): CsvValue[] => [
            "Ventas por método de pago USD",
            methodLabel(m.type),
            money(m.usd),
          ]),
        ],
      };
    }
  }
}
