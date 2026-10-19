import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ExternalLink, Eye, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CategoriesManager,
  type CategoryItem,
} from "@/components/admin/categories-manager";
import { requireStoreUser } from "@/lib/auth";
import { getCatalogActivity, listCatalog } from "@/lib/catalog-stats";
import { formatUSD } from "@/lib/format";
import { getImageUrl } from "@/lib/storage";
import { storeUrl } from "@/lib/store-url";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Categorías" };

interface Agg {
  productCount: number;
  draftCount: number;
  salesUsd: number;
  units: number;
  views: number;
  /** Fotos de lo que está a la venta, con lo que vendió cada producto. */
  covers: { url: string; score: number }[];
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Las categorías en el orden del menú de la tienda, con lo que vendió cada
 * una, cómo ve el cliente ese menú y lo que conviene arreglar (una vacía que
 * igual sale, productos sin categoría, una que se mira y no se vende).
 */
export default async function CategoriasPage() {
  const { store } = await requireStoreUser();
  const supabase = createClient();

  const [{ data: categories }, products, activity] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, active")
      .eq("store_id", store.id)
      .order("display_order"),
    listCatalog(store.id),
    getCatalogActivity(store.id),
  ]);

  const cats = categories ?? [];
  const agg = new Map<string, Agg>(
    cats.map((c) => [
      c.id,
      { productCount: 0, draftCount: 0, salesUsd: 0, units: 0, views: 0, covers: [] },
    ]),
  );
  let uncategorized = 0;
  let uncategorizedSales = 0;
  let totalSales = 0;
  let totalUnits = 0;
  let totalViews = 0;

  for (const p of products) {
    const a = activity.get(p.id);
    const g = p.category_id ? agg.get(p.category_id) : undefined;
    totalSales += a?.revenueUsd ?? 0;
    totalUnits += a?.sold ?? 0;
    totalViews += a?.views ?? 0;
    if (!g) {
      if (p.status !== "archived") uncategorized += 1;
      uncategorizedSales += a?.revenueUsd ?? 0;
      continue;
    }
    // Lo vendido cuenta aunque el producto se haya archivado después.
    g.salesUsd += a?.revenueUsd ?? 0;
    g.units += a?.sold ?? 0;
    g.views += a?.views ?? 0;
    if (p.status === "active") {
      g.productCount += 1;
      const url = getImageUrl(p.images[0]);
      if (url) g.covers.push({ url, score: (a?.sold ?? 0) * 1000 + (a?.views ?? 0) });
    } else if (p.status === "draft") {
      g.draftCount += 1;
    }
  }

  const initial: CategoryItem[] = cats.map((c) => {
    const g = agg.get(c.id)!;
    return {
      id: c.id,
      name: c.name,
      active: c.active,
      productCount: g.productCount,
      draftCount: g.draftCount,
      salesUsd: g.salesUsd,
      units: g.units,
      thumbs: [...g.covers].sort((x, y) => y.score - x.score).slice(0, 3).map((c) => c.url),
    };
  });

  const visible = cats.filter((c) => c.active).length;
  const hidden = cats.length - visible;
  const ranked = cats
    .map((c) => ({ id: c.id, name: c.name, active: c.active, ...agg.get(c.id)! }))
    .filter((c) => c.salesUsd > 0)
    .sort((a, b) => b.salesUsd - a.salesUsd);
  const top = ranked[0];
  // 99% y no 100% mientras haya otra venta, aunque sea de $1.
  const share = (usd: number) =>
    totalSales <= 0 ? 0 : usd >= totalSales ? 100 : Math.min(99, Math.round((usd / totalSales) * 100));

  // ── Para mirar ──
  const tips: { key: string; tone: "up" | "warn" | "eye"; body: ReactNode }[] = [];
  if (top) {
    const withProducts = cats.filter((c) => agg.get(c.id)!.productCount > 0);
    const avgProducts =
      withProducts.reduce((s, c) => s + agg.get(c.id)!.productCount, 0) / Math.max(1, withProducts.length);
    tips.push({
      key: "top",
      tone: "up",
      body:
        share(top.salesUsd) >= 30 && top.productCount > 0 && top.productCount <= avgProducts ? (
          <>
            <b>{top.name}</b> vende el {share(top.salesUsd)}% con solo {plural(top.productCount, "producto", "productos")}.
            Si sumas modelos, es donde más rinden.
          </>
        ) : (
          <>
            <b>{top.name}</b> es la que más vende: el {share(top.salesUsd)}% de lo vendido en 30 días.
          </>
        ),
    });
  }
  const empty = cats.filter((c) => c.active && agg.get(c.id)!.productCount === 0);
  if (empty.length > 0) {
    tips.push({
      key: "empty",
      tone: "warn",
      body:
        empty.length === 1 ? (
          <>
            <b>{empty[0].name}</b> no tiene nada a la venta y sale en tu menú. Ponle productos o apágala para
            que nadie entre a una página en blanco.
          </>
        ) : (
          <>
            <b>{empty[0].name}</b> y {plural(empty.length - 1, "otra", "otras")} no tienen nada a la venta y
            salen en tu menú. Ponles productos o apágalas.
          </>
        ),
    });
  }
  // La que más se mira entre las que convierten menos de la mitad que la tienda.
  const storeRate = totalViews > 0 ? totalUnits / totalViews : 0;
  const leaky = cats
    .map((c) => ({ name: c.name, ...agg.get(c.id)! }))
    .filter((c) => c.views >= 30 && storeRate > 0 && c.units / c.views < storeRate / 2)
    .sort((a, b) => b.views - a.views)[0];
  if (leaky) {
    tips.push({
      key: "leaky",
      tone: "eye",
      body: (
        <>
          <b>{leaky.name}</b> tuvo {leaky.views} visitas en 30 días pero vende poco: revisa precios y fotos.
        </>
      ),
    });
  }

  const maxBar = Math.max(top?.salesUsd ?? 0, uncategorizedSales);
  const bars = [
    ...ranked.slice(0, 8).map((c) => ({ key: c.id, name: c.name, usd: c.salesUsd, units: c.units, muted: false })),
    ...(uncategorizedSales > 0
      ? [{ key: "sin", name: "Sin categoría", usd: uncategorizedSales, units: 0, muted: true }]
      : []),
  ];

  const aside = (
    <>
      {cats.length > 0 && (
        <section aria-labelledby="ventas-categoria" className="rounded-2xl border bg-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="ventas-categoria" className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
              Qué vende cada una
            </h2>
            {totalSales > 0 && (
              <span className="font-landing-mono text-xs tabular-nums text-ink-500">30 días · {formatUSD(totalSales)}</span>
            )}
          </div>
          {bars.length === 0 ? (
            <p className="mt-3 text-[13.5px] leading-[1.45] text-ink-600">
              En los últimos 30 días no hubo ventas. Cuando vendas, aquí verás qué categoría deja más.
            </p>
          ) : (
            <ul className="mt-3.5 flex flex-col gap-2.5">
              {bars.map((b) => (
                <li
                  key={b.key}
                  className="grid grid-cols-[96px_minmax(0,1fr)_72px] items-center gap-2.5 text-[13px]"
                  title={`${b.name}: ${formatUSD(b.usd)} · ${share(b.usd)}% de lo vendido${b.units ? ` · ${plural(b.units, "unidad", "unidades")}` : ""}`}
                >
                  <span className="truncate font-semibold text-pizarra">{b.name}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-[#EEF3F8]">
                    <span
                      className={cn("block h-full rounded-r-[4px]", b.muted ? "bg-[#BFCEDD]" : "bg-brand-600")}
                      style={{ width: `${Math.max(3, Math.round((b.usd / maxBar) * 100))}%` }}
                    />
                  </span>
                  <span className="text-right font-landing-mono text-[12.5px] font-semibold tabular-nums">
                    {formatUSD(b.usd)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tips.length > 0 && (
        <section aria-labelledby="para-mirar" className="flex flex-col gap-3.5 rounded-2xl bg-noche p-5">
          <h2 id="para-mirar" className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-niebla">
            Para mirar
          </h2>
          {tips.map((t) => (
            <p key={t.key} className="flex items-start gap-2.5 text-[13.5px] leading-[1.45] text-[#D7E1EB] [&_b]:text-white">
              <span
                className={cn(
                  "grid size-[26px] shrink-0 place-items-center rounded-lg",
                  t.tone === "up" && "bg-sol/15 text-sol",
                  t.tone === "warn" && "bg-[#eb6834]/20 text-[#F59A6F]",
                  t.tone === "eye" && "bg-sky-400/15 text-sky-300",
                )}
                aria-hidden="true"
              >
                {t.tone === "up" ? (
                  <TrendingUp className="size-3.5" />
                ) : t.tone === "warn" ? (
                  <AlertTriangle className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </span>
              <span>{t.body}</span>
            </p>
          ))}
        </section>
      )}
    </>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <header>
          <p className="font-landing-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            Catálogo · categorías
          </p>
          <h1 className="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.028em]">Categorías</h1>
          <p className="mt-1.5 text-[15px] text-ink-600">El orden de esta lista es el orden del menú de tu tienda.</p>
        </header>
        <Button asChild variant="outline" className="h-10">
          <a href={storeUrl(store)} target="_blank" rel="noreferrer">
            <ExternalLink /> Ver en la tienda
          </a>
        </Button>
      </div>

      {cats.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4">
          <Stat
            label="En el menú de tu tienda"
            value={
              <>
                {visible} <span className="text-base font-bold text-ink-400 sm:text-lg">de {cats.length}</span>
              </>
            }
            sub={hidden === 0 ? "Todas a la vista." : `${plural(hidden, "oculta", "ocultas")}, la${hidden === 1 ? "" : "s"} guardas para después.`}
          />
          <Stat
            className="hidden sm:flex"
            label="La que más vende"
            value={top ? top.name : "—"}
            sub={
              top
                ? `${share(top.salesUsd)}% de lo vendido en 30 días, con ${plural(top.productCount, "producto", "productos")}.`
                : "Sin ventas en los últimos 30 días."
            }
          />
          <Stat
            tone={uncategorized > 0 ? "warn" : undefined}
            label="Productos sin categoría"
            value={String(uncategorized)}
            sub={
              uncategorized > 0 ? (
                <>
                  No salen al filtrar por categoría.{" "}
                  <Link href="/panel/productos?cat=ninguna" className="font-semibold underline underline-offset-2">
                    Asignarles una
                  </Link>
                </>
              ) : (
                "Todos tienen la suya."
              )
            }
          />
        </div>
      )}

      <CategoriesManager initial={initial} storeName={store.name} aside={aside} />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  tone?: "warn";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-3 sm:p-5",
        tone === "warn" && "border-[#F5DE7A] bg-[#FFFBEB] text-[#5A4300]",
        className,
      )}
    >
      <p className={cn("text-[11.5px] font-semibold leading-snug text-ink-600 sm:text-[13px]", tone === "warn" && "text-[#6B5300]")}>
        {label}
      </p>
      <p className="truncate font-display text-xl font-extrabold tracking-[-0.02em] tabular-nums sm:text-[1.65rem]">
        {value}
      </p>
      <p className={cn("text-[11.5px] leading-snug text-ink-500 sm:text-[12.5px]", tone === "warn" && "text-[#6B5300]")}>
        {sub}
      </p>
    </section>
  );
}
