"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteExample } from "@/app/(superadmin)/super/ejemplos/actions";
import { useCopyLink } from "@/components/admin/use-copy-link";
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
import { Button } from "@/components/ui/button";

/** Abrir y copiar el link de la página: es lo que se le manda al negocio. */
export function ExampleLinkActions({ url, display }: { url: string; display: string }) {
  const { copy, copied, linkRef } = useCopyLink<HTMLSpanElement>(url);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span ref={linkRef} className="font-mono text-sm text-muted-foreground">
        {display}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
        {copied ? <Check /> : <Copy />}
        {copied ? "Copiado" : "Copiar link"}
      </Button>
      <Button asChild size="sm">
        <a href={url} target="_blank" rel="noreferrer">
          <ExternalLink /> Abrir página
        </a>
      </Button>
    </div>
  );
}

/** Borrar la página entera, con confirmación. No se puede deshacer. */
export function ExampleDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const res = await deleteExample(id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo borrar");
      return;
    }
    toast.success(`Página de ${name} borrada`);
    router.push("/super/ejemplos");
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 /> Borrar página
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Borrar la página de {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borran sus productos, fotos y diseño, y el link deja de funcionar. Su dirección queda libre por si el negocio se registra. No se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void remove();
            }}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy && <Loader2 className="animate-spin" />}
            Borrar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
