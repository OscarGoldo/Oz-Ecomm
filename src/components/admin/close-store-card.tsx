"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { closeStore } from "@/app/(admin)/panel/configuracion/actions";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Cerrar la tienda, al pie de Ajustes.
 *
 * Pide escribir el nombre de la tienda: es lo único que separa un clic
 * distraído de dejar el link de la tienda sin abrir. El diálogo dice qué pasa
 * con cada cosa que al comerciante le preocupa perder —la tienda en línea, el
 * cobro, sus datos— antes de pedirle la confirmación, no después.
 */
export function CloseStoreCard({
  storeName,
  hasSubscription,
}: {
  storeName: string;
  /** Tiene una suscripción que se cobra sola: se cancela al cerrar. */
  hasSubscription: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onOpenChange(next: boolean) {
    if (busy) return;
    setOpen(next);
    if (!next) {
      setTyped("");
      setError(null);
    }
  }

  async function confirm() {
    setBusy(true);
    const res = await closeStore(typed);
    if (!res.ok) {
      setBusy(false);
      setError(res.error ?? "No se pudo cerrar la tienda");
      return;
    }
    toast.success("Tu tienda quedó cerrada");
    router.push("/tienda-cerrada");
    router.refresh();
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Cerrar tienda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Tu tienda deja de estar en línea
          {hasSubscription ? " y se cancela tu suscripción" : ""}. No se borra
          nada: puedes reabrirla cuando quieras.
        </p>
        <Button
          type="button"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setOpen(true)}
        >
          Cerrar tienda
        </Button>
      </CardContent>

      <AlertDialog open={open} onOpenChange={onOpenChange}>
        {/* El diálogo se monta en <body>, fuera del div del panel: sin la clase
            acá los botones no toman los colores del panel. */}
        <AlertDialogContent className="chrome-admin">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar {storeName}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <ul className="list-disc space-y-1.5 pl-5 text-left text-sm text-muted-foreground">
                <li>El link de tu tienda deja de abrir para tus clientes.</li>
                {hasSubscription && (
                  <li>Se cancela tu suscripción y no se te cobra más.</li>
                )}
                <li>
                  No se borra nada. Entras con tu cuenta y la reabres cuando
                  quieras.
                </li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="close-store-name">
              Escribe el nombre de tu tienda para confirmar
            </Label>
            <Input
              id="close-store-name"
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setError(null);
              }}
              placeholder={storeName}
              autoComplete="off"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "close-store-error" : undefined}
            />
            {error && (
              <p id="close-store-error" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>No, volver</AlertDialogCancel>
            <Button variant="destructive" onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Cerrar tienda
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
