import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Category, Product, ProductVariant, Store } from "@/types/database";

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

/** Active products for the public catalog, with optional search/category. */
export async function getStoreProducts(
  storeId: string,
  filters: CatalogFilters = {},
): Promise<Product[]> {
  const supabase = createClient();
  let query = supabase
    .from("products")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

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
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .eq("slug", productSlug)
      .eq("status", "active")
      .maybeSingle();
    return data ?? null;
  },
);

/** Active variants of a product, in display order. */
export const getStoreProductVariants = cache(
  async (productId: string): Promise<ProductVariant[]> => {
    const supabase = createClient();
    const { data } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("position");
    return data ?? [];
  },
);

/** Whether a product is purchasable given its stock settings. */
export function isAvailable(product: Pick<Product, "track_stock" | "stock">): boolean {
  return !product.track_stock || product.stock > 0;
}
