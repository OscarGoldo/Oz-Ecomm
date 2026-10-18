import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PhotoProductLoader } from "@/components/admin/photo-product-loader";
import { ProUpsell } from "@/components/admin/pro-lock";
import { aiPhotoQuota, aiProductsAvailable, AI_PHOTO_BATCH } from "@/lib/ai-products";
import { requireStoreUser } from "@/lib/auth";
import { planLimits } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Cargar con fotos" };

// Cada foto se lee en su propia llamada (unos segundos); las acciones heredan
// este techo.
export const maxDuration = 60;

export default async function PhotoProductsPage() {
  const { store } = await requireStoreUser();
  // Sin clave de Anthropic o sin la tabla ai_generations: al formulario de siempre.
  if (!aiProductsAvailable()) redirect("/panel/productos/nuevo");
  const quota = await aiPhotoQuota(store);
  if (!quota) redirect("/panel/productos/nuevo");

  const supabase = createClient();
  const { maxProducts } = planLimits(store);
  let slotsLeft: number | null = null;
  if (Number.isFinite(maxProducts)) {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .neq("status", "archived");
    slotsLeft = Math.max(0, maxProducts - (count ?? 0));
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("store_id", store.id)
    .order("display_order");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/panel/productos"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Productos
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Cargar con fotos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sube las fotos de lo que vendes y la IA escribe el nombre, la descripción y la
          categoría. Tú pones el precio y revisas antes de publicar.
        </p>
      </div>

      {slotsLeft === 0 ? (
        <ProUpsell
          title={`Llegaste a los ${maxProducts} productos del plan Gratis`}
          text="Tus productos actuales siguen publicados y los puedes seguir editando. Con Pro cargas productos ilimitados."
        />
      ) : (
        <PhotoProductLoader
          storeId={store.id}
          categories={categories ?? []}
          slotsLeft={slotsLeft}
          initialQuota={quota}
          batchSize={AI_PHOTO_BATCH}
        />
      )}
    </div>
  );
}
