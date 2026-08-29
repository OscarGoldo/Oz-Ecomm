"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/report-error";
import { getOrCreateSessionId, recordEvent } from "@/lib/analytics";
import { getEnrichedCart, readCartForStore } from "@/lib/cart";
import { clearCart } from "@/lib/cart-actions";
import { formatUSD, usdToBs } from "@/lib/format";
import {
  customerOrderReceiptEmail,
  newOrderEmail,
  sendEmail,
} from "@/lib/email";
import { buildOrderMessageData } from "@/lib/order-messages";
import { notifyOwnerNewOrder } from "@/lib/whatsapp-cloud";
import { evaluateCoupon, findCouponByCode } from "@/lib/coupons";
import { maybeQualifyReferral } from "@/lib/referrals-server";
import {
  capturePaypalOrder,
  createPaypalOrder,
  paypalCredsFromEnv,
} from "@/lib/paypal";
import type { Coupon, CouponType, OrderStatus } from "@/types/database";

const checkoutSchema = z.object({
  store_id: z.string().uuid(),
  customer_name: z.string().trim().min(2, "Ingresa tu nombre"),
  customer_phone: z.string().trim().min(6, "Ingresa un teléfono válido"),
  // Obligatorio: es el recibo del cliente y el dato que identifica a la misma
  // persona cuando escribe el teléfono distinto (ver lib/customer-identity.ts).
  customer_email: z
    .string()
    .trim()
    .min(1, "Ingresa tu email")
    .email("Email inválido"),
  fulfillment_type: z.enum(["delivery", "pickup"]),
  delivery_address: z.string().trim().optional(),
  delivery_notes: z.string().trim().optional(),
  payment_method_id: z.string().uuid("Elige un método de pago"),
  payment_reference: z.string().trim().optional(),
  payment_proof_path: z.string().trim().max(400).optional(),
  paypal_order_id: z.string().trim().optional(),
  coupon_code: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  /**
   * Clave que genera el navegador UNA sola vez al entrar al paso de pago y
   * reenvía en cada intento. Es lo que evita que una conexión que se corta a
   * mitad del envío termine en dos pedidos idénticos: el índice UNIQUE
   * (store_id, idempotency_key) deja pasar solo al primero.
   */
  idempotency_key: z.string().trim().min(8).max(64).optional(),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
type CheckoutData = z.infer<typeof checkoutSchema>;

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
  if (!code.trim()) return { ok: false, error: "Ingresa un código" };
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

const leadSchema = z.object({
  store_id: z.string().uuid(),
  customer_name: z.string().trim().min(2),
  customer_phone: z.string().trim().min(6),
  customer_email: z.string().trim().email().optional().or(z.literal("")),
  fulfillment_type: z.enum(["delivery", "pickup"]),
});

export type CheckoutLeadInput = z.input<typeof leadSchema>;

/**
 * Guarda el carrito abandonado al pasar el paso 1 del checkout.
 *
 * Se llama cuando el cliente ya dio nombre y teléfono válidos para comprar —
 * antes de eso no hay dato que guardar. Es fire-and-forget: si algo falla, el
 * checkout sigue como si nada. La fila se reemplaza por (store_id, session_id),
 * así volver atrás y corregir un dato no genera carritos duplicados.
 */
export async function saveCheckoutLead(
  input: CheckoutLeadInput,
): Promise<void> {
  try {
    const parsed = leadSchema.safeParse(input);
    if (!parsed.success) return;
    const data = parsed.data;

    const db = createAdminClient();
    const { data: store } = await db
      .from("stores")
      .select("id, active, exchange_rate, show_bs_prices")
      .eq("id", data.store_id)
      .maybeSingle();
    if (!store || !store.active) return;

    const cart = await getEnrichedCart(store);
    if (cart.lines.length === 0) return;

    await db.from("abandoned_carts").upsert(
      {
        store_id: store.id,
        session_id: getOrCreateSessionId(),
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email || null,
        fulfillment_type: data.fulfillment_type,
        items: cart.lines.map((l) => ({
          name: l.product.name,
          variant: l.variantName,
          qty: l.available,
          price: l.unitPriceUsd,
        })),
        items_count: cart.count,
        subtotal: cart.subtotalUsd,
        // Retomar el checkout reabre el carrito: se limpian las marcas previas
        // para que vuelva a la lista de pendientes del comerciante.
        recovered_order_id: null,
        recovered_at: null,
        dismissed_at: null,
      },
      { onConflict: "store_id,session_id" },
    );
  } catch (e) {
    // Capturar el lead nunca puede estorbar una compra en curso, pero que
    // quede registrado: si esto falla siempre, el comerciante pierde una
    // función entera y hoy nadie se enteraría.
    reportError("saveCheckoutLead", e, { storeId: input.store_id });
  }
}

type AdminDb = ReturnType<typeof createAdminClient>;

interface OrderItemDraft {
  product_id: string;
  product_name: string;
  variant_id: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  subtotal: number;
}

interface OrderDraft {
  store: Record<string, unknown> & {
    id: string;
    name: string;
    slug: string;
    /** Para avisarle al comerciante por WhatsApp cuando entra el pedido. */
    whatsapp: string | null;
    pickup_address: string | null;
    active: boolean;
    show_bs_prices: boolean;
    exchange_rate: number | null;
    offers_delivery: boolean;
    offers_pickup: boolean;
    delivery_fee: number | null;
    free_delivery_min: number | null;
  };
  method: {
    id: string;
    type: string;
    requires_proof: boolean;
    active: boolean;
    details: unknown;
  };
  orderItems: OrderItemDraft[];
  subtotal: number;
  discount: number;
  couponFreeShipping: boolean;
  appliedCoupon: Coupon | null;
  shipping: number;
  total: number;
  totalBs: number | null;
  /** Per-line stock decrements applied atomically via commit_order_stock(). */
  stockOps: { product_id: string; variant_id: string | null; qty: number }[];
}

/**
 * Validate the request + cart and compute the order draft (items, totals,
 * stock changes). Shared by the manual checkout and the PayPal flow so the
 * money math lives in one place. Does NOT insert anything.
 */
async function buildOrderDraft(
  db: AdminDb,
  data: CheckoutData,
): Promise<{ ok: true; draft: OrderDraft } | { ok: false; error: string }> {
  const { data: store } = await db
    .from("stores")
    .select("*")
    .eq("id", data.store_id)
    .maybeSingle();
  if (!store || !store.active) {
    return { ok: false, error: "La tienda no está disponible" };
  }

  // El comprobante tiene que vivir en la carpeta de ESTA tienda. Sin esto, la
  // ruta la elige el cliente y después el panel se la firma con service role
  // (que saltea RLS), así que un pedido propio podría usarse para leer el
  // comprobante bancario de un cliente de otra tienda. Mismo candado que ya
  // tenía panel/plan/actions.ts para el comprobante del plan.
  if (
    data.payment_proof_path &&
    !data.payment_proof_path.startsWith(`${store.id}/`)
  ) {
    return { ok: false, error: "El comprobante no es válido. Súbelo de nuevo." };
  }

  if (data.fulfillment_type === "delivery") {
    if (!store.offers_delivery) {
      return { ok: false, error: "La tienda no ofrece delivery" };
    }
    if (!data.delivery_address || data.delivery_address.length < 5) {
      return { ok: false, error: "Ingresa la dirección de entrega" };
    }
  } else if (!store.offers_pickup) {
    return { ok: false, error: "La tienda no ofrece retiro" };
  }

  const { data: method } = await db
    .from("payment_methods")
    .select("id, type, requires_proof, active, details")
    .eq("id", data.payment_method_id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!method || !method.active) {
    return { ok: false, error: "Método de pago no válido" };
  }

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

  const orderItems: OrderItemDraft[] = [];
  const stockOps: { product_id: string; variant_id: string | null; qty: number }[] = [];

  for (const item of cart.items) {
    const product = byId.get(item.id);
    if (!product || product.status !== "active") {
      return { ok: false, error: "Un producto ya no está disponible. Revisa tu carrito." };
    }
    const qty = item.qty;

    if (item.variantId) {
      const variant = variantById.get(item.variantId);
      if (!variant || variant.product_id !== product.id || !variant.active) {
        return { ok: false, error: "Una variante ya no está disponible. Revisa tu carrito." };
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
      stockOps.push({ product_id: product.id, variant_id: variant.id, qty });
      continue;
    }

    const opts = product.variant_options;
    if (Array.isArray(opts) && opts.length > 0) {
      return { ok: false, error: `Elige las opciones de "${product.name}".` };
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
      stockOps.push({ product_id: product.id, variant_id: null, qty });
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
  const totalBs = store.show_bs_prices ? usdToBs(total, store.exchange_rate) : null;

  return {
    ok: true,
    draft: {
      store,
      method,
      orderItems,
      subtotal,
      discount,
      couponFreeShipping,
      appliedCoupon,
      shipping,
      total,
      totalBs,
      stockOps,
    },
  };
}

/**
 * Step 1 of a PayPal payment: create the PayPal order for the real (server
 * computed) total. The browser then shows the PayPal/card buttons for it.
 */
export async function createPaypalOrderAction(
  input: CheckoutInput,
): Promise<{ ok: boolean; error?: string; paypalOrderId?: string }> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = createAdminClient();
  const result = await buildOrderDraft(db, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  const { draft } = result;

  if (draft.method.type !== "paypal") {
    return { ok: false, error: "Método no válido" };
  }
  const creds = paypalCredsFromEnv();
  if (!creds) return { ok: false, error: "PayPal no está disponible por el momento" };
  if (draft.total <= 0) return { ok: false, error: "El total no es válido" };

  const res = await createPaypalOrder(creds, draft.total, {
    description: `Pedido en ${draft.store.name}`,
  });
  if (!res.ok) return { ok: false, error: "No se pudo iniciar el pago con PayPal" };
  return { ok: true, paypalOrderId: res.id };
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

  // ¿Este mismo envío ya creó un pedido? Pasa cuando la respuesta se pierde en
  // el camino (señal que se cae en pleno "Confirmar") y el cliente reintenta:
  // el pedido ya existe del lado del servidor aunque él nunca lo haya visto.
  if (data.idempotency_key) {
    const { data: existing } = await db
      .from("orders")
      .select("id")
      .eq("store_id", data.store_id)
      .eq("idempotency_key", data.idempotency_key)
      .maybeSingle();
    if (existing) {
      await clearCart(data.store_id);
      return { ok: true, orderId: existing.id };
    }
  }

  const result = await buildOrderDraft(db, data);
  if (!result.ok) return { ok: false, error: result.error };
  const {
    store,
    method,
    orderItems,
    subtotal,
    discount,
    appliedCoupon,
    shipping,
    total,
    totalBs,
    stockOps,
  } = result.draft;

  // Decide status + payment proof depending on the method.
  let status: OrderStatus;
  let paymentReference = data.payment_reference || null;
  let paymentProof = data.payment_proof_path || null;
  let paymentFee: number | null = null;
  let paymentNet: number | null = null;

  if (method.type === "paypal") {
    // Capture the online payment now; only create the order if it succeeds.
    const creds = paypalCredsFromEnv();
    if (!creds) return { ok: false, error: "PayPal no está disponible por el momento" };
    if (!data.paypal_order_id) {
      return { ok: false, error: "El pago de PayPal no se completó" };
    }
    const cap = await capturePaypalOrder(creds, data.paypal_order_id);
    if (!cap.ok) {
      return { ok: false, error: "No se pudo confirmar el pago con PayPal" };
    }
    if (Math.abs(cap.amount - total) > 0.01) {
      return {
        ok: false,
        error: "El monto cobrado no coincide con el pedido. Contacta a la tienda.",
      };
    }
    status = "confirmed";
    paymentReference = cap.captureId;
    paymentProof = null;
    paymentFee = cap.fee;
    paymentNet = cap.net;
  } else if (!method.requires_proof) {
    status = "confirmed";
  } else if (data.payment_proof_path) {
    status = "pending_confirmation";
  } else {
    // Eligió pagar por fuera y todavía no tiene la captura. Antes esto era un
    // error y el pedido simplemente no existía: el cliente se iba a la app de
    // su banco y no volvía, y el comerciante nunca se enteraba de que hubo una
    // compra. Ahora el pedido nace en "esperando pago" y el comprobante se
    // sube después desde la página del pedido (ver `attachPaymentProof`).
    status = "pending_payment";
  }

  // El cupo del cupón se reclama ANTES de crear el pedido, no se cuenta
  // después. Si el cupón se agotó entre que el cliente lo aplicó y que apretó
  // "Confirmar", el pedido no llega a existir con un descuento que ya no
  // correspondía. Si algo falla más abajo, se devuelve (`releaseCoupon`).
  let couponClaimed = false;
  if (appliedCoupon) {
    const { data: claimed } = await db.rpc("claim_coupon_use", {
      p_coupon_id: appliedCoupon.id,
    });
    if (!claimed) {
      return {
        ok: false,
        error: "El cupón acaba de agotarse. Quítalo para continuar con tu compra.",
      };
    }
    couponClaimed = true;
  }
  const releaseCoupon = async () => {
    if (!couponClaimed || !appliedCoupon) return;
    couponClaimed = false;
    await db.rpc("release_coupon_use", { p_coupon_id: appliedCoupon.id });
  };

  const { data: order, error: orderErr } = await db
    .from("orders")
    .insert({
      store_id: store.id,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_email: data.customer_email,
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
      payment_proof_url: paymentProof,
      payment_reference: paymentReference,
      payment_fee: paymentFee,
      payment_net: paymentNet,
      status,
      notes: data.notes || null,
      confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
      idempotency_key: data.idempotency_key ?? null,
    })
    .select("id, order_number")
    .single();

  if (orderErr || !order) {
    // El pedido no existe, así que el cupo reclamado tampoco corresponde.
    await releaseCoupon();
    // 23505 sobre idx_orders_idempotency = dos envíos del mismo formulario
    // llegaron a la vez y el otro ganó. No es un error para el cliente: su
    // pedido existe, hay que devolverle ese.
    if (orderErr?.code === "23505" && data.idempotency_key) {
      const { data: twin } = await db
        .from("orders")
        .select("id")
        .eq("store_id", store.id)
        .eq("idempotency_key", data.idempotency_key)
        .maybeSingle();
      if (twin) {
        await clearCart(store.id);
        return { ok: true, orderId: twin.id };
      }
    }
    return { ok: false, error: "No se pudo crear el pedido. Intenta de nuevo." };
  }

  const { error: itemsErr } = await db
    .from("order_items")
    .insert(orderItems.map((i) => ({ ...i, order_id: order.id })));
  if (itemsErr) {
    await db.from("orders").delete().eq("id", order.id);
    await releaseCoupon();
    return { ok: false, error: "No se pudo crear el pedido. Intenta de nuevo." };
  }

  // El stock se reserva AL TOMAR EL PEDIDO, no al confirmar el pago.
  //
  // Antes esto corría solo para los pedidos que nacen confirmados (efectivo y
  // PayPal), y el flujo más usado en Venezuela —Pago Móvil con comprobante—
  // se quedaba en pending_confirmation sin reservar nada hasta que el dueño
  // revisara la foto, horas después. En esa ventana dos clientes compraban la
  // última unidad, los dos pagaban de verdad, y alguien se quedaba sin nada.
  //
  //  - todo lo que no sea PayPal: guardia activa. Si el stock se agotó en la
  //    carrera, se rechaza limpio — todavía no se cobró nada.
  //  - paypal: la plata ya está capturada, así que nunca se rechaza. Se piso
  //    en 0 y un sobreventa raro se concilia a mano.
  if (stockOps.length > 0) {
    const enforce = method.type !== "paypal";
    const { error: stockErr } = await db.rpc("commit_order_stock", {
      p_items: stockOps,
      p_enforce: enforce,
    });
    if (stockErr && enforce) {
      // Insufficient stock lost the race — undo the order we just created.
      await db.from("order_items").delete().eq("order_id", order.id);
      await db.from("orders").delete().eq("id", order.id);
      await releaseCoupon();
      return {
        ok: false,
        error: "Uno de los productos se agotó mientras comprabas. Revisa tu carrito.",
      };
    }
    // La marca que hace segura la cancelación: dice que ESTE pedido ya movió
    // inventario, así que devolverlo tiene sentido y devolverlo dos veces no.
    if (!stockErr) {
      await db
        .from("orders")
        .update({ stock_committed: true })
        .eq("id", order.id);
    }
  }

  // Los pedidos en efectivo y por PayPal nacen confirmados: nunca pasan por
  // confirmPayment, así que el referido que trajo a esta tienda se evalúa aquí
  // también. Los que quedan en pending_confirmation se evalúan al confirmarse.
  if (status === "confirmed") {
    await maybeQualifyReferral(store.id);
  }

  // El visitante compró: su carrito abandonado deja de estar pendiente. Se
  // marca por sesión Y por teléfono, porque puede haber empezado el checkout en
  // el teléfono y terminado en la computadora (otra cookie, mismo cliente).
  try {
    const recovered = {
      recovered_order_id: order.id,
      recovered_at: new Date().toISOString(),
    };
    const pending = () =>
      db
        .from("abandoned_carts")
        .update(recovered)
        .eq("store_id", store.id)
        .is("recovered_at", null);

    // Dos updates y no un .or(): el teléfono es texto libre del cliente y
    // concatenarlo en un filtro de PostgREST deja inyectar sintaxis de filtros.
    await pending().eq("session_id", getOrCreateSessionId());
    await pending().eq("customer_phone", data.customer_phone);
  } catch (e) {
    // No es crítico: como mucho el comerciante ve un carrito de más.
    reportError("createOrder:recoverCart", e, { orderId: order.id });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Datos del pedido para los mensajes. Se arma una sola vez y sirve para el
  // recibo del cliente por email y, más adelante, por WhatsApp.
  const messageData = buildOrderMessageData({
    order: {
      order_number: order.order_number,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      fulfillment_type: data.fulfillment_type,
      delivery_address:
        data.fulfillment_type === "delivery" ? data.delivery_address! : null,
      subtotal,
      shipping_cost: shipping,
      discount_total: discount,
      coupon_code: appliedCoupon ? appliedCoupon.code : null,
      total,
      total_bs: totalBs,
      payment_method_type: method.type,
      notes: data.notes || null,
    },
    items: orderItems,
    storeName: store.name,
    pickupAddress: store.pickup_address,
    orderUrl: `${appUrl}/${store.slug}/pedido/${order.id}`,
    panelUrl: `${appUrl}/panel/pedidos/${order.id}`,
  });

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
  } catch (e) {
    // Never fail the order because of a notification problem.
    reportError("createOrder:notifyOwner", e, { orderId: order.id });
  }

  // Y por WhatsApp, que es donde el comerciante venezolano sí mira.
  //
  // Hasta ahora el único aviso inmediato dependía de que el CLIENTE tocara
  // "Avisar a la tienda" en la confirmación; si no lo tocaba, el pedido se
  // descubría horas después. Esto sale del servidor y no depende de nadie.
  // Es no-op mientras no estén las credenciales de la Cloud API.
  try {
    await notifyOwnerNewOrder({
      toPhone: store.whatsapp,
      storeName: store.name,
      orderNumber: order.order_number,
      totalLabel: formatUSD(total),
    });
  } catch (e) {
    reportError("createOrder:notifyOwnerWhatsapp", e, { orderId: order.id });
  }

  // Recibo al cliente apenas compra.
  try {
    const { subject, html } = customerOrderReceiptEmail(messageData, {
      state:
        status === "pending_payment"
          ? "awaiting_payment"
          : status === "pending_confirmation"
            ? "pending_proof"
            : "confirmed",
    });
    await sendEmail({ to: data.customer_email, subject, html });
  } catch (e) {
    // Idem: el recibo nunca puede tumbar un pedido ya cobrado.
    reportError("createOrder:customerReceipt", e, { orderId: order.id });
  }

  await recordEvent(store.id, "purchase");
  await clearCart(store.id);
  return { ok: true, orderId: order.id };
}

const attachProofSchema = z.object({
  order_id: z.string().uuid(),
  store_id: z.string().uuid(),
  payment_proof_path: z.string().trim().min(1).max(400),
  payment_reference: z.string().trim().max(120).optional(),
});

export type AttachProofInput = z.input<typeof attachProofSchema>;

/**
 * Sube el comprobante de un pedido que quedó en "esperando pago".
 *
 * Es la segunda mitad del checkout en dos tiempos: el cliente compró, se fue a
 * pagar a la app de su banco y vuelve por el enlace del pedido con la captura.
 *
 * Quién puede llamarlo: cualquiera que tenga el UUID del pedido — el mismo
 * modelo de capacidad que ya usa la página de seguimiento. Para que eso sea
 * seguro, el action es deliberadamente angosto: solo escribe el comprobante y
 * la referencia, solo sobre un pedido en `pending_payment` de esa tienda, y
 * solo si todavía no tiene uno. No se puede reemplazar el comprobante de un
 * pedido ya confirmado ni tocar ninguna otra columna.
 */
export async function attachPaymentProof(
  input: AttachProofInput,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = attachProofSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos" };
  }
  const d = parsed.data;

  // La ruta tiene que caer dentro de la carpeta de ESTA tienda. Sin esto, un
  // path armado a mano podría apuntar al comprobante de otro comercio.
  if (!d.payment_proof_path.startsWith(`${d.store_id}/proofs/`)) {
    return { ok: false, error: "El comprobante no es válido" };
  }

  const db = createAdminClient();
  const { data: order } = await db
    .from("orders")
    .select("id, status, payment_proof_url, order_number, customer_name")
    .eq("id", d.order_id)
    .eq("store_id", d.store_id)
    .maybeSingle();

  if (!order) return { ok: false, error: "No encontramos el pedido" };
  if (order.payment_proof_url) {
    return { ok: false, error: "Este pedido ya tiene un comprobante cargado" };
  }
  if (order.status !== "pending_payment") {
    return {
      ok: false,
      error: "Este pedido ya no está esperando el comprobante",
    };
  }

  const { error } = await db
    .from("orders")
    .update({
      payment_proof_url: d.payment_proof_path,
      payment_reference: d.payment_reference || null,
      status: "pending_confirmation" satisfies OrderStatus,
    })
    .eq("id", order.id)
    .eq("store_id", d.store_id)
    // Condición de carrera: si entre el SELECT y el UPDATE la tienda ya movió
    // el pedido, este filtro hace que no se pise nada.
    .eq("status", "pending_payment");

  if (error) {
    return { ok: false, error: "No se pudo guardar el comprobante. Intenta de nuevo." };
  }

  // El comerciante tiene que enterarse: para él esto es un pedido nuevo por
  // revisar. Nunca puede tumbar la carga del comprobante, que ya está hecha.
  try {
    const { data: store } = await db
      .from("stores")
      .select("name")
      .eq("id", d.store_id)
      .maybeSingle();
    const { data: owners } = await db
      .from("users")
      .select("email")
      .eq("store_id", d.store_id)
      .in("role", ["store_owner", "store_staff"])
      .eq("active", true);
    const recipients = (owners ?? [])
      .map((o) => o.email)
      .filter((e): e is string => Boolean(e));
    if (recipients.length > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      await sendEmail({
        to: recipients,
        subject: `Comprobante recibido · Pedido #${order.order_number}`,
        html: `<p>${order.customer_name} subió el comprobante del pedido #${order.order_number}${
          store?.name ? ` en ${store.name}` : ""
        }.</p><p><a href="${appUrl}/panel/pedidos/${order.id}">Verificar el pago</a></p>`,
      });
    }
  } catch {
    // Notificar nunca puede fallar la operación.
  }

  return { ok: true };
}
