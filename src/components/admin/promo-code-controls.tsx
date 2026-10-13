"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { setPromoCodeActive } from "@/app/(superadmin)/super/codigos/actions";
import { Switch } from "@/components/ui/switch";

/** Prende o apaga un código desde la lista. */
export function PromoActiveSwitch({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      checked={active}
      disabled={pending}
      onCheckedChange={(v) =>
        startTransition(async () => {
          const res = await setPromoCodeActive(id, v);
          if (!res.ok) {
            toast.error(res.error ?? "Error");
            return;
          }
          toast.success(v ? "Código activado" : "Código apagado");
          router.refresh();
        })
      }
      aria-label="Activo"
    />
  );
}

/**
 * El link de la campaña, con su botón de copiar: es lo que se le pasa al
 * influencer. Quien entra por él llega al registro con el código ya puesto.
 */
export function PromoLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("No se pudo copiar. Copia el link a mano.");
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
      <span className="min-w-0 flex-1 select-all truncate font-mono text-xs">
        {url}
      </span>
      <button
        type="button"
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      >
        {copied ? (
          <Check className="size-3.5 text-success" />
        ) : (
          <Copy className="size-3.5" />
        )}
        {copied ? "Copiado" : "Copiar link"}
      </button>
    </div>
  );
}
