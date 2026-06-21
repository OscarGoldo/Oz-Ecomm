import {
  CategoriesManager,
  type CategoryItem,
} from "@/components/admin/categories-manager";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Categorías" };

export default async function CategoriasPage() {
  const { store } = await requireStoreUser();
  const supabase = createClient();

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, active")
      .eq("store_id", store.id)
      .order("display_order"),
    supabase.from("products").select("category_id").eq("store_id", store.id),
  ]);

  const counts = new Map<string, number>();
  for (const p of products ?? []) {
    if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  }

  const initial: CategoryItem[] = (categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    active: c.active,
    productCount: counts.get(c.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Categorías</h1>
        <p className="text-sm text-muted-foreground">
          Organizá tu catálogo. Arrastrá el orden con las flechas; así se ven en
          tu tienda.
        </p>
      </div>
      <CategoriesManager initial={initial} />
    </div>
  );
}
