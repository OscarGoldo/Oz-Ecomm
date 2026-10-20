"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateExampleDesign } from "@/app/(superadmin)/super/ejemplos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RUBROS } from "@/lib/design/bases";
import { cn } from "@/lib/utils";

type Colors = { primary: string; accent: string; surface: string };

export interface ExampleDesignValues {
  base: string;
  colors: Colors;
  headline: string;
  subtext: string;
  ctaText: string;
  announcement: string;
  aboutTitle: string;
  aboutText: string;
}

/** Lo justo de cada diseño base para elegirlo acá (las paletas por rubro van aparte). */
export interface BaseOption {
  id: string;
  name: string;
  tagline: string;
  palettes: Record<string, Colors>;
}

/**
 * El diseño de la página ejemplo: diseño base, colores y los textos de la
 * portada. Es lo que más cambia de un negocio a otro; el resto de las
 * secciones las pone el diseño base.
 */
export function ExampleDesignForm({
  storeId,
  initial,
  bases,
}: {
  storeId: string;
  initial: ExampleDesignValues;
  bases: BaseOption[];
}) {
  const router = useRouter();
  const [v, setV] = useState<ExampleDesignValues>(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ExampleDesignValues>(key: K, value: ExampleDesignValues[K]) =>
    setV((d) => ({ ...d, [key]: value }));
  const base = bases.find((b) => b.id === v.base) ?? bases[0];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await updateExampleDesign(storeId, v);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    toast.success("Diseño guardado");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-base font-semibold">Diseño y portada</h2>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Diseño base</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {bases.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => set("base", b.id)}
              aria-pressed={v.base === b.id}
              className={cn(
                "rounded-lg border p-2.5 text-left transition-colors",
                v.base === b.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input hover:bg-muted",
              )}
            >
              <span className="block text-sm font-semibold">{b.name}</span>
              <span className="block text-xs text-muted-foreground">{b.tagline}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Colores</legend>
        <div className="flex flex-wrap gap-1.5">
          {RUBROS.map((r) => {
            const pal = base.palettes[r.id];
            if (!pal) return null;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => set("colors", pal)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
              >
                <span className="flex">
                  <span className="size-3.5 rounded-full border" style={{ background: pal.primary }} />
                  <span className="-ml-1 size-3.5 rounded-full border" style={{ background: pal.accent }} />
                </span>
                {r.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 pt-1">
          {(
            [
              ["primary", "Principal"],
              ["accent", "Acento"],
              ["surface", "Fondo"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="color"
                value={v.colors[key]}
                onChange={(e) => set("colors", { ...v.colors, [key]: e.target.value })}
                className="h-9 w-11 cursor-pointer rounded border border-input bg-background p-0.5"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="d-headline">Titular de la portada</Label>
        <Input id="d-headline" value={v.headline} onChange={(e) => set("headline", e.target.value)} maxLength={140} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="d-subtext">Frase</Label>
        <Input id="d-subtext" value={v.subtext} onChange={(e) => set("subtext", e.target.value)} maxLength={240} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="d-cta">Texto del botón</Label>
          <Input id="d-cta" value={v.ctaText} onChange={(e) => set("ctaText", e.target.value)} maxLength={40} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-ann">Barra de anuncio</Label>
          <Input
            id="d-ann"
            value={v.announcement}
            onChange={(e) => set("announcement", e.target.value)}
            maxLength={140}
            placeholder="Delivery en toda la ciudad"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="d-about-t">Sobre nosotros</Label>
        <Input
          id="d-about-t"
          value={v.aboutTitle}
          onChange={(e) => set("aboutTitle", e.target.value)}
          maxLength={80}
          placeholder="Sobre nosotros"
        />
        <Textarea
          value={v.aboutText}
          onChange={(e) => set("aboutText", e.target.value)}
          rows={3}
          maxLength={2000}
          aria-label="Texto de sobre nosotros"
        />
      </div>

      <Button type="submit" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />}
        Guardar diseño
      </Button>
    </form>
  );
}
