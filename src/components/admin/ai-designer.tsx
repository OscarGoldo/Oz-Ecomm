"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ProUpsell } from "@/components/admin/pro-lock";
import {
  StorePreview,
  type SampleProduct,
} from "@/components/admin/store-preview";
import {
  applyAiDesign,
  generateAiDesign,
} from "@/app/(admin)/panel/personalizar/ia/actions";
import type { ThemeInput } from "@/app/(admin)/panel/personalizar/actions";
import type { AiDesignQuota, DesignProposal } from "@/lib/ai-design";
import { THEME_FONTS, THEME_PRESETS } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Para el que se queda en blanco: un clic y tiene por dónde empezar. */
const EXAMPLES = [
  {
    label: "Ropa de mujer",
    text: "Vendo ropa de mujer casual y elegante en Valencia. Mis clientas tienen entre 25 y 40 años y me compran por Instagram. Quiero que la tienda se vea fresca y femenina.",
  },
  {
    label: "Celulares",
    text: "Tienda de celulares y accesorios en Caracas. Hacemos delivery y aceptamos pago móvil y Zelle. Queremos vernos modernos y confiables.",
  },
  {
    label: "Postres",
    text: "Hago tortas y postres por encargo en Maracaibo. Todo es casero, con recetas de familia. Quiero algo cálido y alegre.",
  },
];

const LOADING_STEPS = [
  "Leyendo lo que nos contaste…",
  "Eligiendo la plantilla…",
  "Buscando colores que combinen…",
  "Escribiendo tus textos…",
  "Armando las tres propuestas…",
];

export function AiDesigner({
  storeName,
  logoUrl,
  sampleProducts,
  quota: initialQuota,
  dailyLimit,
  hasDescription,
}: {
  storeName: string;
  logoUrl: string | null;
  sampleProducts: SampleProduct[];
  /** Cuántos diseños puede pedir, según su plan. */
  quota: AiDesignQuota;
  /** Tope diario de Pro, para el "te quedan X de Y". */
  dailyLimit: number;
  /** Ya tiene descripción: no se la pisamos salvo que la pida. */
  hasDescription: boolean;
}) {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [proposals, setProposals] = useState<DesignProposal[] | null>(null);
  const [selected, setSelected] = useState(0);
  const [useDescription, setUseDescription] = useState(!hasDescription);
  const [applying, setApplying] = useState(false);
  const [quota, setQuota] = useState(initialQuota);
  // Gratis y ya usó su prueba: lo que sigue es Pro, no otro intento.
  const needsPro = !quota.pro && quota.freeUsed;

  // Tarda cerca de un minuto: que se note que está trabajando.
  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const id = setInterval(
      () => setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)),
      7000,
    );
    return () => clearInterval(id);
  }, [loading]);

  async function generate() {
    setLoading(true);
    try {
      const res = await generateAiDesign({ brief });
      if (res.quota) setQuota(res.quota);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setProposals(res.proposals);
      setSelected(0);
    } catch {
      toast.error("Se cortó la conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    const proposal = proposals?.[selected];
    if (!proposal) return;
    setApplying(true);
    const res = await applyAiDesign({
      theme: proposal.theme as ThemeInput,
      description: useDescription ? proposal.description : null,
    });
    setApplying(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    toast.success(
      res.draft ? "¡Listo! Quedó como borrador en tu editor" : "¡Listo! Tu tienda ya tiene su nuevo diseño",
      {
        description: res.draft
          ? "Revísalo, ajusta lo que quieras y toca Publicar."
          : "Aquí puedes ajustar cualquier detalle.",
      },
    );
    router.push("/panel/personalizar");
    router.refresh();
  }

  const current = proposals?.[selected];
  const canGenerate = brief.trim().length >= 15 && quota.remaining > 0 && !loading;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diseñar con IA</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Cuéntanos de tu negocio y te proponemos tres diseños con plantilla,
            colores y textos. Después puedes cambiar lo que quieras.
          </p>
        </div>
        <Link
          href="/panel/personalizar"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Volver a Personalizar
        </Link>
      </div>

      {loading ? (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="grid place-items-center gap-3 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="size-6 animate-spin" />
            </span>
            <p className="font-medium">{LOADING_STEPS[loadingStep]}</p>
            <p className="text-sm text-muted-foreground">
              Esto toma cerca de un minuto. No cierres esta página.
            </p>
          </CardContent>
        </Card>
      ) : (!proposals || !current) && needsPro ? (
        <ProUpsell
          className="max-w-2xl"
          title="Ya usaste tu diseño gratis con IA"
          text={`Con Pro pides nuevos diseños con IA cuando quieras (hasta ${dailyLimit} al día) y la IA puede usar todas las plantillas.`}
        />
      ) : !proposals || !current ? (
        <Card className="max-w-2xl rounded-2xl shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1.5">
              <Label htmlFor="brief">
                ¿Qué vendes y cómo quieres que se vea tu tienda?
              </Label>
              <Textarea
                id="brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                maxLength={1500}
                rows={5}
                placeholder="Ej. Vendo ropa de mujer casual en Valencia. Mis clientas compran por Instagram y quiero que la tienda se vea fresca y femenina."
              />
              <p className="text-xs text-muted-foreground">
                Mientras más nos cuentes (qué vendes, a quién, dónde, cómo quieres
                que se sienta), mejor queda. Si ya subiste tu logo o productos,
                también los tomamos en cuenta.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                ¿No sabes cómo empezar? Prueba con un ejemplo:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => setBrief(ex.text)}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                {quotaText(quota, dailyLimit)}
              </p>
              <Button onClick={generate} disabled={!canGenerate} size="lg">
                <Sparkles /> Diseñar mi tienda
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        // En el teléfono: elegir, ver, leer. En pantalla grande la vista previa
        // queda fija a la derecha de las dos tarjetas.
        <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:grid-rows-[auto_1fr] lg:gap-x-6">
          <Card className="rounded-2xl shadow-sm lg:col-start-1 lg:row-start-1">
            <CardHeader>
              <CardTitle className="text-base">Elige la que más te guste</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {proposals.map((p, i) => {
                const template = THEME_PRESETS.find((t) => t.id === p.theme.layout);
                const font = THEME_FONTS.find((f) => f.id === p.theme.font);
                const active = i === selected;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors",
                      active ? "border-primary ring-1 ring-primary" : "hover:border-primary/40",
                    )}
                  >
                    <span className="mt-0.5 flex shrink-0 -space-x-1.5">
                      {[p.theme.colors.primary, p.theme.colors.accent, p.theme.colors.surface].map(
                        (c, j) => (
                          <span
                            key={j}
                            className="size-6 rounded-full border-2 border-background ring-1 ring-border"
                            style={{ background: c }}
                          />
                        ),
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold">{p.name}</span>
                        {i === 0 && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            Recomendada
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Plantilla {template?.label ?? p.theme.layout} · {font?.label ?? p.theme.font}
                      </span>
                      <span className="mt-1 block text-xs">{p.rationale}</span>
                    </span>
                    {active && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="space-y-3 lg:sticky lg:top-20">
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Check className="size-4" /> Vista previa
              </div>
              <StorePreview
                theme={current.theme}
                storeName={storeName}
                logoUrl={logoUrl}
                products={sampleProducts}
              />
              <Button onClick={apply} disabled={applying} className="w-full" size="lg">
                {applying ? <Loader2 className="animate-spin" /> : <Check />}
                Usar este diseño
              </Button>
              {needsPro ? (
                <p className="text-center text-xs text-muted-foreground">
                  Con Pro pides otras propuestas cuando quieras.{" "}
                  <Link href="/panel/plan" className="font-medium text-primary hover:underline">
                    Ver Pro
                  </Link>
                </p>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={applying || quota.remaining <= 0}
                    onClick={() => setProposals(null)}
                  >
                    <RotateCcw /> Pedir otras propuestas
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    {quotaText(quota, dailyLimit)}
                  </p>
                </>
              )}
            </div>
          </div>

          <Card className="self-start rounded-2xl shadow-sm lg:col-start-1 lg:row-start-2">
            <CardHeader>
              <CardTitle className="text-base">Textos de esta propuesta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <TextRow label="Titular" value={current.theme.hero.headline} />
              <TextRow label="Subtítulo" value={current.theme.hero.subtext} />
              <TextRow label="Botón" value={current.theme.hero.ctaText} />
              {current.theme.announcement.enabled && (
                <TextRow label="Barra de anuncio" value={current.theme.announcement.text} />
              )}
              {current.theme.about.text && (
                <TextRow
                  label={current.theme.about.title || "Sobre nosotros"}
                  value={current.theme.about.text}
                />
              )}
              {current.description && (
                <div className="space-y-2 rounded-lg border p-3">
                  <TextRow label="Descripción de la tienda" value={current.description} />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Usarla también en Google y cuando compartes el enlace.
                    </p>
                    <Switch
                      checked={useDescription}
                      onCheckedChange={setUseDescription}
                      aria-label="Usar esta descripción"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/** La línea de "cuántos te quedan", dicha según el plan. */
function quotaText(q: AiDesignQuota, dailyLimit: number): string {
  if (q.pro) {
    return q.remaining > 0
      ? `Te quedan ${q.remaining} de ${dailyLimit} diseños por hoy.`
      : "Ya usaste los diseños de hoy. Mañana puedes pedir más.";
  }
  if (q.freeUsed) return "Ya usaste tu diseño gratis con IA.";
  return q.remaining > 0
    ? "Tu plan Gratis incluye un diseño con IA, con las plantillas estándar."
    : "Por hoy no puedes pedir más. Intenta mañana.";
}

function TextRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="whitespace-pre-line">{value}</p>
    </div>
  );
}
