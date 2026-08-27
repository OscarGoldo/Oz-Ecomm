"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  dismissCart,
  markCartContacted,
} from "@/app/(admin)/panel/carritos/actions";

interface AbandonedCartRowProps {
  cartId: string;
  customerName: string;
  phone: string;
  /** "hace 2 horas" — ya formateado en el server. */
  timeAgo: string;
  itemLabels: string[];
  subtotalLabel: string;
  /** Link wa.me con el mensaje de recuperación. null si el teléfono no sirve. */
  whatsappHref: string | null;
  contactedLabel: string | null;
}

export function AbandonedCartRow({
  cartId,
  customerName,
  phone,
  timeAgo,
  itemLabels,
  subtotalLabel,
  whatsappHref,
  contactedLabel,
}: AbandonedCartRowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);

  /**
   * Abrir WhatsApp y registrar el contacto van juntos: si se registrara al
   * volver a la página, un comerciante que escribe desde el celular nunca
   * quedaría marcado.
   */
  function handleContact() {
    startTransition(async () => {
      await markCartContacted(cartId);
      router.refresh();
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      const res = await dismissCart(cartId);
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      setDismissed(true);
      toast.success("Carrito archivado");
      router.refresh();
    });
  }

  if (dismissed) return null;

  return (
    <li className="rounded-2xl border bg-card shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{customerName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {phone} · {timeAgo}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold">{subtotalLabel}</span>
      </div>

      <ul className="mt-3 space-y-0.5 text-sm text-muted-foreground">
        {itemLabels.map((label, i) => (
          <li key={i} className="truncate">
            {label}
          </li>
        ))}
      </ul>

      {contactedLabel && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
          <Check className="size-3.5" /> Contactado {contactedLabel}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {whatsappHref && (
          <Button asChild className="flex-1" disabled={pending}>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleContact}
            >
              <MessageCircle />
              {contactedLabel ? "Escribir de nuevo" : "Recuperar por WhatsApp"}
            </a>
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={handleDismiss}
          disabled={pending}
          aria-label="Archivar carrito"
        >
          {pending ? <Loader2 className="animate-spin" /> : <X />}
        </Button>
      </div>
    </li>
  );
}
