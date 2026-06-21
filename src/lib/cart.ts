import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { usdToBs } from "@/lib/format";
import type { Product, Store } from "@/types/database";

export const CART_COOKIE = "oz_cart";
const MAX_QTY_PER_ITEM = 99;

export interface CartItem {
  id: string; // product id
  qty: number;
}

export interface Cart {
  storeId: string;
  items: CartItem[];
}

export interface CartLine {
  product: Pick<
    Product,
    "id" | "name" | "slug" | "price" | "images" | "track_stock" | "stock"
  >;
  qty: number;
  /** qty clamped to available stock (if tracked). */
  available: number;
  lineTotalUsd: number;
}

export interface EnrichedCart {
  lines: CartLine[];
  count: number;
  subtotalUsd: number;
  subtotalBs: number | null;
  exchangeRate: number | null;
  showBs: boolean;
}

function parseCart(raw: string | undefined): Cart | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Cart).storeId === "string" &&
      Array.isArray((parsed as Cart).items)
    ) {
      const cart = parsed as Cart;
      const items = cart.items
        .filter(
          (i) => typeof i.id === "string" && Number.isFinite(i.qty) && i.qty > 0,
        )
        .map((i) => ({ id: i.id, qty: Math.min(MAX_QTY_PER_ITEM, Math.floor(i.qty)) }));
      return { storeId: cart.storeId, items };
    }
  } catch {
    // ignore malformed cookie
  }
  return null;
}

/** Read the cart cookie. Returns null if absent/invalid. */
export function readCart(): Cart | null {
  return parseCart(cookies().get(CART_COOKIE)?.value);
}

/** Read the cart only if it belongs to the given store. */
export function readCartForStore(storeId: string): Cart {
  const cart = readCart();
  if (!cart || cart.storeId !== storeId) return { storeId, items: [] };
  return cart;
}

/** Number of units in the cart for a store (for the header badge). */
export function getCartCount(storeId: string): number {
  return readCartForStore(storeId).items.reduce((sum, i) => sum + i.qty, 0);
}

/**
 * Build the cart for display: join current product data, recompute totals, and
 * drop items whose product is gone/inactive. Prices always come from the DB.
 */
export async function getEnrichedCart(
  store: Pick<Store, "id" | "exchange_rate" | "show_bs_prices">,
): Promise<EnrichedCart> {
  const cart = readCartForStore(store.id);
  if (cart.items.length === 0) {
    return {
      lines: [],
      count: 0,
      subtotalUsd: 0,
      subtotalBs: store.show_bs_prices ? 0 : null,
      exchangeRate: store.exchange_rate,
      showBs: store.show_bs_prices,
    };
  }

  const supabase = createClient();
  const ids = cart.items.map((i) => i.id);
  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, price, images, track_stock, stock")
    .eq("store_id", store.id)
    .eq("status", "active")
    .in("id", ids);

  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const lines: CartLine[] = [];
  for (const item of cart.items) {
    const product = byId.get(item.id);
    if (!product) continue;
    const available = product.track_stock
      ? Math.min(item.qty, product.stock)
      : item.qty;
    if (available <= 0) continue;
    lines.push({
      product,
      qty: item.qty,
      available,
      lineTotalUsd: product.price * available,
    });
  }

  const subtotalUsd = lines.reduce((sum, l) => sum + l.lineTotalUsd, 0);
  const count = lines.reduce((sum, l) => sum + l.available, 0);
  const subtotalBs = store.show_bs_prices
    ? (usdToBs(subtotalUsd, store.exchange_rate) ?? 0)
    : null;

  return {
    lines,
    count,
    subtotalUsd,
    subtotalBs,
    exchangeRate: store.exchange_rate,
    showBs: store.show_bs_prices,
  };
}
