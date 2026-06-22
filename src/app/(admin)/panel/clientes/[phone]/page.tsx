import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Mail, MessageCircle, Phone } from "lucide-react";

import { OrderStatusBadge } from "@/components/admin/status-badge";
import { requireStoreUser } from "@/lib/auth";
import { getCustomerOrders } from "@/lib/customers";
import { SALES_STATUSES } from "@/lib/metrics";
import { formatUSD } from "@/lib/format";
import { whatsappUrl } from "@/lib/whatsapp";

export const metadata = { title: "Cliente" };

export default async function CustomerDetailPage({
  params,
}: {
  params: { phone: string };
}) {
  const { store } = await requireStoreUser();
  const phone = decodeURIComponent(params.phone);
  const orders = await getCustomerOrders(store.id, phone);
  if (orders.length === 0) notFound();

  const name = orders[0]!.customer_name;
  const email = orders.find((o) => o.customer_email)?.customer_email ?? null;
  const totalSpent = orders
    .filter((o) => SALES_STATUSES.includes(o.status))
    .reduce((s, o) => s + Number(o.total), 0);

  const wa = whatsappUrl(phone, `Hola ${name}! 👋 Te escribo de ${store.name}.`);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/panel/clientes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight">{name}</h1>
            <p className="text-sm text-muted-foreground">
              {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} ·{" "}
              {formatUSD(totalSpent)} gastado
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Phone className="size-4" /> {phone}
          </p>
          {email && (
            <p className="flex items-center gap-2">
              <Mail className="size-4" /> {email}
            </p>
          )}
        </div>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <MessageCircle className="size-4" /> Escribir por WhatsApp
          </a>
        )}
      </div>

      <section className="rounded-xl border bg-card">
        <h2 className="border-b p-4 text-sm font-semibold">Pedidos</h2>
        <ul className="divide-y">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/panel/pedidos/${o.id}`}
                className="flex items-center gap-3 p-4 hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">#{o.order_number}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(o.created_at), "d MMM yyyy, HH:mm", {
                      locale: es,
                    })}
                  </p>
                </div>
                <span className="font-semibold">{formatUSD(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
