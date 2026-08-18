import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Category, Product, ProductVariant, Store } from "@/types/database";

/**
 * Columnas del catálogo público. Se listan a mano y NO incluyen `cost`: ese es
 * el margen del comerciante y no tiene por qué viajar al navegador de nadie
 * (auditoría #4). Nunca cambies esto por `*` — `select("*")` volvería a
 * arrastrar el costo.
 */
// Ojo: tienen que ser literales de una sola pieza. Si los partís con `+`,
// supabase-js pierde la inferencia de tipos y todo pasa a `GenericStringError`.
const PUBLIC_PRODUCT_COLUMNS =
  "id, store_id, category_id, name, slug, description, price, currency, compare_at_price, stock, track_stock, low_stock_threshold, status, featured, images, sku, variant_options, created_at, updated_at";

const PUBLIC_VARIANT_COLUMNS =
  "id, product_id, store_id, option_values, name, price, stock, sku, active, position, created_at";

/**
 * Cliente para leer el catálogo público.
 *
 * Desde la migración 0021 el rol `anon` no tiene ningún permiso sobre
 * `products` ni `product_variants`: la policy de lectura pública se eliminó
 * porque RLS es por fila y no podía esconder la columna `cost`. El catálogo se
 * sirve entonces desde acá con service role, y el aislamiento entre tiendas lo
 * garantiza el `.eq("store_id", ...)` de cada consulta más el hecho de que el
 * store_id sale siempre de `getStoreBySlug()`, que ya exige `active = true`.
 *
 * Es el mismo patrón que ya usaba el seguimiento de pedidos. Regla al tocar
 * este archivo: TODA consulta lleva `store_id` y `status`, sin excepción.
 */
function publicDb() {
  return createAdminClient();
}

/**
 * Fetch an active store by slug. Cached per request so the layout and page can
 * both call it without a double query. Relies on the public-read RLS policy.
 */
export const getStoreBySlug = cache(
  async (slug: string): Promise<Store | null> => {
    const supabase = createClient();
    const { data } = await supabase
      .from("stores")
      .select("*")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();
    return data ?? null;
  },
);

/** Active categories for a store, in display order. */
export const getStoreCategories = cache(
  async (storeId: string): Promise<Pick<Category, "id" | "name" | "slug">[]> => {
    const supabase = createClient();
    const { data } = await supabase
      .from("categories")
      .select("id, name, slug")
      .eq("store_id", storeId)
      .eq("active", true)
      .order("display_order");
    return data ?? [];
  },
);

export interface CatalogFilters {
  q?: string;
  categorySlug?: string;
}

/**
 * Cuántos productos trae una página del catálogo.
 *
 * Antes no había techo: la home hacía un SELECT sin `limit` y renderizaba el
 * arreglo completo. Con 500 productos eso son 500 tarjetas en el HTML y 500
 * pedidos de optimización de imagen — sobre datos móviles, una home que no
 * termina de cargar nunca. 24 llena varias pantallas en celular y deja el peso
 * inicial acotado.
 */
export const CATALOG_PAGE_SIZE = 24;

export interface CatalogPage {
  products: Product[];
  /** Hay más para traer: se dibuja el botón "Ver más". */
  hasMore: boolean;
}

/**
 * Una página del catálogo público.
 *
 * Pide un producto de más que el límite para saber si hay siguiente sin pagar
 * un COUNT aparte, y lo descarta antes de devolver.
 */
export async function getStoreCatalogPage(
  storeId: string,
  filters: CatalogFilters = {},
  limit: number = CATALOG_PAGE_SIZE,
): Promise<CatalogPage> {
  const products = await getStoreProducts(storeId, filters, limit + 1);
  const hasMore = products.length > limit;
  return { products: hasMore ? products.slice(0, limit) : products, hasMore };
}

/** Active products for the public catalog, with optional search/category. */
export async function getStoreProducts(
  storeId: string,
  filters: CatalogFilters = {},
  limit?: number,
): Promise<Product[]> {
  const supabase = publicDb();
  let query = supabase
    .from("products")
    .select(PUBLIC_PRODUCT_COLUMNS)
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (limit != null) query = query.limit(limit);

  if (filters.q) query = query.ilike("name", `%${filters.q}%`);

  if (filters.categorySlug) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("store_id", storeId)
      .eq("slug", filters.categorySlug)
      .maybeSingle();
    if (cat) query = query.eq("category_id", cat.id);
    else return [];
  }

  const { data } = await query;
  return data ?? [];
}

/** A single active product by slug within a store. */
export const getStoreProduct = cache(
  async (storeId: string, productSlug: string): Promise<Product | null> => {
    const supabase = publicDb();
    const { data } = await supabase
      .from("products")
      .select(PUBLIC_PRODUCT_COLUMNS)
      .eq("store_id", storeId)
      .eq("slug", productSlug)
      .eq("status", "active")
      .maybeSingle();
    return data ?? null;
  },
);

/**
 * Active variants of a product, in display order.
 *
 * Lleva `storeId` además del `productId`: con service role el filtro de tienda
 * es responsabilidad de la consulta, no de RLS.
 */
export const getStoreProductVariants = cache(
  async (storeId: string, productId: string): Promise<ProductVariant[]> => {
    const supabase = publicDb();
    const { data } = await supabase
      .from("product_variants")
      .select(PUBLIC_VARIANT_COLUMNS)
      .eq("store_id", storeId)
      .eq("product_id", productId)
      .order("position");
    return data ?? [];
  },
);

/**
 * Products to suggest on a product page: same category first, then filled with
 * other active products from the store. Excludes the current product.
 */
export async function getRelatedProducts(
  storeId: string,
  current: Pick<Product, "id" | "category_id">,
  limit = 8,
): Promise<Product[]> {
  const supabase = publicDb();
  const results: Product[] = [];
  const seen = new Set<string>([current.id]);

  if (current.category_id) {
    const { data } = await supabase
      .from("products")
      .select(PUBLIC_PRODUCT_COLUMNS)
      .eq("store_id", storeId)
      .eq("status", "active")
      .eq("category_id", current.category_id)
      .neq("id", current.id)
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    for (const p of data ?? []) {
      results.push(p);
      seen.add(p.id);
    }
  }

  if (results.length < limit) {
    const { data } = await supabase
      .from("products")
      .select(PUBLIC_PRODUCT_COLUMNS)
      .eq("store_id", storeId)
      .eq("status", "active")
      .neq("id", current.id)
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit + results.length + 1);
    for (const p of data ?? []) {
      if (seen.has(p.id)) continue;
      results.push(p);
      seen.add(p.id);
      if (results.length >= limit) break;
    }
  }

  return results.slice(0, limit);
}

/** Whether a product is purchasable given its stock settings. */
export function isAvailable(product: Pick<Product, "track_stock" | "stock">): boolean {
  return !product.track_stock || product.stock > 0;
}
