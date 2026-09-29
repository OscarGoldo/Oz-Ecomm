import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CheckoutForm } from "@/components/storefront/checkout-form";
import { CheckoutStartTracker } from "@/components/storefront/event-tracker";
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

  // PayPal se quitó en septiembre de 2026. Una tienda que todavía tenga el
  // método activo en la base no puede ofrecerlo: no hay con qué cobrarlo.
  //
  // El método con tarjeta guarda los datos de cobro del comerciante (cómo le
  // paga la plataforma) en details — se quitan para que nunca lleguen al
  // navegador del cliente.
  const paymentMethods = (paymentMethodsRaw ?? [])
    .filter((m) => m.type !== "paypal")
    .map((m) => {
    if (m.details && typeof m.details === "object") {
      const safe = Object.fromEntries(
        Object.entries(m.details as Record<string, unknown>).filter(
          ([k]) => !k.startsWith("payout") && k !== "secret",
        ),
      );
      return { ...m, details: safe };
    }
    return m;
  });

  return (
    <main className="container max-w-5xl py-6">
      <CheckoutStartTracker storeId={store.id} />
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
