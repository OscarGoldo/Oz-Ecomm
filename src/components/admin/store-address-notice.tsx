"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy } from "lucide-react";

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
 * Aviso de una sola vez: las tiendas Pro estrenan su propia dirección,
 * `mitienda.usatiendify.com` (ver src/lib/store-url.ts).
 *
 * Al Pro le da su link nuevo listo para copiar, que es lo que va a pegar en su
 * Instagram. Al de Gratis le muestra la dirección que tendría con Pro, con su
 * propio nombre: es más concreto que cualquier lista de beneficios.
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
  /** La dirección de hoy en Gratis: https://usatiendify.com/mitienda */
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
          <AlertDialogTitle>
            {pro
              ? "Tu tienda estrena dirección"
              : "Tu tienda puede tener su propia dirección"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pro
              ? "Por ser Pro, tu tienda ahora tiene su propia dirección:"
              : "Con Pro, tu tienda queda en:"}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <p
          ref={linkRef}
          className="select-all break-all rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm"
        >
          {address}
        </p>

        <p className="text-sm text-muted-foreground">
          {pro ? (
            <>
              Es más corta y es tuya. Tu link anterior sigue funcionando, así
              que no se rompe nada de lo que ya compartiste, pero te conviene
              usar este en tu Instagram y tu WhatsApp.
            </>
          ) : (
            <>
              Hoy está en {currentUrl.replace(/^https?:\/\//, "")}. Además de
              la dirección propia, Pro incluye productos ilimitados, todas las
              plantillas, analítica y cupones.
            </>
          )}
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel>{pro ? "Entendido" : "Ahora no"}</AlertDialogCancel>
          {pro ? (
            <Button onClick={copy}>
              {copied ? <Check /> : <Copy />}
              {copied ? "¡Copiado!" : "Copiar link"}
            </Button>
          ) : (
            <Button asChild>
              <Link href="/panel/plan" onClick={() => onOpenChange(false)}>
                Ver Pro <ArrowRight />
              </Link>
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
