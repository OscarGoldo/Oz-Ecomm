import type { OrderStatus } from "@/types/database";

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
