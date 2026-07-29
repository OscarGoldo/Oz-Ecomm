import { formatBs, formatUSD } from "@/lib/format";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import type {
  FulfillmentType,
  OrderStatus,
  PaymentMethodType,
} from "@/types/database";

/**
 * Mensajes de pedido, en un solo lugar.
 *
 * El mismo contenido se sirve por WhatsApp (texto plano con *negritas*) y por
 * email (HTML, en `lib/email.ts`), así el cliente recibe lo mismo sin importar
 * el canal. Este archivo es PURO — lo importa un componente cliente
 * (`order-actions.tsx`), así que no puede llevar "server-only" ni tocar la DB.
 */

export interface OrderMessageItem {
  productName: string;
  variantName?: string | null;
  quantity: number;
  /** Total de la línea en USD (precio unitario × cantidad). */
  subtotal: number;
}

export interface OrderMessageData {
  orderNumber: number;
  storeName: string;
  customerName: string;
  customerPhone?: string | null;
  items: OrderMessageItem[];
  subtotal: number;
  discount: number;
  couponCode?: string | null;
  shipping: number;
  total: number;
  totalBs?: number | null;
  fulfillment: "delivery" | "pickup";
  deliveryAddress?: string | null;
  pickupAddress?: string | null;
  paymentLabel?: string | null;
  /** Página pública de seguimiento del pedido. */
  orderUrl?: string | null;
  /** Detalle del pedido en el panel del comerciante. */
  panelUrl?: string | null;
  /** Nota que dejó el cliente en el checkout. */
  notes?: string | null;
}

/** Lo mínimo de una fila de `orders` que necesita un mensaje. */
type OrderLike = {
  order_number: number;
  customer_name: string;
  customer_phone: string;
  fulfillment_type: FulfillmentType;
  delivery_address: string | null;
  subtotal: number;
  shipping_cost: number;
  discount_total: number;
  coupon_code: string | null;
  total: number;
  total_bs: number | null;
  payment_method_type: string | null;
  notes: string | null;
};

/** Sirve tanto para una fila de `order_items` como para el draft del checkout. */
type OrderItemLike = {
  product_name: string;
  variant_name: string | null;
  quantity: number;
  subtotal: number;
};

/** Etiqueta legible del método de pago ("pago_movil" → "Pago Móvil"). */
export function paymentLabelOf(type: string | null | undefined): string | null {
  if (!type) return null;
  return PAYMENT_METHOD_META[type as PaymentMethodType]?.label ?? type;
}

/**
 * Traduce el pedido guardado al shape que consumen los mensajes. Existe para
 * que el mapeo de campos viva en un solo lugar: el checkout, el panel y la
 * página de confirmación arman el mismo mensaje con los mismos datos.
 */
export function buildOrderMessageData(params: {
  order: OrderLike;
  items: OrderItemLike[];
  storeName: string;
  pickupAddress?: string | null;
  orderUrl?: string | null;
  panelUrl?: string | null;
}): OrderMessageData {
  const { order, items, storeName } = params;
  return {
    orderNumber: order.order_number,
    storeName,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    items: items.map((i) => ({
      productName: i.product_name,
      variantName: i.variant_name,
      quantity: i.quantity,
      subtotal: Number(i.subtotal),
    })),
    subtotal: Number(order.subtotal),
    discount: Number(order.discount_total),
    couponCode: order.coupon_code,
    shipping: Number(order.shipping_cost),
    total: Number(order.total),
    totalBs: order.total_bs == null ? null : Number(order.total_bs),
    fulfillment: order.fulfillment_type,
    deliveryAddress: order.delivery_address,
    pickupAddress: params.pickupAddress ?? null,
    paymentLabel: paymentLabelOf(order.payment_method_type),
    orderUrl: params.orderUrl ?? null,
    panelUrl: params.panelUrl ?? null,
    notes: order.notes,
  };
}

/**
 * Une líneas descartando las condicionales que no aplican. Ojo: conserva los
 * `""` a propósito — son los renglones en blanco que separan los bloques.
 */
function joinLines(lines: (string | null | false | undefined)[]): string {
  return lines.filter((l): l is string => typeof l === "string").join("\n");
}

/** `valor || false`, para que joinLines descarte el renglón sin dejar hueco. */
function opt(text: string | null | undefined, render: (v: string) => string) {
  const v = text?.trim();
  return v ? render(v) : false;
}

/** "2× Camisa (M / Rojo) — $30.00" */
function itemLine(item: OrderMessageItem): string {
  const variant = item.variantName ? ` (${item.variantName})` : "";
  return `• ${item.quantity}× ${item.productName}${variant} — ${formatUSD(item.subtotal)}`;
}

/**
 * Bloque de totales. Subtotal/descuento/envío solo aparecen si aportan algo:
 * un pedido sin descuento ni envío muestra únicamente el total.
 */
function totalsBlock(d: OrderMessageData): string {
  const hasBreakdown = d.discount > 0 || d.shipping > 0;
  return joinLines([
    hasBreakdown && `Subtotal: ${formatUSD(d.subtotal)}`,
    d.discount > 0 &&
      `Descuento${d.couponCode ? ` (${d.couponCode})` : ""}: −${formatUSD(d.discount)}`,
    d.shipping > 0 && `Envío: ${formatUSD(d.shipping)}`,
    `*Total: ${formatUSD(d.total)}*${d.totalBs ? ` (${formatBs(d.totalBs)})` : ""}`,
  ]);
}

/** "Delivery a Av. Bolívar" / "Retiro en tienda · Calle 5" */
function fulfillmentLine(d: OrderMessageData): string {
  if (d.fulfillment === "delivery") {
    return `🚚 Entrega: ${d.deliveryAddress?.trim() || "Delivery"}`;
  }
  return `🏪 Retiro en tienda${d.pickupAddress?.trim() ? ` · ${d.pickupAddress.trim()}` : ""}`;
}

function firstName(name: string): string {
  return name?.trim().split(/\s+/)[0] ?? "";
}

/**
 * Recibo completo para el cliente, que el comerciante manda con 1 tap.
 * Es el mensaje que reemplaza al "te confirmo tu pedido" escrito a mano.
 */
export function orderReceiptCustomerMessage(d: OrderMessageData): string {
  const name = firstName(d.customerName);
  const hi = name ? `¡Hola ${name}!` : "¡Hola!";

  return joinLines([
    `${hi} ✅ Confirmamos tu pedido *#${d.orderNumber}* en *${d.storeName}*.`,
    "",
    "🛍️ *Tu pedido*",
    ...d.items.map(itemLine),
    "",
    totalsBlock(d),
    "",
    opt(d.paymentLabel, (v) => `💳 Pago: ${v}`),
    fulfillmentLine(d),
    opt(d.orderUrl, () => ""),
    opt(d.orderUrl, (v) => `Seguí tu pedido acá:\n${v}`),
    "",
    "¡Gracias por tu compra! 🙌",
  ]);
}

/**
 * Aviso de pedido nuevo para el dueño. Lo usa el botón de WhatsApp y, cuando
 * la Cloud API esté activa, también la notificación automática.
 */
export function newOrderOwnerMessage(d: OrderMessageData): string {
  return joinLines([
    `🛒 *Nuevo pedido #${d.orderNumber}* · ${d.storeName}`,
    "",
    `👤 ${d.customerName}`,
    opt(d.customerPhone, (v) => `📱 ${v}`),
    "",
    ...d.items.map(itemLine),
    "",
    totalsBlock(d),
    "",
    opt(d.paymentLabel, (v) => `💳 ${v}`),
    fulfillmentLine(d),
    opt(d.notes, (v) => `📝 Nota: ${v}`),
    opt(d.panelUrl, () => ""),
    opt(d.panelUrl, (v) => `Ver en el panel:\n${v}`),
  ]);
}

/**
 * Mensaje que el CLIENTE le manda a la tienda desde la página de confirmación.
 * Lleva el detalle para que el comerciante no tenga que ir a buscar el pedido.
 */
export function customerToStoreMessage(d: OrderMessageData): string {
  return joinLines([
    `¡Hola ${d.storeName}! 👋`,
    `Hice el pedido *#${d.orderNumber}* a nombre de ${d.customerName}.`,
    "",
    ...d.items.map(itemLine),
    "",
    totalsBlock(d),
    "",
    opt(d.paymentLabel, (v) => `💳 Pagué con: ${v}`),
    fulfillmentLine(d),
    "",
    "¿Me confirman? ¡Gracias!",
  ]);
}

/**
 * Friendly message for the customer when their order changes status.
 * Used both for the 1-tap WhatsApp link and the automatic email body.
 */
export function orderStatusClientMessage(
  status: OrderStatus,
  customerName: string,
  orderNumber: number,
  storeName: string,
): string {
  const n = `#${orderNumber}`;
  const name = customerName?.trim() || "";
  const hi = name ? `¡Hola ${name}!` : "¡Hola!";
  switch (status) {
    case "confirmed":
      return `${hi} ✅ Confirmamos el pago de tu pedido ${n} en ${storeName}. ¡Ya lo estamos preparando! Gracias por tu compra. 🙌`;
    case "preparing":
      return `${hi} 📦 Estamos preparando tu pedido ${n} de ${storeName}.`;
    case "in_delivery":
      return `${hi} 🚚 Tu pedido ${n} de ${storeName} va en camino.`;
    case "completed":
      return `${hi} 🎉 Tu pedido ${n} fue entregado. ¡Gracias por comprar en ${storeName}!`;
    case "cancelled":
      return `Hola ${name}, tu pedido ${n} de ${storeName} fue cancelado. Cualquier duda, escríbenos.`;
    default:
      return `${hi} Tenemos novedades de tu pedido ${n} en ${storeName}.`;
  }
}

/** Whether a status change is worth notifying the customer about. */
export function shouldNotifyCustomer(status: OrderStatus): boolean {
  return [
    "confirmed",
    "preparing",
    "in_delivery",
    "completed",
    "cancelled",
  ].includes(status);
}
