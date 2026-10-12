"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { dismissDomainNotice } from "@/app/(admin)/panel/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Aviso de una sola vez: Tiendify cambió de dominio y con él cambió el link de
 * la tienda, que es lo que el comerciante tiene pegado en su Instagram y su
 * WhatsApp. Por eso lo principal acá es copiar el link nuevo, no leer.
 *
 * Se da por visto al cerrarlo, no al mostrarlo: si cierra la pestaña sin
 * tocarlo, le vuelve a salir.
 */
export function DomainNotice({ storeUrl }: { storeUrl: string }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLParagraphElement>(null);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) void dismissDomainNotice();
  }

  /**
   * Copiar con red de contención, como en el checkout: `navigator.clipboard`
   * falla o no existe en varios navegadores embebidos. El plan B selecciona el
   * link que está a la vista y copia esa selección; si ni eso funciona, el
   * link queda seleccionado para copiarlo a mano.
   */
  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(storeUrl);
      ok = true;
    } catch {
      const selection = window.getSelection();
      if (linkRef.current && selection) {
        const range = document.createRange();
        range.selectNodeContents(linkRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
        try {
          ok = document.execCommand("copy");
        } catch {
          /* sigue al aviso de abajo */
        }
      }
    }
    if (!ok) {
      toast.error("Tu navegador no deja copiar", {
        description: "El link quedó seleccionado: cópialo a mano.",
      });
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* El diálogo se monta en <body>, fuera del div del panel: sin la clase
          acá el botón principal saldría con el azul de marca y no en tinta. */}
      <AlertDialogContent className="chrome-admin">
        <AlertDialogHeader>
          <AlertDialogTitle>Tiendify tiene nueva dirección</AlertDialogTitle>
          <AlertDialogDescription>
            Ahora estamos en{" "}
            <strong className="font-medium text-foreground">
              usatiendify.com
            </strong>
            . Este es el nuevo link de tu tienda:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <p
          ref={linkRef}
          className="select-all break-all rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm"
        >
          {storeUrl}
        </p>

        <p className="text-sm text-muted-foreground">
          El link anterior sigue funcionando por ahora, pero conviene que lo
          cambies en tu Instagram, tu WhatsApp y donde lo tengas compartido.
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel>Entendido</AlertDialogCancel>
          <Button onClick={copy}>
            {copied ? <Check /> : <Copy />}
            {copied ? "¡Copiado!" : "Copiar link"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
