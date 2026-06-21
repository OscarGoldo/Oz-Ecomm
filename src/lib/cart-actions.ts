"use server";

import { cookies } from "next/headers";

import { CART_COOKIE, readCart, type Cart } from "@/lib/cart";

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

export async function addToCart(
  storeId: string,
  productId: string,
  qty = 1,
): Promise<CartActionResult> {
  const cart = currentFor(storeId);
  const existing = cart.items.find((i) => i.id === productId);
  if (existing) {
    existing.qty = Math.min(MAX_QTY, existing.qty + qty);
  } else {
    cart.items.push({ id: productId, qty: Math.min(MAX_QTY, Math.max(1, qty)) });
  }
  writeCart(cart);
  return { ok: true, count: count(cart) };
}

export async function updateCartItem(
  storeId: string,
  productId: string,
  qty: number,
): Promise<CartActionResult> {
  const cart = currentFor(storeId);
  if (qty <= 0) {
    cart.items = cart.items.filter((i) => i.id !== productId);
  } else {
    const item = cart.items.find((i) => i.id === productId);
    if (item) item.qty = Math.min(MAX_QTY, Math.floor(qty));
    else cart.items.push({ id: productId, qty: Math.min(MAX_QTY, qty) });
  }
  writeCart(cart);
  return { ok: true, count: count(cart) };
}

export async function removeCartItem(
  storeId: string,
  productId: string,
): Promise<CartActionResult> {
  const cart = currentFor(storeId);
  cart.items = cart.items.filter((i) => i.id !== productId);
  writeCart(cart);
  return { ok: true, count: count(cart) };
}

export async function clearCart(storeId: string): Promise<void> {
  writeCart({ storeId, items: [] });
}
