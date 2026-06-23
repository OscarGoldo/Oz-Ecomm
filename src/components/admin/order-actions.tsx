"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  confirmPayment,
  updateOrderStatus,
} from "@/app/(admin)/panel/pedidos/actions";
import { ORDER_STATUS_META } from "@/lib/constants";
import { whatsappUrl } from "@/lib/whatsapp";
import { orderStatusClientMessage, shouldNotifyCustomer } from "@/lib/order-messages";
import type { OrderStatus } from "@/types/database";

const ADVANCE_OPTIONS: OrderStatus[] = ["preparing", "in_delivery", "completed"];

interface OrderActionsProps {
  orderId: string;
  status: OrderStatus;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  storeName: string;
}

export function OrderActions({
  orderId,
  status,
  orderNumber,
  customerName,
  customerPhone,
  storeName,
}: OrderActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const isPendingConfirmation = status === "pending_confirmation";
  const isTerminal = status === "completed" || status === "cancelled";

  const waUrl = whatsappUrl(
    customerPhone,
    `Hola ${customerName}! 👋 Te contacto de ${storeName} por tu pedido #${orderNumber}.`,
  );

  function notifyToast(title: string, to: OrderStatus) {
    const wa = shouldNotifyCustomer(to)
      ? whatsappUrl(
          customerPhone,
          orderStatusClientMessage(to, customerName, orderNumber, storeName),
        )
      : null;
    toast.success(
      title,
      wa
        ? {
            description: "Avisale al cliente que cambió su pedido.",
            action: {
              label: "Avisar 📲",
              onClick: () => window.open(wa, "_blank"),
            },
            duration: 8000,
          }
        : undefined,
    );
  }

  async function handleConfirm() {
    setConfirming(true);
    const res = await confirmPayment(orderId);
    setConfirming(false);
    if (!res.ok) return toast.error(res.error ?? "Error");
    notifyToast("Pago confirmado. Stock descontado.", "confirmed");
    router.refresh();
  }

  function handleStatus(next: OrderStatus) {
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, next);
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      notifyToast(`Pedido: ${ORDER_STATUS_META[next].label}`, next);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {isPendingConfirmation && (
        <Button onClick={handleConfirm} disabled={confirming} className="w-full" size="lg">
          {confirming ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Confirmar pago
        </Button>
      )}

      {!isPendingConfirmation && !isTerminal && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Cambiar estado</span>
          <Select value={status} onValueChange={(v) => handleStatus(v as OrderStatus)}>
            <SelectTrigger disabled={pending}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={status} disabled>
                {ORDER_STATUS_META[status].label} (actual)
              </SelectItem>
              {ADVANCE_OPTIONS.filter((s) => s !== status).map((s) => (
                <SelectItem key={s} value={s}>
                  {ORDER_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {waUrl && (
        <Button asChild variant="outline" className="w-full">
          <a href={waUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> Contactar al cliente
          </a>
        </Button>
      )}

      {!isTerminal && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="w-full text-destructive">
              Cancelar pedido
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cancelar el pedido #{orderNumber}?</AlertDialogTitle>
              <AlertDialogDescription>
                El pedido quedará marcado como cancelado. El stock ya descontado
                no se restituye automáticamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Volver</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleStatus("cancelled")}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Cancelar pedido
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
