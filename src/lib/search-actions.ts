"use server";

import { isPaused } from "@/lib/plans";
import {
  getProductSuggestions,
  getStoreBySlug,
  type ProductSuggestion,
} from "@/lib/storefront";

/**
 * La lista que abre el buscador de la tienda mientras se escribe.
 *
 * No muestra nada que la página no muestre ya con `?q=`: los mismos productos
 * activos de esa tienda, solo menos y con menos columnas.
 */
export async function suggestProducts(
  storeSlug: string,
  query: string,
): Promise<ProductSuggestion[]> {
  if (typeof storeSlug !== "string" || typeof query !== "string") return [];
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];

  const store = await getStoreBySlug(storeSlug);
  // Una tienda en pausa no enseña su catálogo (ver page.tsx).
  if (!store || isPaused(store)) return [];
  return getProductSuggestions(store.id, q);
}
