import Link from "next/link";
import { MessageCircle, Users } from "lucide-react";

import { requireStoreUser } from "@/lib/auth";
import { getStoreCustomers } from "@/lib/customers";
import { formatUSD } from "@/lib/format";
import { whatsappUrl } from "@/lib/whatsapp";

export const metadata = { title: "Clientes" };

export default async function ClientesPage() {
  const { store } = await requireStoreUser();
  const customers = await getStoreCustomers(store.id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          {customers.length} {customers.length === 1 ? "cliente" : "clientes"} ·
          de tus pedidos
        </p>
      </div>

      {customers.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-12 text-center">
          <Users className="mb-3 size-9 text-muted-foreground" />
          <p className="font-medium">Todavía no hay clientes</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando entren pedidos, tus clientes aparecen aquí.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {customers.map((c) => {
            const wa = whatsappUrl(
              c.phone,
              `Hola ${c.name}! 👋 Te escribo de ${store.name}.`,
            );
            return (
              <li
                key={c.phone}
                className="flex items-center gap-3 rounded-xl border bg-card p-3"
              >
                <Link
                  href={`/panel/clientes/${encodeURIComponent(c.phone)}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.phone} · {c.ordersCount}{" "}
                      {c.ordersCount === 1 ? "pedido" : "pedidos"}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-sm font-semibold">
                    {formatUSD(c.totalSpentUsd)}
                  </span>
                </Link>
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="size-5" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
