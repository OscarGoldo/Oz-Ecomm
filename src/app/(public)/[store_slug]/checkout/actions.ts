"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { readCartForStore } from "@/lib/cart";
import { clearCart } from "@/lib/cart-actions";
import { formatUSD, usdToBs } from "@/lib/format";
import { newOrderEmail, sendEmail } from "@/lib/email";
import { evaluateCoupon, findCouponByCode } from "@/lib/coupons";
import type { Coupon, CouponType, OrderStatus } from "@/types/database";

const checkoutSchema = z.object({
  store_id: z.string().uuid(),
  customer_name: z.string().trim().min(2, "Ingresá tu nombre"),
  customer_phone: z.string().trim().min(6, "Ingresá un teléfono válido"),
  customer_email: z
    .string()
    .trim()
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  fulfillment_type: z.enum(["delivery", "pickup"]),
  delivery_address: z.string().trim().optional(),
  delivery_notes: z.string().trim().optional(),
  payment_method_id: z.string().uuid("Elegí un método de pago"),
  payment_reference: z.string().trim().optional(),
  payment_proof_path: z.string().trim().optional(),
  coupon_code: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;

export interface CheckoutResult {
  ok: boolean;
  error?: string;
  orderId?: string;
}

export interface CouponPreview {
  ok: boolean;
  error?: string;
  type?: CouponType;
  /** Discount on the subtotal (USD). */
  discount?: number;
  freeShipping?: boolean;
  code?: string;
}

/** Validate a coupon for the checkout (preview before submitting). */
export async function previewCoupon(
  storeId: string,
  code: string,
  subtotalUsd: number,
): Promise<CouponPreview> {
  if (!code.trim()) return { ok: false, error: "Ingresá un código" };
  const coupon = await findCouponByCode(storeId, code);
  if (!coupon) return { ok: false, error: "El cupón no es válido" };
  const result = evaluateCoupon(coupon, subtotalUsd);
  if (!result.valid) return { ok: false, error: result.reason ?? "Cupón no válido" };
  return {
    ok: true,
    type: coupon.type,
    discount: result.discount,
    freeShipping: result.freeShipping,
    code: coupon.code,
  };
}

export async function createOrder(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const db = createAdminClient();

  // Store (and its delivery options + rate snapshot).
  // select("*") so the new delivery-fee columns degrade gracefully if migration
  // 0004 hasn't been applied yet (they read as undefined → no shipping).
  const { data: store } = await db
    .from("stores")
    .select("*")
    .eq("id", data.store_id)
    .maybeSingle();
  if (!store || !store.active) {
    return { ok: false, error: "La tienda no está disponible" };
  }

  // Fulfillment validation.
  if (data.fulfillment_type === "delivery") {
    if (!store.offers_delivery) {
      return { ok: false, error: "La tienda no ofrece delivery" };
    }
    if (!data.delivery_address || data.delivery_address.length < 5) {
      return { ok: false, error: "Ingresá la dirección de entrega" };
    }
  } else if (!store.offers_pickup) {
    return { ok: false, error: "La tienda no ofrece retiro" };
  }

  // Payment method.
  const { data: method } = await db
    .from("payment_methods")
    .select("id, type, requires_proof, active")
    .eq("id", data.payment_method_id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!method || !method.active) {
    return { ok: false, error: "Método de pago no válido" };
  }
  if (method.requires_proof && !data.payment_proof_path) {
    return { ok: false, error: "Subí el comprobante de pago" };
  }

  // Cart (server-side source of truth).
  const cart = readCartForStore(store.id);
  if (cart.items.length === 0) {
    return { ok: false, error: "Tu carrito está vacío" };
  }

  const variantIds = cart.items
    .map((i) => i.variantId)
    .filter((v): v is string => Boolean(v));

  const [{ data: products }, { data: variants }] = await Promise.all([
    db
      .from("products")
      .select("id, name, price, cost, track_stock, stock, status, variant_options")
      .eq("store_id", store.id)
      .in(
        "id",
        cart.items.map((i) => i.id),
      ),
    variantIds.length > 0
      ? db
          .from("product_variants")
          .select("id, product_id, name, price, cost, stock, active")
          .in("id", variantIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));

  const orderItems: {
    product_id: string;
    product_name: string;
    variant_id: string | null;
    variant_name: string | null;
    quantity: number;
    unit_price: number;
    unit_cost: number;
    subtotal: number;
  }[] = [];
  const variantStockUpdates: { id: string; newStock: number }[] = [];
  const productDecrement = new Map<string, number>();

  for (const item of cart.items) {
    const product = byId.get(item.id);
    if (!product || product.status !== "active") {
      return { ok: false, error: "Un producto ya no está disponible. Revisá tu carrito." };
    }
    const qty = item.qty;

    if (item.variantId) {
      const variant = variantById.get(item.variantId);
      if (!variant || variant.product_id !== product.id || !variant.active) {
        return { ok: false, error: "Una variante ya no está disponible. Revisá tu carrito." };
      }
      if (variant.stock < qty) {
        return {
          ok: false,
          error: `Stock insuficiente de "${product.name} ${variant.name}" (quedan ${variant.stock}).`,
        };
      }
      const unitPrice = variant.price != null ? variant.price : product.price;
      const unitCost = variant.cost != null ? variant.cost : product.cost ?? 0;
      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        variant_id: variant.id,
        variant_name: variant.name,
        quantity: qty,
        unit_price: unitPrice,
        unit_cost: unitCost,
        subtotal: unitPrice * qty,
      });
      variantStockUpdates.push({ id: variant.id, newStock: variant.stock - qty });
      productDecrement.set(product.id, (productDecrement.get(product.id) ?? 0) + qty);
      continue;
    }

    // A variant product must be ordered with a chosen variant.
    const opts = product.variant_options;
    if (Array.isArray(opts) && opts.length > 0) {
      return { ok: false, error: `Elegí las opciones de "${product.name}".` };
    }

    if (product.track_stock && product.stock < qty) {
      return {
        ok: false,
        error: `Stock insuficiente de "${product.name}" (quedan ${product.stock}).`,
      };
    }
    orderItems.push({
      product_id: product.id,
      product_name: product.name,
      variant_id: null,
      variant_name: null,
      quantity: qty,
      unit_price: product.price,
      unit_cost: product.cost ?? 0,
      subtotal: product.price * qty,
    });
    if (product.track_stock) {
      productDecrement.set(product.id, (productDecrement.get(product.id) ?? 0) + qty);
    }
  }

  const subtotal = orderItems.reduce((s, i) => s + i.subtotal, 0);

  // Coupon (optional). Re-validated server-side against the real subtotal.
  let discount = 0;
  let couponFreeShipping = false;
  let appliedCoupon: Coupon | null = null;
  if (data.coupon_code && data.coupon_code.trim()) {
    const coupon = await findCouponByCode(store.id, data.coupon_code);
    if (!coupon) return { ok: false, error: "El cupón no es válido" };
    const result = evaluateCoupon(coupon, subtotal);
    if (!result.valid) return { ok: false, error: result.reason ?? "Cupón no válido" };
    discount = result.discount;
    couponFreeShipping = result.freeShipping;
    appliedCoupon = coupon;
  }

  // Shipping: flat delivery_fee for delivery orders, waived if subtotal reaches
  // the free-delivery threshold or a free-shipping coupon applies. Pickup free.
  const deliveryFee = Number(store.delivery_fee ?? 0);
  const freeMin = store.free_delivery_min;
  const baseShipping =
    data.fulfillment_type === "delivery" &&
    deliveryFee > 0 &&
    !(freeMin != null && subtotal >= Number(freeMin))
      ? deliveryFee
      : 0;
  const shipping = couponFreeShipping ? 0 : baseShipping;

  const total = Math.max(0, subtotal + shipping - discount);
  const totalBs = store.show_bs_prices
    ? usdToBs(total, store.exchange_rate)
    : null;

  // Cash → accepted immediately; proof methods → wait for owner confirmation.
  const status: OrderStatus = method.requires_proof
    ? "pending_confirmation"
    : "confirmed";

  const { data: order, error: orderErr } = await db
    .from("orders")
    .insert({
      store_id: store.id,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_email: data.customer_email ? data.customer_email : null,
      fulfillment_type: data.fulfillment_type,
      delivery_address:
        data.fulfillment_type === "delivery" ? data.delivery_address! : null,
      delivery_notes: data.delivery_notes || null,
      subtotal,
      shipping_cost: shipping,
      discount_total: discount,
      coupon_code: appliedCoupon ? appliedCoupon.code : null,
      total,
      currency: "USD",
      total_bs: totalBs,
      exchange_rate: store.exchange_rate,
      payment_method_type: method.type,
      payment_proof_url: data.payment_proof_path || null,
      payment_reference: data.payment_reference || null,
      status,
      notes: data.notes || null,
      confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
    })
    .select("id, order_number")
    .single();

  if (orderErr || !order) {
    return { ok: false, error: "No se pudo crear el pedido. Intentá de nuevo." };
  }

  const { error: itemsErr } = await db
    .from("order_items")
    .insert(orderItems.map((i) => ({ ...i, order_id: order.id })));
  if (itemsErr) {
    await db.from("orders").delete().eq("id", order.id);
    return { ok: false, error: "No se pudo crear el pedido. Intentá de nuevo." };
  }

  // Count the coupon use.
  if (appliedCoupon) {
    await db
      .from("coupons")
      .update({ times_used: appliedCoupon.times_used + 1 })
      .eq("id", appliedCoupon.id);
  }

  // Decrement stock now only for immediately-confirmed (cash) orders.
  // Proof orders decrement when the owner confirms payment (Phase 5).
  if (status === "confirmed") {
    await Promise.all([
      ...variantStockUpdates.map((u) =>
        db
          .from("product_variants")
          .update({ stock: Math.max(0, u.newStock) })
          .eq("id", u.id),
      ),
      ...[...productDecrement.entries()].map(([pid, dec]) => {
        const base = byId.get(pid)?.stock ?? 0;
        return db
          .from("products")
          .update({ stock: Math.max(0, base - dec) })
          .eq("id", pid);
      }),
    ]);
  }

  // Notify the store owner(s) by email (no-op if Resend isn't configured).
  try {
    const { data: owners } = await db
      .from("users")
      .select("email")
      .eq("store_id", store.id)
      .in("role", ["store_owner", "store_staff"])
      .eq("active", true);
    const recipients = (owners ?? [])
      .map((o) => o.email)
      .filter((e): e is string => Boolean(e));
    if (recipients.length > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const { subject, html } = newOrderEmail({
        storeName: store.name,
        orderNumber: order.order_number,
        customerName: data.customer_name,
        totalLabel: formatUSD(total),
        itemsCount: orderItems.reduce((s, i) => s + i.quantity, 0),
        fulfillmentLabel:
          data.fulfillment_type === "delivery" ? "Delivery" : "Retiro en tienda",
        orderUrl: `${appUrl}/panel/pedidos/${order.id}`,
      });
      await sendEmail({ to: recipients, subject, html });
    }
  } catch {
    // Never fail the order because of a notification problem.
  }

  await clearCart(store.id);
  return { ok: true, orderId: order.id };
}
