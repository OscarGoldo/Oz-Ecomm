import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ProductForm } from "@/components/admin/product-form";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Editar producto" };

export default async function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const { store } = await requireStoreUser();
  const supabase = createClient();

  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("id", params.id)
      .eq("store_id", store.id)
      .maybeSingle(),
    supabase
      .from("categories")
      .select("id, name")
      .eq("store_id", store.id)
      .order("display_order"),
  ]);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/panel/productos"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Productos
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
      </div>
      <ProductForm
        storeId={store.id}
        categories={categories ?? []}
        product={product}
      />
    </div>
  );
}
