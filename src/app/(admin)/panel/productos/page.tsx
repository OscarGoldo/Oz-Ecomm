import Link from "next/link";
import Image from "next/image";
import { ImageOff, Package, Plus, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductStatusBadge } from "@/components/admin/status-badge";
import { ProductsFilters } from "@/components/admin/products-filters";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/format";
import { getImageUrl } from "@/lib/storage";
import type { Product, ProductStatus } from "@/types/database";

export const metadata = { title: "Productos" };

const STATUS_VALUES: ProductStatus[] = ["active", "draft", "archived"];

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: { q?: string; cat?: string; status?: string };
}) {
  const { store } = await requireStoreUser();
  const supabase = createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("store_id", store.id)
    .order("display_order");

  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));

  let query = supabase
    .from("products")
    .select("*")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  const q = searchParams.q?.trim();
  if (q) query = query.ilike("name", `%${q}%`);
  if (searchParams.cat) query = query.eq("category_id", searchParams.cat);
  if (
    searchParams.status &&
    STATUS_VALUES.includes(searchParams.status as ProductStatus)
  ) {
    query = query.eq("status", searchParams.status as ProductStatus);
  }

  const { data: products } = await query;
  const list = (products ?? []) as Product[];

  const hasFilters = Boolean(q || searchParams.cat || searchParams.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground">
            {list.length} {list.length === 1 ? "producto" : "productos"}
            {hasFilters ? " (filtrados)" : " en tu catálogo"}
          </p>
        </div>
        <Button asChild>
          <Link href="/panel/productos/nuevo">
            <Plus /> <span className="hidden sm:inline">Nuevo producto</span>
            <span className="sm:hidden">Nuevo</span>
          </Link>
        </Button>
      </div>

      <ProductsFilters categories={categories ?? []} />

      {list.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-12 text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Package className="size-6" />
          </span>
          <p className="font-medium">
            {hasFilters ? "Sin resultados" : "Todavía no cargaste productos"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {hasFilters
              ? "Probá con otra búsqueda o quitá los filtros."
              : "Creá tu primer producto para empezar a vender."}
          </p>
          {!hasFilters && (
            <Button asChild className="mt-4">
              <Link href="/panel/productos/nuevo">
                <Plus /> Nuevo producto
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((p) => {
            const cover = getImageUrl(p.images[0]);
            const category = p.category_id ? catName.get(p.category_id) : null;
            return (
              <li key={p.id}>
                <Link
                  href={`/panel/productos/${p.id}`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/50"
                >
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {cover ? (
                      <Image
                        src={cover}
                        alt={p.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="grid h-full place-items-center text-muted-foreground">
                        <ImageOff className="size-5" />
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {p.featured && (
                        <Star className="size-3.5 shrink-0 fill-primary text-primary" />
                      )}
                      <p className="truncate font-medium">{p.name}</p>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {category ?? "Sin categoría"}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <ProductStatusBadge status={p.status} />
                      <StockBadge product={p} />
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{formatUSD(p.price)}</p>
                    {p.compare_at_price != null && (
                      <p className="text-xs text-muted-foreground line-through">
                        {formatUSD(p.compare_at_price)}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StockBadge({ product }: { product: Product }) {
  if (!product.track_stock) {
    return <span className="text-xs text-muted-foreground">Stock libre</span>;
  }
  if (product.stock <= 0) {
    return <Badge variant="danger">Agotado</Badge>;
  }
  if (product.stock <= product.low_stock_threshold) {
    return <Badge variant="warning">Quedan {product.stock}</Badge>;
  }
  return <span className="text-xs text-muted-foreground">{product.stock} en stock</span>;
}
