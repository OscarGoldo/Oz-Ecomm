import { notFound } from "next/navigation";

import { CardReturn } from "@/components/storefront/card-return";
import { getStoreBySlug } from "@/lib/storefront";

export const metadata = { title: { absolute: "Procesando tu pago" } };

/**
 * La vuelta del banco.
 *
 * Solo se pasa por acá cuando el banco pidió verificación (3-D Secure) y sacó
 * al cliente de la página. Stripe lo devuelve con el cobro en la URL y acá se
 * termina lo que el navegador no pudo terminar: crear el pedido.
 *
 * No es la única red: si el cliente nunca vuelve, el webhook hace lo mismo con
 * el borrador congelado. Las dos son idempotentes, así que pueden correr las
 * dos.
 */
export default async function CardReturnPage({
  params,
  searchParams,
}: {
  params: { store_slug: string };
  searchParams?: { payment_intent?: string; redirect_status?: string };
}) {
  const store = await getStoreBySlug(params.store_slug);
  if (!store) notFound();

  return (
    <main className="container flex max-w-md flex-col items-center py-16 text-center">
      <CardReturn
        storeSlug={store.slug}
        paymentIntentId={searchParams?.payment_intent ?? null}
        redirectStatus={searchParams?.redirect_status ?? null}
      />
    </main>
  );
}
