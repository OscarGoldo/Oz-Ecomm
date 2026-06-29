import type {
  OrderStatus,
  PaymentMethodType,
  ProductStatus,
  UserRole,
} from "@/types/database";

/** UI labels (Spanish) for order statuses + a badge color token. */
export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; tone: "neutral" | "warning" | "info" | "success" | "danger" }
> = {
  pending_payment: { label: "Esperando pago", tone: "neutral" },
  pending_confirmation: { label: "Por confirmar", tone: "warning" },
  confirmed: { label: "Pago confirmado", tone: "info" },
  preparing: { label: "Preparando", tone: "info" },
  in_delivery: { label: "En camino", tone: "info" },
  completed: { label: "Entregado", tone: "success" },
  cancelled: { label: "Cancelado", tone: "danger" },
};

export const PRODUCT_STATUS_META: Record<
  ProductStatus,
  { label: string; tone: "success" | "neutral" | "danger" }
> = {
  active: { label: "Activo", tone: "success" },
  draft: { label: "Borrador", tone: "neutral" },
  archived: { label: "Archivado", tone: "danger" },
};

export const PAYMENT_METHOD_META: Record<
  PaymentMethodType,
  { label: string }
> = {
  pago_movil: { label: "Pago Móvil" },
  zelle: { label: "Zelle" },
  binance: { label: "Binance" },
  cash: { label: "Efectivo" },
  transfer: { label: "Transferencia" },
  other: { label: "Otro" },
  paypal: { label: "PayPal / Tarjeta" },
};

export const ROLE_META: Record<UserRole, { label: string }> = {
  super_admin: { label: "Super Admin" },
  store_owner: { label: "Dueño" },
  store_staff: { label: "Empleado" },
};

/** Detail fields shown to the customer for each payment method type. */
export const PAYMENT_TYPE_FIELDS: Record<
  PaymentMethodType,
  { key: string; label: string }[]
> = {
  pago_movil: [
    { key: "banco", label: "Banco" },
    { key: "telefono", label: "Teléfono" },
    { key: "cedula", label: "Cédula / RIF" },
    { key: "titular", label: "Titular" },
  ],
  zelle: [
    { key: "email", label: "Email" },
    { key: "titular", label: "Titular" },
  ],
  binance: [{ key: "email_o_id", label: "Email o ID de Binance" }],
  paypal: [],
  transfer: [
    { key: "banco", label: "Banco" },
    { key: "cuenta", label: "N° de cuenta" },
    { key: "cedula", label: "Cédula / RIF" },
    { key: "titular", label: "Titular" },
  ],
  cash: [],
  other: [],
};

/** Whether a payment type usually needs a proof upload by default. */
export const PAYMENT_TYPE_DEFAULT_PROOF: Record<PaymentMethodType, boolean> = {
  pago_movil: true,
  zelle: true,
  binance: true,
  transfer: true,
  cash: false,
  other: false,
  paypal: false,
};
