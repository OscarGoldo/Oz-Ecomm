import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ProductForm } from "@/components/admin/product-form";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  const { store } = await requireStoreUser();
  const supabase = createClient();
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
      <ProductForm storeId={store.id} categories={categories ?? []} />
    </div>
  );
}
