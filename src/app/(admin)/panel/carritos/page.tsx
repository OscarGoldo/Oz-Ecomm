import { ShoppingCart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

import { AbandonedCartRow } from "@/components/admin/abandoned-cart-row";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/format";
import { abandonedCartCutoff } from "@/lib/constants";
import { whatsappUrl } from "@/lib/whatsapp";
import { abandonedCartMessage } from "@/lib/order-messages";
import type { AbandonedCart } from "@/types/database";

export const metadata = { title: "Carritos" };

export default async function CarritosPage() {
  const { store } = await requireStoreUser();
  const supabase = createClient();

  const { data } = await supabase
    .from("abandoned_carts")
    .select("*")
    .eq("store_id", store.id)
    .is("recovered_at", null)
    .is("dismissed_at", null)
    .lt("updated_at", abandonedCartCutoff())
    .order("updated_at", { ascending: false })
    .limit(100);
  const carts = (data ?? []) as AbandonedCart[];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const storeUrl = appUrl ? `${appUrl}/${store.slug}` : null;

  const ago = (iso: string) =>
    formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Carritos abandonados</h1>
        <p className="text-sm text-muted-foreground">
          Clientes que dejaron sus datos pero no terminaron de comprar.
          Escríbeles y recupera la venta.
        </p>
      </div>

      {carts.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-12 text-center">
          <ShoppingCart className="mb-3 size-9 text-muted-foreground" />
          <p className="font-medium">No hay carritos pendientes</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando alguien llene sus datos en el checkout y no termine de
            comprar, aparece aquí para que lo recuperes.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {carts.map((cart) => {
            const items = cart.items ?? [];
            const message = abandonedCartMessage({
              storeName: store.name,
              customerName: cart.customer_name,
              items: items.map((i) => ({
                productName: i.name,
                variantName: i.variant,
                quantity: i.qty,
                subtotal: i.price * i.qty,
              })),
              subtotal: Number(cart.subtotal),
              storeUrl,
            });

            return (
              <AbandonedCartRow
                key={cart.id}
                cartId={cart.id}
                customerName={cart.customer_name}
                phone={cart.customer_phone}
                timeAgo={ago(cart.updated_at)}
                itemLabels={items.map(
                  (i) =>
                    `• ${i.qty}× ${i.name}${i.variant ? ` (${i.variant})` : ""}`,
                )}
                subtotalLabel={formatUSD(Number(cart.subtotal))}
                whatsappHref={whatsappUrl(cart.customer_phone, message)}
                contactedLabel={
                  cart.last_contacted_at ? ago(cart.last_contacted_at) : null
                }
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
