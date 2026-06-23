"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrderStatusBadge } from "@/components/admin/status-badge";
import {
  confirmPayment,
  updateOrderStatus,
} from "@/app/(admin)/panel/pedidos/actions";
import { ORDER_STATUS_META } from "@/lib/constants";
import type { OrderStatus } from "@/types/database";

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["confirmed", "cancelled"],
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["preparing", "in_delivery", "completed", "cancelled"],
  preparing: ["in_delivery", "completed", "cancelled"],
  in_delivery: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

function labelFor(from: OrderStatus, to: OrderStatus): string {
  if (to === "confirmed" && (from === "pending_confirmation" || from === "pending_payment")) {
    return "Confirmar pago";
  }
  if (to === "cancelled") return "Cancelar pedido";
  return `Marcar: ${ORDER_STATUS_META[to].label}`;
}

export function OrderQuickStatus({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const options = NEXT[status];

  function apply(to: OrderStatus) {
    startTransition(async () => {
      const isConfirm =
        to === "confirmed" &&
        (status === "pending_confirmation" || status === "pending_payment");
      const res = isConfirm
        ? await confirmPayment(orderId)
        : await updateOrderStatus(orderId, to);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo actualizar");
        return;
      }
      toast.success(isConfirm ? "Pago confirmado" : `Pedido: ${ORDER_STATUS_META[to].label}`);
      router.refresh();
    });
  }

  if (options.length === 0) {
    return <OrderStatusBadge status={status} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <OrderStatusBadge status={status} />
        {pending ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((to) => (
          <DropdownMenuItem
            key={to}
            onClick={() => apply(to)}
            className={to === "cancelled" ? "text-destructive focus:text-destructive" : ""}
          >
            {labelFor(status, to)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
