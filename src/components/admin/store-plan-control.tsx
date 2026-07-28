"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setStorePlan } from "@/app/(superadmin)/super/suscripciones/actions";

/**
 * Control manual del plan de una tienda. "Pro de cortesía" es la palanca para
 * los amigos: Pro sin vencimiento, con una nota de por qué.
 */
export function StorePlanControl({
  storeId,
  note,
}: {
  storeId: string;
  note: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState(12);
  const [text, setText] = useState(note ?? "");
  const [busy, setBusy] = useState(false);

  async function run(action: "free" | "months" | "comp") {
    setBusy(true);
    const res = await setStorePlan({ storeId, action, months, note: text });
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Plan actualizado");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label="Cambiar plan"
      >
        <Settings2 className="size-4" />
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Nota interna (por qué tiene este plan)</Label>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej: amigo, tienda de prueba, canje"
          className="h-9"
          maxLength={200}
        />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Meses</Label>
          <Input
            type="number"
            min={1}
            max={120}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="h-9 w-20"
          />
        </div>
        <Button size="sm" onClick={() => run("months")} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} Sumar Pro
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => run("comp")}
          disabled={busy}
        >
          <Gift className="size-4" /> Pro de cortesía
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => run("free")}
          disabled={busy}
        >
          Bajar a Gratis
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
