import { redirect } from "next/navigation";

import { AiDesigner } from "@/components/admin/ai-designer";
import type { SampleProduct } from "@/components/admin/store-preview";
import {
  aiDesignAvailable,
  aiDesignQuota,
  AI_DESIGN_DAILY_LIMIT,
} from "@/lib/ai-design";
import { requireStoreUser } from "@/lib/auth";
import { getImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Diseñar con IA" };

// La generación tarda cerca de un minuto y la acción hereda este techo.
export const maxDuration = 120;

export default async function AiDesignPage() {
  const { store } = await requireStoreUser();
  // Sin clave o sin la migración 0032 no hay diseñador: al editor de siempre.
  if (!aiDesignAvailable()) redirect("/panel/personalizar");
  const quota = await aiDesignQuota(store);
  if (!quota) redirect("/panel/personalizar");

  const supabase = createClient();
  const { data: products } = await supabase
    .from("products")
    .select("name, price, images")
    .eq("store_id", store.id)
    .eq("status", "active")
    .order("featured", { ascending: false })
    .limit(4);

  const sampleProducts: SampleProduct[] = (products ?? []).map((p) => ({
    name: p.name,
    price: Number(p.price),
    image: getImageUrl(p.images?.[0]),
  }));

  return (
    <AiDesigner
      storeName={store.name}
      logoUrl={getImageUrl(store.logo_url)}
      sampleProducts={sampleProducts}
      quota={quota}
      dailyLimit={AI_DESIGN_DAILY_LIMIT}
      hasDescription={Boolean(store.description)}
    />
  );
}
