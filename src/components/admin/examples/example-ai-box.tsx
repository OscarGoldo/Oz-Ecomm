"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ImageOff, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { applyProposal, proposeExample } from "@/app/(superadmin)/super/ejemplos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExampleProposal } from "@/lib/ai-example";
import { stockPhotoUrl } from "@/lib/example-photos";
import { formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * El atajo: le cuentas a la IA qué vende el negocio y propone el catálogo,
 * los textos de la portada y las preguntas frecuentes. Nada se guarda hasta
 * tocar "Agregar"; se puede desmarcar lo que no convenza.
 */
export function ExampleAiBox({
  storeId,
  initialAbout,
  available,
  hasProducts,
}: {
  storeId: string;
  initialAbout: string;
  available: boolean;
  hasProducts: boolean;
}) {
  const router = useRouter();
  const [about, setAbout] = useState(initialAbout);
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proposal, setProposal] = useState<ExampleProposal | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [useTexts, setUseTexts] = useState(true);

  async function propose() {
    setBusy(true);
    const res = await proposeExample(storeId, { about, city });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setProposal(res.proposal);
    setPicked(new Set(res.proposal.products.map((_, i) => i)));
    // Si ya hay productos, lo más probable es que se pida una tanda más, no
    // rehacer la portada.
    setUseTexts(!hasProducts);
  }

  async function apply() {
    if (!proposal) return;
    setSaving(true);
    const res = await applyProposal(storeId, {
      products: proposal.products.filter((_, i) => picked.has(i)),
      texts: useTexts ? proposal.texts : null,
      faq: useTexts ? proposal.faq : [],
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    toast.success("Listo, ya está en la página");
    setProposal(null);
    router.refresh();
  }

  function toggle(i: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  if (!available) {
    return (
      <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
        La IA no está configurada en este servidor (falta <code className="font-mono text-xs">ANTHROPIC_API_KEY</code>). Puedes cargar los productos a mano abajo.
      </p>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold">Armar con IA</h2>
          <p className="text-sm text-muted-foreground">
            Cuéntale qué vende el negocio y te propone productos con precios, los textos de la portada y las preguntas frecuentes.
          </p>
        </div>
      </div>

      {!proposal && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-about">¿Qué vende?</Label>
            <Textarea
              id="ai-about"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={3}
              maxLength={1200}
              placeholder="iPhones nuevos y usados del 11 al 15, forros, vidrios templados, cargadores originales y AirPods."
            />
          </div>
          <div className="space-y-1.5 sm:max-w-xs">
            <Label htmlFor="ai-city">Ciudad (opcional)</Label>
            <Input id="ai-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Maturín" maxLength={60} />
          </div>
          <Button type="button" onClick={propose} disabled={busy || about.trim().length < 8}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {busy ? "Armando la propuesta…" : hasProducts ? "Proponer más productos" : "Proponer catálogo"}
          </Button>
          {busy && <p className="text-xs text-muted-foreground">Tarda entre 20 segundos y un minuto.</p>}
        </div>
      )}

      {proposal && (
        <div className="space-y-4">
          <ul className="divide-y rounded-lg border">
            {proposal.products.map((p, i) => {
              const on = picked.has(i);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    aria-pressed={on}
                    className={cn("flex w-full items-center gap-3 p-2.5 text-left transition-opacity", !on && "opacity-50")}
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded border",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {on && <Check className="size-3.5" />}
                    </span>
                    <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                      {p.photo ? (
                        <Image src={stockPhotoUrl(p.photo, 200)} alt="" fill sizes="44px" className="object-cover" />
                      ) : (
                        <ImageOff className="size-4 text-muted-foreground" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{p.category}</span>
                    </span>
                    <span className="shrink-0 text-right text-sm font-semibold tabular-nums">
                      {formatUSD(p.price)}
                      {p.compareAtPrice && (
                        <span className="block text-xs font-normal text-muted-foreground line-through">
                          {formatUSD(p.compareAtPrice)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <label className="flex items-start gap-2.5 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              checked={useTexts}
              onChange={(e) => setUseTexts(e.target.checked)}
              className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
            />
            <span>
              <span className="font-medium">Usar también la portada y las preguntas</span>
              <span className="block text-muted-foreground">
                «{proposal.texts.headline}» · {proposal.faq.length} preguntas frecuentes
              </span>
            </span>
          </label>

          <p className="text-xs text-muted-foreground">
            Los que no tienen foto quedan sin foto: súbeles la del negocio después, desde la lista de productos.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={apply} disabled={saving || (picked.size === 0 && !useTexts)}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />}
              Agregar {picked.size} {picked.size === 1 ? "producto" : "productos"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setProposal(null)} disabled={saving}>
              Descartar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
