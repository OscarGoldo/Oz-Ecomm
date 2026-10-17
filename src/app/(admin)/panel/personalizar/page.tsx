import Link from "next/link";
import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";

import { ThemeEditor } from "@/components/admin/theme-editor";
import { DesignEditor } from "@/components/admin/design-editor/design-editor";
import { designV2Enabled } from "@/lib/design/flag";
import { designTablesReady, loadDraft } from "@/lib/design/store";
import { getStoreCategories } from "@/lib/storefront";
import type { SampleProduct } from "@/components/admin/store-preview";
import { ProChip } from "@/components/admin/pro-lock";
import { aiDesignAvailable, aiDesignQuota } from "@/lib/ai-design";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getImageUrl } from "@/lib/storage";
import { isPro } from "@/lib/plans";
import { resolveTheme } from "@/lib/theme";
import { storeUrl } from "@/lib/store-url";

export const metadata = { title: "Personalizar" };

export default async function PersonalizarPage() {
  const { store } = await requireStoreUser();
  const supabase = createClient();

  // El diseñador con IA vive acá, en Diseño. En Gratis trae un diseño de
  // prueba; usado ese, la tarjeta lleva a Pro.
  const aiQuota = aiDesignAvailable() ? await aiDesignQuota(store) : null;
  const aiCard = aiQuota && <AiDesignCard pro={aiQuota.pro} needsPro={!aiQuota.pro && aiQuota.freeUsed} />;

  // Editor por secciones: para las tiendas que lo tienen prendido, una vez
  // corrida la migración 0033. Las demás siguen con el editor de siempre.
  if (designV2Enabled(store) && (await designTablesReady())) {
    const [{ design, dirty }, categories] = await Promise.all([
      loadDraft(store),
      getStoreCategories(store.id),
    ]);
    return (
      <div className="space-y-4">
        {aiCard}
        <DesignEditor
          storeId={store.id}
          storeUrl={storeUrl(store)}
          initialDesign={design}
          initialDirty={dirty}
          pro={isPro(store)}
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        />
      </div>
    );
  }

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
            Cambia colores, tipografía, textos y secciones. Mira la vista previa
            y guarda.
          </p>
        </div>
        <Link
          href={storeUrl(store)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border bg-background px-3.5 py-2 text-sm font-medium shadow-sm hover:bg-muted"
        >
          Ver tienda <ExternalLink className="size-4" />
        </Link>
      </div>

      {aiCard}

      <ThemeEditor
        store={{ id: store.id, name: store.name, slug: store.slug }}
        initialTheme={resolveTheme(store)}
        logoUrl={getImageUrl(store.logo_url)}
        sampleProducts={sampleProducts}
        pro={isPro(store)}
      />
    </div>
  );
}

/** La entrada al diseñador con IA. En Gratis, ya usado el de prueba, lleva a Pro. */
function AiDesignCard({ pro, needsPro }: { pro: boolean; needsPro: boolean }) {
  return (
    <Link
      href={needsPro ? "/panel/plan" : "/panel/personalizar/ia"}
      className="group flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Sparkles className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
          Diseña tu tienda con IA
          {needsPro ? (
            <ProChip />
          ) : (
            !pro && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                1 gratis
              </span>
            )
          )}
        </span>
        <span className="block text-xs text-muted-foreground">
          {needsPro
            ? "Ya usaste tu diseño gratis. Con Pro pides nuevos diseños con IA cuando quieras."
            : "Cuéntanos de tu negocio y te armamos tres propuestas con plantilla, colores y textos."}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
