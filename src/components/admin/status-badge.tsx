import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_META, PRODUCT_STATUS_META } from "@/lib/constants";
import type { OrderStatus, ProductStatus } from "@/types/database";

const TONE_TO_VARIANT = {
  neutral: "neutral",
  warning: "warning",
  info: "info",
  success: "success",
  danger: "danger",
} as const;

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const meta = PRODUCT_STATUS_META[status];
  return <Badge variant={TONE_TO_VARIANT[meta.tone]}>{meta.label}</Badge>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status];
  return <Badge variant={TONE_TO_VARIANT[meta.tone]}>{meta.label}</Badge>;
}
