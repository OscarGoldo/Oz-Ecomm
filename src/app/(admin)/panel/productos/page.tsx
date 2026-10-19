import Link from "next/link";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AlertTriangle, Camera, Package, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ProductGrid,
  ProductRows,
  type CatalogItem,
} from "@/components/admin/catalog-products";
import { ProductsFilters } from "@/components/admin/products-filters";
import { aiProductsAvailable } from "@/lib/ai-products";
import { requireStoreUser } from "@/lib/auth";
import {
  getCatalogActivity,
  listCatalog,
  missingCost,
  productWarning,
  type CatalogProductRow,
  type ProductActivity,
} from "@/lib/catalog-stats";
import {
  PRODUCTS_VIEW_COOKIE,
  isProductSort,
  type ProductSort,
  type ProductsView,
} from "@/lib/catalog-view";
import { planLimits } from "@/lib/plans";
import { getImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Productos" };

/**
 * De a cuántos se muestran. El catálogo se lee entero (ver catalog-stats.ts),
 * pero pintar 2.000 tarjetas con su foto en cada carga no: se muestran 40 y
 * "Ver más" suma otros 40.
 */
const PRODUCTS_PAGE_SIZE = 40;

const FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "activos", label: "A la venta" },
  { id: "borradores", label: "Borradores" },
  { id: "archivados", label: "Archivados" },
  { id: "stock-bajo", label: "Stock bajo", dot: "bg-[#D97706]" },
  { id: "agotados", label: "Agotados", dot: "bg-[#eb6834]" },
  { id: "sin-foto", label: "Sin foto", dot: "bg-[#BFCEDD]" },
  { id: "sin-costo", label: "Sin costo", dot: "bg-[#BFCEDD]" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const isLow = (p: CatalogProductRow) =>
  p.track_stock && p.stock > 0 && p.stock <= p.low_stock_threshold;
const isOut = (p: CatalogProductRow) => p.track_stock && p.stock <= 0;

/** Los avisos de stock y foto no cuentan lo archivado: ya no se vende. */
const MATCH: Record<FilterId, (p: CatalogProductRow) => boolean> = {
  todos: () => true,
  activos: (p) => p.status === "active",
  borradores: (p) => p.status === "draft",
  archivados: (p) => p.status === "archived",
  "stock-bajo": (p) => p.status !== "archived" && isLow(p),
  agotados: (p) => p.status !== "archived" && isOut(p),
  "sin-foto": (p) => p.status !== "archived" && p.images.length === 0,
  "sin-costo": (p) => p.status === "active" && missingCost(p),
};

/** Los enlaces viejos usaban ?status=active|draft|archived. */
const LEGACY_STATUS: Record<string, FilterId> = {
  active: "activos",
  draft: "borradores",
  archived: "archivados",
};

/** Sin mayúsculas ni tildes: "camisa" encuentra "Camisá". */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function sortProducts(
  list: CatalogProductRow[],
  sort: ProductSort,
  activity: Map<string, ProductActivity>,
): CatalogProductRow[] {
  const sold = (p: CatalogProductRow) => activity.get(p.id)?.sold ?? 0;
  const views = (p: CatalogProductRow) => activity.get(p.id)?.views ?? 0;
  // `list` ya viene del más nuevo al más viejo: con sort estable, los empates
  // quedan en ese orden.
  const by: Record<ProductSort, (a: CatalogProductRow, b: CatalogProductRow) => number> = {
    vendidos: (a, b) => sold(b) - sold(a) || views(b) - views(a),
    vistos: (a, b) => views(b) - views(a) || sold(b) - sold(a),
    recientes: () => 0,
    "precio-menor": (a, b) => Number(a.price) - Number(b.price),
    "precio-mayor": (a, b) => Number(b.price) - Number(a.price),
    // Los que no llevan control de stock van al final.
    stock: (a, b) =>
      (a.track_stock ? a.stock : Infinity) - (b.track_stock ? b.stock : Infinity),
    nombre: (a, b) => a.name.localeCompare(b.name, "es"),
  };
  return [...list].sort(by[sort]);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    cat?: string;
    filtro?: string;
    orden?: string;
    ver?: string;
    status?: string;
  };
}) {
  const { store } = await requireStoreUser();
  const supabase = createClient();

  const [{ data: categories }, products, activity] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name")
      .eq("store_id", store.id)
      .order("display_order"),
    listCatalog(store.id),
    getCatalogActivity(store.id),
  ]);

  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const categoryOf = (p: CatalogProductRow) =>
    (p.category_id && catName.get(p.category_id)) || null;

  const filter: FilterId = FILTERS.some((f) => f.id === searchParams.filtro)
    ? (searchParams.filtro as FilterId)
    : (LEGACY_STATUS[searchParams.status ?? ""] ?? "todos");
  const sort: ProductSort = isProductSort(searchParams.orden) ? searchParams.orden : "vendidos";
  const q = searchParams.q?.trim() ?? "";
  const cat = searchParams.cat ?? "";
  const view: ProductsView = cookies().get(PRODUCTS_VIEW_COOKIE)?.value === "lista" ? "lista" : "fotos";

  // Búsqueda y categoría primero: las pestañas cuentan dentro de eso.
  const needle = fold(q);
  const scoped = products.filter((p) => {
    if (cat === "ninguna" ? categoryOf(p) !== null : cat && p.category_id !== cat) return false;
    if (needle && !fold(p.name).includes(needle) && !fold(p.sku ?? "").includes(needle)) {
      return false;
    }
    return true;
  });
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.id, scoped.filter(MATCH[f.id]).length]),
  ) as Record<FilterId, number>;

  const sorted = sortProducts(scoped.filter(MATCH[filter]), sort, activity);
  const shown = Math.min(
    2000,
    Math.max(PRODUCTS_PAGE_SIZE, Number(searchParams.ver) || PRODUCTS_PAGE_SIZE),
  );
  const hasMore = sorted.length > shown;
  const items: CatalogItem[] = sorted.slice(0, shown).map((p) => {
    const a = activity.get(p.id);
    return {
      id: p.id,
      name: p.name,
      category: categoryOf(p),
      price: Number(p.price),
      compareAt: p.compare_at_price == null ? null : Number(p.compare_at_price),
      cover: getImageUrl(p.images[0]),
      status: p.status,
      featured: p.featured,
      trackStock: p.track_stock,
      stock: p.stock,
      lowThreshold: p.low_stock_threshold,
      views: a?.views ?? 0,
      sold: a?.sold ?? 0,
      warning: productWarning(p, a),
    };
  });

  const hasFilters = Boolean(q || cat || filter !== "todos");
  const uncategorized = products.some((p) => categoryOf(p) === null);
  const activeCount = products.filter((p) => p.status === "active").length;

  // Cupo del plan: cuenta lo que no está archivado.
  const { maxProducts } = planLimits(store);
  const capped = Number.isFinite(maxProducts);
  const used = products.filter((p) => p.status !== "archived").length;
  const atLimit = capped && used >= maxProducts;
  const photosAvailable = aiProductsAvailable();

  function href(next: Record<string, string | null>): string {
    const sp = new URLSearchParams();
    const merged: Record<string, string | null> = {
      q: q || null,
      cat: cat || null,
      filtro: filter === "todos" ? null : filter,
      orden: sort === "vendidos" ? null : sort,
      ...next,
    };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/panel/productos?${s}` : "/panel/productos";
  }

  // ── Para mirar: lo que conviene arreglar hoy ──
  const notes: ReactNode[] = [];
  if (!hasFilters) {
    const outs = products
      .filter((p) => p.status === "active" && isOut(p))
      .sort((a, b) => (activity.get(b.id)?.views ?? 0) - (activity.get(a.id)?.views ?? 0));
    const top = outs[0];
    if (top) {
      const v = activity.get(top.id)?.views ?? 0;
      const name = (
        <Link href={`/panel/productos/${top.id}`} className="font-bold text-[#3D2E00] underline-offset-2 hover:underline">
          {top.name}
        </Link>
      );
      notes.push(
        outs.length === 1 ? (
          <span key="out">
            {name} está agotado{v >= 5 ? ` y tuvo ${v} visitas en 30 días` : ""}.
          </span>
        ) : (
          <span key="out">
            <Link href={href({ filtro: "agotados" })} className="font-bold text-[#3D2E00] underline-offset-2 hover:underline">
              {outs.length} agotados
            </Link>
            {v >= 5 ? <>; {name} tuvo {v} visitas en 30 días</> : ""}.
          </span>
        ),
      );
    }
    const low = products.filter((p) => p.status === "active" && isLow(p)).length;
    if (low > 0) {
      notes.push(
        <span key="low">
          <Link href={href({ filtro: "stock-bajo" })} className="font-bold text-[#3D2E00] underline-offset-2 hover:underline">
            {plural(low, "producto", "productos")}
          </Link>{" "}
          con stock bajo.
        </span>,
      );
    }
    const noCost = counts["sin-costo"];
    if (noCost > 0) {
      notes.push(
        <span key="cost">
          <Link href={href({ filtro: "sin-costo" })} className="font-bold text-[#3D2E00] underline-offset-2 hover:underline">
            {plural(noCost, "producto", "productos")}
          </Link>{" "}
          sin costo cargado: su ganancia no se puede calcular.
        </span>,
      );
    }
    const noPhoto = products.filter((p) => p.status === "active" && p.images.length === 0).length;
    if (noPhoto > 0 && notes.length < 3) {
      notes.push(
        <span key="photo">
          <Link href={href({ filtro: "sin-foto" })} className="font-bold text-[#3D2E00] underline-offset-2 hover:underline">
            {plural(noPhoto, "producto", "productos")}
          </Link>{" "}
          a la venta sin foto.
        </span>,
      );
    }
  }

  const statusTabs = FILTERS.slice(0, 4);
  const healthTabs = FILTERS.slice(4);
  const visibleTab = (id: FilterId) =>
    id === "todos" || id === "activos" || id === filter || counts[id] > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <header>
          <p className="font-landing-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            Catálogo · productos
          </p>
          <h1 className="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.028em]">Productos</h1>
          <p className="mt-1.5 text-[15px] text-ink-600">
            {products.length === 0
              ? "Lo que vendes, con su foto, precio y stock."
              : `${plural(products.length, "producto", "productos")} · ${activeCount} a la venta en tu tienda`}
            {capped && products.length > 0 && ` · ${used}/${maxProducts} del plan Gratis`}
          </p>
        </header>
        {atLimit ? (
          <Button asChild variant="outline">
            <Link href="/panel/plan">
              <Sparkles /> Activar Pro
            </Link>
          </Button>
        ) : (
          <div className="flex shrink-0 gap-2">
            {photosAvailable && (
              <Button asChild variant="outline" className="h-10">
                <Link href="/panel/productos/fotos">
                  <Camera /> <span className="hidden sm:inline">Cargar con fotos</span>
                  <span className="sm:hidden">Fotos</span>
                </Link>
              </Button>
            )}
            <Button asChild className="h-10">
              <Link href="/panel/productos/nuevo">
                <Plus /> <span className="hidden sm:inline">Nuevo producto</span>
                <span className="sm:hidden">Nuevo</span>
              </Link>
            </Button>
          </div>
        )}
      </div>

      {atLimit && (
        <p className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm">
          Llegaste a los {maxProducts} productos del plan Gratis. Tus productos
          siguen publicados y puedes seguir editándolos;{" "}
          <Link href="/panel/plan" className="font-medium text-brand-700 underline">
            activa Pro
          </Link>{" "}
          para cargar más.
        </p>
      )}

      {products.length > 0 && (
        <>
          <nav
            aria-label="Filtrar productos"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0"
          >
            {statusTabs.filter((f) => visibleTab(f.id)).map((f) => (
              <FilterTab key={f.id} href={href({ filtro: f.id === "todos" ? null : f.id })} label={f.label} count={counts[f.id]} active={f.id === filter} />
            ))}
            {healthTabs.some((f) => visibleTab(f.id)) && (
              <span aria-hidden="true" className="mx-1 hidden h-[22px] w-px shrink-0 self-center bg-linea md:block" />
            )}
            {healthTabs.filter((f) => visibleTab(f.id)).map((f) => (
              <FilterTab key={f.id} href={href({ filtro: f.id })} label={f.label} count={counts[f.id]} active={f.id === filter} dot={"dot" in f ? f.dot : undefined} />
            ))}
          </nav>

          {notes.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-[#F5DE7A] bg-[#FFF8DB] px-4 py-3 text-[13.5px] leading-[1.45] text-[#5A4300]">
              <AlertTriangle className="mt-px size-[18px] shrink-0 text-[#92400E]" aria-hidden="true" />
              <p className="flex flex-wrap gap-x-5 gap-y-1">{notes}</p>
            </div>
          )}

          <ProductsFilters
            categories={categories ?? []}
            uncategorized={uncategorized}
            sort={sort}
            view={view}
          />
        </>
      )}

      {items.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-12 text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Package className="size-6" />
          </span>
          <p className="font-medium">
            {products.length > 0 ? "Sin resultados" : "Todavía no cargaste productos"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {products.length > 0
              ? "Prueba con otra búsqueda o quita los filtros."
              : photosAvailable
                ? "Sube fotos de lo que vendes y la IA escribe nombre, descripción y categoría. Tú solo pones el precio."
                : "Crea tu primer producto para empezar a vender."}
          </p>
          {products.length > 0 ? (
            <Button asChild variant="outline" className="mt-4">
              <Link href="/panel/productos">Quitar filtros</Link>
            </Button>
          ) : (
            // La tienda vacía es la que más se beneficia de cargar con fotos:
            // ahí va como acción principal.
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {photosAvailable && (
                <Button asChild>
                  <Link href="/panel/productos/fotos">
                    <Camera /> Cargar con fotos
                  </Link>
                </Button>
              )}
              <Button asChild variant={photosAvailable ? "outline" : "default"}>
                <Link href="/panel/productos/nuevo">
                  <Plus /> {photosAvailable ? "Uno por uno" : "Nuevo producto"}
                </Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Las tarjetas con foto necesitan ancho: en pantallas chicas, filas. */}
          {view === "fotos" && <ProductGrid items={items} className="hidden lg:grid" />}
          <ProductRows items={items} className={cn(view === "fotos" && "lg:hidden")} />
        </>
      )}

      {hasMore && (
        <div className="flex flex-col items-center gap-1.5 pt-1">
          <Link
            href={href({ ver: String(shown + PRODUCTS_PAGE_SIZE) })}
            prefetch={false}
            scroll={false}
            className="inline-flex h-11 items-center rounded-lg border bg-card px-5 text-sm font-medium hover:bg-muted"
          >
            Ver más productos
          </Link>
          <p className="text-xs text-ink-500">
            Viendo {items.length} de {sorted.length}
          </p>
        </div>
      )}
    </div>
  );
}

function FilterTab({
  href,
  label,
  count,
  active,
  dot,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  dot?: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-3.5 text-[13px] font-semibold text-pizarra transition-colors hover:border-[#C2CFDC] hover:text-foreground",
        active && "border-noche bg-noche text-white hover:border-noche hover:text-white",
      )}
    >
      {dot && <span className={cn("size-[7px] rounded-full", dot)} aria-hidden="true" />}
      {label}
      <span className={cn("font-landing-mono text-xs tabular-nums", active ? "text-niebla" : "text-ink-400")}>
        {count}
      </span>
    </Link>
  );
}
