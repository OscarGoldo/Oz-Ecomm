import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ProductForm } from "@/components/admin/product-form";
import { ProUpsell } from "@/components/admin/pro-lock";
import { requireStoreUser } from "@/lib/auth";
import { planLimits } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  const { store } = await requireStoreUser();
  const supabase = createClient();

  // El candado real vive en createProduct; esto es para no hacerle llenar el
  // formulario entero a alguien que ya no puede guardarlo.
  const { maxProducts } = planLimits(store);
  let atLimit = false;
  if (Number.isFinite(maxProducts)) {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .neq("status", "archived");
    atLimit = (count ?? 0) >= maxProducts;
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("store_id", store.id)
    .order("display_order");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/panel/productos"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Productos
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nuevo producto</h1>
      </div>
      {atLimit ? (
        <ProUpsell
          title={`Llegaste a los ${maxProducts} productos del plan Gratis`}
          text="Tus productos actuales siguen publicados y los puedes seguir editando. Con Pro cargas productos ilimitados."
        />
      ) : (
        <ProductForm storeId={store.id} categories={categories ?? []} />
      )}
    </div>
  );
}
