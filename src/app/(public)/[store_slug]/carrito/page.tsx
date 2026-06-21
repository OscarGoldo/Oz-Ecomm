import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CartView } from "@/components/storefront/cart-view";
import { getStoreBySlug } from "@/lib/storefront";
import { getEnrichedCart } from "@/lib/cart";

export const metadata: Metadata = { title: { absolute: "Carrito" } };

export default async function CartPage({
  params,
}: {
  params: { store_slug: string };
}) {
  const store = await getStoreBySlug(params.store_slug);
  if (!store) notFound();

  const cart = await getEnrichedCart(store);

  return (
    <main className="container max-w-2xl py-6">
      <h1 className="mb-5 text-2xl font-bold tracking-tight">Tu carrito</h1>
      <CartView storeId={store.id} storeSlug={store.slug} cart={cart} />
    </main>
  );
}
