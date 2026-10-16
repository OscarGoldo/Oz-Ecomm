"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { dismissPlanGiftNotice } from "@/app/(admin)/panel/actions";
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
import { monthsLabel } from "@/lib/promo";

/**
 * Aviso de una sola vez: el equipo le regaló meses de Pro desde /super (ver
 * src/lib/plan-gift.ts). Lleva el mensaje que escribió el super admin, o uno
 * genérico si no escribió nada.
 *
 * Igual que los otros avisos del panel, se da por visto al cerrarlo, no al
 * mostrarlo.
 */
export function PlanGiftNotice({
  firstName,
  months,
  message,
  expiresOn,
}: {
  firstName: string | null;
  months: number;
  message: string | null;
  /** Fecha de vencimiento ya formateada: "16 de noviembre de 2026". */
  expiresOn: string | null;
}) {
  const [open, setOpen] = useState(true);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) void dismissPlanGiftNotice();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* Montado en <body>, fuera del panel: la clase mantiene el botón en tinta. */}
      <AlertDialogContent className="chrome-admin">
        <AlertDialogHeader>
          <AlertDialogTitle>Un regalo del equipo de Tiendify</AlertDialogTitle>
          <AlertDialogDescription>
            {firstName ? `${firstName}, te` : "Te"} regalamos{" "}
            {monthsLabel(months)} de Pro.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 text-sm">
          <p className="whitespace-pre-line">
            {message ?? "Gracias por abrir tu tienda en Tiendify."}
          </p>
          <p className="text-muted-foreground">
            Ya está activo{expiresOn ? `, hasta el ${expiresOn}` : ""}: productos
            ilimitados, todas las plantillas, analítica y cupones. No tienes que
            hacer nada ni cargar ninguna tarjeta.
          </p>
          <p className="font-medium">El equipo de Tiendify</p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>¡Gracias!</AlertDialogCancel>
          <Button asChild>
            <Link href="/panel/plan" onClick={() => onOpenChange(false)}>
              Ver mi plan <ArrowRight />
            </Link>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
