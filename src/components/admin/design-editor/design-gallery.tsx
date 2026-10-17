"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProChip } from "@/components/admin/pro-lock";
import { applyDesignPatch } from "@/app/(admin)/panel/personalizar/design-actions";
import { RUBROS, encodePatch, type DesignPatch, type RubroId } from "@/lib/design/bases";
import type { DesignTokens } from "@/lib/design/types";
import { cn } from "@/lib/utils";

/** Lo que la vitrina necesita de cada diseño base (sin funciones: viene del servidor). */
export interface GalleryBase {
  id: string;
  name: string;
  tagline: string;
  description: string;
  pro: boolean;
  palettes: Record<RubroId, DesignTokens["colors"]>;
}

/**
 * La vitrina de diseños. Se elige un diseño base y un rubro, y se ve al
 * instante la tienda de verdad (con sus productos) vestida así. Nada se guarda
 * hasta "Usar este diseño", y aun así queda como borrador para publicar.
 */
export function DesignGallery({
  bases,
  pro,
  initialRubro,
  currentBase,
}: {
  bases: GalleryBase[];
  pro: boolean;
  initialRubro: RubroId;
  /** El diseño base que ya tiene el borrador, si salió de la vitrina. */
  currentBase?: string;
}) {
  const router = useRouter();
  const [baseId, setBaseId] = useState(currentBase ?? bases[0]!.id);
  const [rubro, setRubro] = useState<RubroId>(initialRubro);
  const [withSections, setWithSections] = useState(true);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const base = bases.find((b) => b.id === baseId) ?? bases[0]!;
  const patch: DesignPatch = useMemo(
    () => ({ base: baseId, rubro, keepSections: !withSections }),
    [baseId, rubro, withSections],
  );
  const src = `/vista-previa?vitrina=1&p=${encodePatch(patch)}`;

  async function apply() {
    setApplying(true);
    const res = await applyDesignPatch(patch);
    setApplying(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`¡Listo! Tu borrador ahora usa ${base.name}`, {
      description: "Ajusta lo que quieras y toca Publicar cuando te guste.",
    });
    router.push("/panel/personalizar");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diseños</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Elige un diseño y tu rubro: lo ves al instante con tus productos. Tus textos, fotos y
            preguntas se conservan.
          </p>
        </div>
        <Link
          href="/panel/personalizar"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Volver al editor
        </Link>
      </div>

      <div className="grid gap-4 lg:h-[calc(100dvh-10rem)] lg:grid-cols-[380px_1fr]">
        <div className="flex min-h-0 flex-col rounded-2xl border bg-card">
          <div className="space-y-2 border-b p-4">
            <p className="text-xs font-medium text-muted-foreground">Tu rubro</p>
            <div className="flex flex-wrap gap-1.5">
              {RUBROS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRubro(r.id);
                    setLoading(true);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    rubro === r.id ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            {bases.map((b) => {
              const active = b.id === baseId;
              const c = b.palettes[rubro];
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBaseId(b.id);
                    setLoading(true);
                  }}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors",
                    active ? "border-primary ring-1 ring-primary" : "hover:border-primary/40",
                  )}
                >
                  <span
                    className="grid size-12 shrink-0 place-items-center rounded-xl text-lg font-bold"
                    style={{ background: c.surface, color: c.primary, boxShadow: `inset 0 0 0 1px ${c.primary}22` }}
                  >
                    {b.name[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold">{b.name}</span>
                      <span className="text-xs text-muted-foreground">· {b.tagline}</span>
                      {b.pro && !pro && <ProChip />}
                      {b.id === currentBase && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          El tuyo
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{b.description}</span>
                    <span className="mt-2 flex gap-1">
                      {[c.primary, c.accent, c.surface].map((color, i) => (
                        <span
                          key={i}
                          className="size-4 rounded-full ring-1 ring-border"
                          style={{ background: color }}
                        />
                      ))}
                    </span>
                  </span>
                  {active && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>

          <div className="space-y-3 border-t p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="secciones" className="text-xs font-medium">
                  Usar también sus secciones
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Apagado: solo cambia el estilo y quedan tus secciones como están.
                </p>
              </div>
              <Switch
                id="secciones"
                checked={withSections}
                onCheckedChange={(v) => {
                  setWithSections(v);
                  setLoading(true);
                }}
              />
            </div>
            {base.pro && !pro && (
              <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs">
                {base.name} es un diseño Pro: puedes probarlo en tu borrador, y para publicarlo
                necesitas Pro.
              </p>
            )}
            <Button onClick={apply} disabled={applying} className="w-full" size="lg">
              {applying ? <Loader2 className="animate-spin" /> : <Check />}
              Usar {base.name}
            </Button>
          </div>
        </div>

        <div className="relative min-h-[70dvh] overflow-hidden rounded-2xl border bg-muted/40 lg:min-h-0">
          <div className="absolute right-3 top-3 z-10 hidden rounded-lg border bg-background lg:flex">
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              className={cn("p-2", device === "mobile" ? "text-primary" : "text-muted-foreground")}
              aria-label="Ver en teléfono"
            >
              <Smartphone className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              className={cn("border-l p-2", device === "desktop" ? "text-primary" : "text-muted-foreground")}
              aria-label="Ver en computadora"
            >
              <Monitor className="size-4" />
            </button>
          </div>
          {loading && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-background/40">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className={cn("mx-auto h-full transition-[max-width] duration-300", device === "mobile" ? "max-w-[400px] lg:py-4" : "max-w-none")}>
            <iframe
              key={src}
              src={src}
              title={`Vista previa con el diseño ${base.name}`}
              onLoad={() => setLoading(false)}
              className={cn("h-[70dvh] w-full bg-background lg:h-full", device === "mobile" && "lg:rounded-2xl lg:border lg:shadow-sm")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
