import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ExampleAiBox } from "@/components/admin/examples/example-ai-box";
import { ExampleDeleteButton, ExampleLinkActions } from "@/components/admin/examples/example-actions";
import { ExampleDesignForm } from "@/components/admin/examples/example-design-form";
import { ExampleInfoForm } from "@/components/admin/examples/example-info-form";
import { ExampleProducts, type ExampleProductItem } from "@/components/admin/examples/example-products";
import { aiExampleAvailable } from "@/lib/ai-example";
import { requireSuperAdmin } from "@/lib/auth";
import { BASES } from "@/lib/design/bases";
import type { AnySection, Section } from "@/lib/design/types";
import { exampleDesign, exampleRubro, getExampleStore } from "@/lib/example-pages";
import { displayStoreAddress, storeUrl } from "@/lib/store-url";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Página ejemplo" };

function section<T extends AnySection["type"]>(home: AnySection[], type: T): Section<T> | undefined {
  return home.find((s) => s.type === type) as Section<T> | undefined;
}

/**
 * Armar la página ejemplo de un negocio: el atajo con IA, los productos, los
 * datos del negocio y el diseño. Cada parte guarda por su cuenta y la página
 * pública se actualiza al momento.
 */
export default async function SuperEjemploPage({ params }: { params: { id: string } }) {
  await requireSuperAdmin();
  const store = await getExampleStore(params.id);
  if (!store) notFound();

  const db = createAdminClient();
  const [{ data: productRows }, { data: categoryRows }] = await Promise.all([
    db
      .from("products")
      .select("id, name, description, price, compare_at_price, category_id, images, featured, created_at")
      .eq("store_id", store.id)
      .order("featured", { ascending: false })
      .order("created_at", { ascending: true }),
    db.from("categories").select("id, name").eq("store_id", store.id).order("display_order"),
  ]);
  const categoryName = new Map((categoryRows ?? []).map((c) => [c.id, c.name]));
  const products: ExampleProductItem[] = (productRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    compareAtPrice: p.compare_at_price != null ? Number(p.compare_at_price) : null,
    category: p.category_id ? (categoryName.get(p.category_id) ?? null) : null,
    image: p.images?.[0] ?? null,
    featured: p.featured,
  }));

  const design = exampleDesign(store, "general");
  const rubro = exampleRubro(design);
  const hero = section(design.home, "hero");
  const about = section(design.home, "about");
  const url = storeUrl(store);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/super/ejemplos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Páginas ejemplo
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{store.name}</h1>
            <ExampleLinkActions url={url} display={displayStoreAddress(url)} />
          </div>
          <ExampleDeleteButton id={store.id} name={store.name} />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <ExampleAiBox
            storeId={store.id}
            initialAbout={store.description ?? ""}
            available={aiExampleAvailable()}
            hasProducts={products.length > 0}
          />
          <ExampleProducts
            storeId={store.id}
            rubro={rubro}
            products={products}
            categories={(categoryRows ?? []).map((c) => c.name)}
          />
        </div>
        <div className="space-y-6">
          <ExampleInfoForm
            storeId={store.id}
            initial={{
              name: store.name,
              description: store.description ?? "",
              whatsapp: store.whatsapp ?? "",
              instagram: store.instagram ?? "",
              address: store.address ?? "",
              logo: store.logo_url,
              banner: store.banner_url,
            }}
          />
          <ExampleDesignForm
            storeId={store.id}
            bases={BASES.map((b) => ({ id: b.id, name: b.name, tagline: b.tagline, palettes: b.palettes }))}
            initial={{
              base: design.tokens.base ?? "barquisimeto",
              colors: design.tokens.colors,
              headline: hero?.settings.headline ?? "",
              subtext: hero?.settings.subtext ?? "",
              ctaText: hero?.settings.ctaText ?? "",
              announcement: design.header.announcement.enabled ? design.header.announcement.text : "",
              aboutTitle: about?.settings.title ?? "",
              aboutText: about?.settings.text ?? "",
            }}
          />
        </div>
      </div>
    </div>
  );
}
