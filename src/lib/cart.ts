import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { usdToBs } from "@/lib/format";
import type { Product, Store } from "@/types/database";

export const CART_COOKIE = "oz_cart";
const MAX_QTY_PER_ITEM = 99;

export interface CartItem {
  id: string; // product id
  qty: number;
  variantId?: string | null;
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
  variantId: string | null;
  variantName: string | null;
  qty: number;
  /** qty clamped to available stock (if tracked). */
  available: number;
  /** Effective unit price (variant override or product price). */
  unitPriceUsd: number;
  lineTotalUsd: number;
}

/**
 * Un ajuste que el carrito le hizo al pedido del cliente sin que él lo pidiera.
 * Existe para poder AVISARLO: antes las líneas sin stock desaparecían y las
 * cantidades se recortaban en silencio, así que alguien podía poner 5, pagar 2
 * y enterarse recién cuando le llegaba el pedido.
 */
export interface CartChange {
  name: string;
  kind: "removed" | "clamped";
  /** Cuántas quedaron, en el caso de un recorte. */
  available?: number;
}

export interface EnrichedCart {
  lines: CartLine[];
  count: number;
  subtotalUsd: number;
  subtotalBs: number | null;
  exchangeRate: number | null;
  showBs: boolean;
  /** Qué se quitó o se recortó al armar este carrito. Vacío si no cambió nada. */
  changes: CartChange[];
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
        .map((i) => ({
          id: i.id,
          qty: Math.min(MAX_QTY_PER_ITEM, Math.floor(i.qty)),
          variantId: typeof i.variantId === "string" ? i.variantId : null,
        }));
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
      changes: [],
    };
  }

  // Service role: desde la migración 0021 el rol anónimo no lee `products`
  // (la policy pública se eliminó para que `cost` dejara de ser público). El
  // aislamiento acá lo dan los filtros explícitos de store_id.
  const supabase = createAdminClient();
  const ids = cart.items.map((i) => i.id);
  const variantIds = cart.items
    .map((i) => i.variantId)
    .filter((v): v is string => Boolean(v));

  const [{ data: products }, { data: variants }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, slug, price, images, track_stock, stock")
      .eq("store_id", store.id)
      .eq("status", "active")
      .in("id", ids),
    variantIds.length > 0
      ? supabase
          .from("product_variants")
          .select("id, product_id, name, price, stock, active")
          .eq("store_id", store.id)
          .in("id", variantIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));

  const lines: CartLine[] = [];
  const changes: CartChange[] = [];
  for (const item of cart.items) {
    const product = byId.get(item.id);
    if (!product) {
      // No sabemos el nombre: el producto ya no está activo ni se pudo leer.
      changes.push({ name: "Un producto", kind: "removed" });
      continue;
    }

    if (item.variantId) {
      const variant = variantById.get(item.variantId);
      if (!variant || variant.product_id !== product.id || !variant.active) {
        changes.push({ name: product.name, kind: "removed" });
        continue;
      }
      const unitPrice = variant.price != null ? variant.price : product.price;
      const available = Math.min(item.qty, variant.stock);
      const label = `${product.name} ${variant.name}`;
      if (available <= 0) {
        changes.push({ name: label, kind: "removed" });
        continue;
      }
      if (available < item.qty) {
        changes.push({ name: label, kind: "clamped", available });
      }
      lines.push({
        product: { ...product, track_stock: true, stock: variant.stock },
        variantId: variant.id,
        variantName: variant.name,
        qty: item.qty,
        available,
        unitPriceUsd: unitPrice,
        lineTotalUsd: unitPrice * available,
      });
      continue;
    }

    const available = product.track_stock
      ? Math.min(item.qty, product.stock)
      : item.qty;
    if (available <= 0) {
      changes.push({ name: product.name, kind: "removed" });
      continue;
    }
    if (available < item.qty) {
      changes.push({ name: product.name, kind: "clamped", available });
    }
    lines.push({
      product,
      variantId: null,
      variantName: null,
      qty: item.qty,
      available,
      unitPriceUsd: product.price,
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
    changes,
  };
}
