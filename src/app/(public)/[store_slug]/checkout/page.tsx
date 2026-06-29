import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CheckoutForm } from "@/components/storefront/checkout-form";
import { getStoreBySlug } from "@/lib/storefront";
import { getEnrichedCart } from "@/lib/cart";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/types/database";

export const metadata: Metadata = { title: { absolute: "Checkout" } };

export default async function CheckoutPage({
  params,
}: {
  params: { store_slug: string };
}) {
  const store = await getStoreBySlug(params.store_slug);
  if (!store) notFound();

  const cart = await getEnrichedCart(store);
  if (cart.lines.length === 0) {
    redirect(`/${store.slug}/carrito`);
  }

  const supabase = createClient();
  const { data: paymentMethodsRaw } = await supabase
    .from("payment_methods")
    .select("*")
    .eq("store_id", store.id)
    .eq("active", true)
    .order("display_order");

  // Never expose the PayPal secret to the browser; keep client_id (public).
  const paymentMethods = (paymentMethodsRaw ?? []).map((m) => {
    if (m.details && typeof m.details === "object") {
      const safe = { ...(m.details as Record<string, unknown>) };
      delete safe.secret;
      return { ...m, details: safe };
    }
    return m;
  });

  return (
    <main className="container max-w-5xl py-6">
      <Link
        href={`/${store.slug}/carrito`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver al carrito
      </Link>
      <h1 className="mb-5 text-2xl font-bold tracking-tight">Finalizar compra</h1>
      <CheckoutForm
        store={store}
        paymentMethods={(paymentMethods ?? []) as PaymentMethod[]}
        cart={cart}
      />
    </main>
  );
}
