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
import { NEXT_STATUSES, isConfirmable } from "@/lib/order-status";
import { orderStatusClientMessage, shouldNotifyCustomer } from "@/lib/order-messages";
import { whatsappUrl } from "@/lib/whatsapp";
import type { OrderStatus } from "@/types/database";

function labelFor(from: OrderStatus, to: OrderStatus): string {
  if (to === "confirmed" && isConfirmable(from)) {
    return "Confirmar pago";
  }
  if (to === "cancelled") return "Cancelar pedido";
  return `Marcar: ${ORDER_STATUS_META[to].label}`;
}

export function OrderQuickStatus({
  orderId,
  orderNumber,
  status,
  customerName,
  customerPhone,
  storeName,
}: {
  orderId: string;
  orderNumber: number;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  storeName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const options = NEXT_STATUSES[status];

  function apply(to: OrderStatus) {
    startTransition(async () => {
      const isConfirm = to === "confirmed" && isConfirmable(status);
      const res = isConfirm
        ? await confirmPayment(orderId)
        : await updateOrderStatus(orderId, to);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo actualizar");
        return;
      }

      // Offer a 1-tap WhatsApp message to the customer.
      const wa = shouldNotifyCustomer(to)
        ? whatsappUrl(
            customerPhone,
            orderStatusClientMessage(to, customerName, orderNumber, storeName),
          )
        : null;
      toast.success(
        isConfirm ? "Pago confirmado" : `Pedido: ${ORDER_STATUS_META[to].label}`,
        wa
          ? {
              description: "Avísale al cliente que cambió su pedido.",
              action: {
                label: "Avisar 📲",
                onClick: () => window.open(wa, "_blank"),
              },
              duration: 8000,
            }
          : undefined,
      );
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
