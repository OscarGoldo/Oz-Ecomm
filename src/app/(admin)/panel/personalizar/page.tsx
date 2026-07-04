import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { ThemeEditor } from "@/components/admin/theme-editor";
import type { SampleProduct } from "@/components/admin/store-preview";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getImageUrl } from "@/lib/storage";
import { resolveTheme } from "@/lib/theme";

export const metadata = { title: "Personalizar" };

export default async function PersonalizarPage() {
  const { store } = await requireStoreUser();
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personalizar tienda</h1>
          <p className="text-sm text-muted-foreground">
            Cambiá colores, tipografía, textos y secciones. Mira la vista previa
            y guarda.
          </p>
        </div>
        <Link
          href={`/${store.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Ver tienda <ExternalLink className="size-4" />
        </Link>
      </div>

      <ThemeEditor
        store={{ id: store.id, name: store.name, slug: store.slug }}
        initialTheme={resolveTheme(store)}
        logoUrl={getImageUrl(store.logo_url)}
        sampleProducts={sampleProducts}
      />
    </div>
  );
}
