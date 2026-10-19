"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { dismissStoreAddressNotice } from "@/app/(admin)/panel/actions";
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
import { useCopyLink } from "@/components/admin/use-copy-link";

/**
 * Aviso de una sola vez: la tienda estrena su propia dirección,
 * `mitienda.usatiendify.com` (ver src/lib/store-url.ts). Desde el 2026-10-19
 * la tiene cualquier plan; antes era solo de Pro.
 *
 * Le da su link nuevo listo para copiar, que es lo que va a pegar en su
 * Instagram, y le recuerda el de antes para que sepa que no se rompió nada.
 *
 * Igual que el aviso del cambio de dominio, se da por visto al cerrarlo, no al
 * mostrarlo.
 */
export function StoreAddressNotice({
  pro,
  subdomainUrl,
  currentUrl,
}: {
  pro: boolean;
  /** https://mitienda.usatiendify.com */
  subdomainUrl: string;
  /** La dirección de antes: https://usatiendify.com/mitienda */
  currentUrl: string;
}) {
  const [open, setOpen] = useState(true);
  const { copied, copy, linkRef } = useCopyLink(subdomainUrl);
  const address = subdomainUrl.replace(/^https?:\/\//, "");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) void dismissStoreAddressNotice();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* Montado en <body>, fuera del panel: la clase mantiene el botón en tinta. */}
      <AlertDialogContent className="chrome-admin">
        <AlertDialogHeader>
          <AlertDialogTitle>Tu tienda estrena dirección</AlertDialogTitle>
          <AlertDialogDescription>
            {pro
              ? "Tu tienda ahora tiene su propia dirección:"
              : "Tu tienda ahora tiene su propia dirección, incluida en el plan Gratis:"}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <p
          ref={linkRef}
          className="select-all break-all rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm"
        >
          {address}
        </p>

        <p className="text-sm text-muted-foreground">
          Es más corta y es tuya. Tu link anterior (
          {currentUrl.replace(/^https?:\/\//, "")}) sigue funcionando, así que no
          se rompe nada de lo que ya compartiste, pero te conviene usar este en tu
          Instagram y tu WhatsApp.
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
