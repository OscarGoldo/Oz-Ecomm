"use server";

import { cookies } from "next/headers";

import {
  CART_COOKIE,
  getEnrichedCart,
  readCart,
  type Cart,
  type CartItem,
} from "@/lib/cart";
import { recordEvent } from "@/lib/analytics";

const MAX_QTY = 99;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function writeCart(cart: Cart) {
  cookies().set(CART_COOKIE, JSON.stringify(cart), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

function currentFor(storeId: string): Cart {
  const cart = readCart();
  // Switching stores starts a fresh cart.
  if (!cart || cart.storeId !== storeId) return { storeId, items: [] };
  return { storeId, items: [...cart.items] };
}

export interface CartActionResult {
  ok: boolean;
  count: number;
}

function count(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.qty, 0);
}

/** Same cart line = same product AND same variant (null for simple products). */
function matches(item: CartItem, productId: string, variantId: string | null) {
  return item.id === productId && (item.variantId ?? null) === variantId;
}

export async function addToCart(
  storeId: string,
  productId: string,
  qty = 1,
  variantId: string | null = null,
): Promise<CartActionResult> {
  const cart = currentFor(storeId);
  const existing = cart.items.find((i) => matches(i, productId, variantId));
  if (existing) {
    existing.qty = Math.min(MAX_QTY, existing.qty + qty);
  } else {
    cart.items.push({
      id: productId,
      qty: Math.min(MAX_QTY, Math.max(1, qty)),
      variantId,
    });
  }
  writeCart(cart);
  await recordEvent(storeId, "add_to_cart", productId);
  return { ok: true, count: count(cart) };
}

export async function updateCartItem(
  storeId: string,
  productId: string,
  variantId: string | null,
  qty: number,
): Promise<CartActionResult> {
  const cart = currentFor(storeId);
  if (qty <= 0) {
    cart.items = cart.items.filter((i) => !matches(i, productId, variantId));
  } else {
    const item = cart.items.find((i) => matches(i, productId, variantId));
    if (item) item.qty = Math.min(MAX_QTY, Math.floor(qty));
    else cart.items.push({ id: productId, qty: Math.min(MAX_QTY, qty), variantId });
  }
  writeCart(cart);
  return { ok: true, count: count(cart) };
}

export async function removeCartItem(
  storeId: string,
  productId: string,
  variantId: string | null = null,
): Promise<CartActionResult> {
  const cart = currentFor(storeId);
  cart.items = cart.items.filter((i) => !matches(i, productId, variantId));
  writeCart(cart);
  return { ok: true, count: count(cart) };
}

export async function clearCart(storeId: string): Promise<void> {
  writeCart({ storeId, items: [] });
}

/**
 * Deja la cookie igual al carrito que el cliente ve.
 *
 * `getEnrichedCart` ya descarta lo que no se puede comprar (producto
 * despublicado o borrado, variante apagada, sin stock) y recorta cantidades al
 * stock, pero solo en pantalla: la cookie seguía con todo. El contador del
 * header sumaba lo que no se veía, y al confirmar el servidor —que lee la
 * cookie— rechazaba el pedido por un producto que el cliente no podía ver ni
 * quitar. La compra quedaba trabada hasta que borrara las cookies.
 *
 * Vive acá y no en la página porque un Server Component no puede escribir
 * cookies: la llama `CartReconciler` apenas la página detecta un ajuste.
 */
export async function reconcileCart(storeId: string): Promise<CartActionResult> {
  // Solo importa qué líneas sobreviven; la tasa no juega en eso.
  const enriched = await getEnrichedCart({
    id: storeId,
    exchange_rate: null,
    show_bs_prices: false,
  });
  // Sin ajustes no se toca nada. Esto también cubre la cookie de otra tienda,
  // que getEnrichedCart ve como carrito vacío.
  if (enriched.changes.length === 0) {
    return { ok: true, count: enriched.count };
  }
  const cart: Cart = {
    storeId,
    items: enriched.lines.map((l) => ({
      id: l.product.id,
      qty: l.available,
      variantId: l.variantId,
    })),
  };
  writeCart(cart);
  return { ok: true, count: count(cart) };
}
