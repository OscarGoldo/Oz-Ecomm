"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { createPromoCode } from "@/app/(superadmin)/super/codigos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { monthsLabel, normalizePromoCode } from "@/lib/promo";

/**
 * Crear un código promocional. Arranca con lo de una campaña típica —3 meses,
 * 10 cupos— para que lo normal sea escribir el nombre y tocar crear.
 */
export function PromoCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [months, setMonths] = useState("3");
  const [maxUses, setMaxUses] = useState("10");
  const [expiresOn, setExpiresOn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await createPromoCode({
      code,
      months: Number(months),
      // Vacío = sin límite: un campo en blanco no puede querer decir "cero".
      max_uses: maxUses.trim() === "" ? null : Number(maxUses),
      expires_on: expiresOn || null,
      note,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo crear el código");
      return;
    }
    toast.success(`Código ${normalizePromoCode(code)} creado`);
    setCode("");
    setNote("");
    setExpiresOn("");
    router.refresh();
  }

  const n = Number(months);
  const cupos = maxUses.trim() === "" ? null : Number(maxUses);

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="promo-code">Código</Label>
          <Input
            id="promo-code"
            value={code}
            onChange={(e) => setCode(normalizePromoCode(e.target.value))}
            placeholder="Ej. MARIA10"
            autoComplete="off"
            className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
            required
          />
          <p className="text-xs text-muted-foreground">
            Solo letras y números. Es lo que la persona escribe al registrarse.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="promo-months">Meses de Pro gratis</Label>
          <Input
            id="promo-months"
            type="number"
            inputMode="numeric"
            min={1}
            max={24}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="promo-uses">Cupos</Label>
          <Input
            id="promo-uses"
            type="number"
            inputMode="numeric"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Sin límite"
          />
          <p className="text-xs text-muted-foreground">
            Cuántas tiendas lo pueden usar. Vacío = sin límite.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="promo-expires">
            Último día para usarlo{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="promo-expires"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="promo-note">
            Nota interna{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="promo-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej. campaña con María en Instagram"
            maxLength={200}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {n >= 1 && code
            ? cupos
              ? `Las primeras ${cupos} tiendas que se registren con ${code} tendrán ${monthsLabel(n)} de Pro gratis.`
              : `Toda tienda que se registre con ${code} tendrá ${monthsLabel(n)} de Pro gratis.`
            : "Al terminar los meses gratis, la tienda tiene 7 días de gracia y, si no paga, se pausa."}
        </p>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Plus />} Crear código
        </Button>
      </div>
    </form>
  );
}
