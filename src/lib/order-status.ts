import type { OrderStatus } from "@/types/database";

/**
 * Máquina de estados del pedido: única fuente de verdad.
 *
 * Vivía solo en el dropdown del panel, así que era decoración — el server
 * action aceptaba cualquier destino de la lista manual sin mirar de dónde
 * venía. Se podía pasar un pedido de "esperando pago" directo a "entregado":
 * la venta contaba en Finanzas y el pago nunca se confirmaba. También se podía
 * revivir un pedido cancelado.
 *
 * Ahora el mapa se importa en los dos lados: la UI decide qué ofrecer y el
 * servidor decide qué aceptar, con la misma tabla.
 */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["confirmed", "cancelled"],
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["preparing", "in_delivery", "completed", "cancelled"],
  preparing: ["in_delivery", "completed", "cancelled"],
  in_delivery: ["completed", "cancelled"],
  // Terminales: un pedido entregado o cancelado no vuelve atrás. Si hubo un
  // error, se deja registrado y se crea otro pedido — reescribir el histórico
  // es justamente lo que hace que los números dejen de cuadrar.
  completed: [],
  cancelled: [],
};

/** ¿Es legal este cambio de estado? */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT_STATUSES[from]?.includes(to) ?? false;
}

/**
 * Los estados desde los que "confirmar el pago" tiene sentido.
 *
 * `pending_payment` está incluido a propósito: es el pedido que el cliente
 * dejó para pagar por fuera y del que nunca subió comprobante. Si el
 * comerciante cobró igual (le transfirieron, pasó por la tienda), tiene que
 * poder confirmarlo. El dropdown ya lo ofrecía, pero la acción lo rechazaba
 * con "este pedido ya fue procesado" — el pedido quedaba trabado.
 */
export const CONFIRMABLE_FROM: OrderStatus[] = [
  "pending_confirmation",
  "pending_payment",
];

export function isConfirmable(status: OrderStatus): boolean {
  return CONFIRMABLE_FROM.includes(status);
}
