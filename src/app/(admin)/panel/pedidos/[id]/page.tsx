import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";

import { OrderDetail, loadOrderDetail } from "@/components/admin/order-detail";
import { OrderStatusBadge } from "@/components/admin/status-badge";
import { requireStoreUser } from "@/lib/auth";

export const metadata = { title: "Pedido" };

// "Verifica el pago" lee el comprobante con IA desde esta página (ProofCheck),
// y la lectura tarda hasta 45 s en el peor caso.
export const maxDuration = 60;

/**
 * Un pedido en su propia página: la que se abre desde el teléfono, desde el
 * Resumen o desde un enlace. En escritorio ancho el mismo detalle se abre al
 * lado de la lista de Pedidos (ver OrderDetail).
 */
export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { store } = await requireStoreUser();
  const data = await loadOrderDetail(params.id, store);
  if (!data) notFound();
  const { order } = data;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="pb-1">
        <Link
          href="/panel/pedidos"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Pedidos
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.028em]">
            <span className="font-landing-mono text-[0.85em] font-semibold tracking-normal">
              #{order.order_number}
            </span>{" "}
            · {order.customer_name}
          </h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-sm text-ink-600">
          {format(new Date(order.created_at), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
        </p>
      </div>

      <OrderDetail data={data} storeName={store.name} variant="page" />
    </div>
  );
}
