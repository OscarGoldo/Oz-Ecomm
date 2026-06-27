"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Cpu,
  Dumbbell,
  Flame,
  Flower,
  Gem,
  Loader2,
  Medal,
  Plus,
  Save,
  Shirt,
  Sparkles,
  Store,
  Trash2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  StorePreview,
  type SampleProduct,
} from "@/components/admin/store-preview";
import { ImageUploader } from "@/components/admin/image-uploader";
import {
  updateStoreTheme,
  type ThemeInput,
} from "@/app/(admin)/panel/personalizar/actions";
import {
  LAYOUT_BLOCKS,
  LAYOUT_MEDIA,
  SECTION_LABELS,
  THEME_FONTS,
  THEME_PRESETS,
  seedBlocks,
  type ButtonStyle,
  type CardStyle,
  type LayoutId,
  type MediaKey,
  type SectionId,
  type StoreTheme,
  type ThemeBlock,
  type ThemeFont,
  type Testimonial,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const ALL_SECTIONS: SectionId[] = ["featured", "catalog", "about"];

const PRESET_ICONS: Record<string, LucideIcon> = {
  store: Store,
  shirt: Shirt,
  medal: Medal,
  flame: Flame,
  gem: Gem,
  sparkles: Sparkles,
  flower: Flower,
  cpu: Cpu,
  dumbbell: Dumbbell,
  zap: Zap,
};

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded border bg-background"
          aria-label={label}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 font-mono text-sm" />
      </div>
    </div>
  );
}

function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            value === o.id ? "border-primary bg-primary/5 text-primary" : "hover:border-primary/40",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ThemeEditor({
  store,
  initialTheme,
  logoUrl,
  sampleProducts,
}: {
  store: { id: string; name: string; slug: string };
  initialTheme: StoreTheme;
  logoUrl: string | null;
  sampleProducts: SampleProduct[];
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<StoreTheme>(initialTheme);
  const [saving, setSaving] = useState(false);

  const onList = theme.sections;
  const offList = ALL_SECTIONS.filter((s) => !onList.includes(s));
  const blockDefs = LAYOUT_BLOCKS[theme.layout];
  const mediaDefs = LAYOUT_MEDIA[theme.layout];
  const showTestimonials = blockDefs?.some((d) => d.id === "testimonios");

  function patch(p: Partial<StoreTheme>) {
    setTheme((t) => ({ ...t, ...p, preset: "custom" }));
  }
  function applyPreset(presetId: string) {
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const layout = presetId as LayoutId;
    const seeded = seedBlocks(layout, {
      blocks: theme.blocks,
      blockOrder: theme.blockOrder,
    });
    setTheme((t) => ({
      ...t,
      ...preset.theme,
      preset: presetId,
      layout,
      blocks: seeded.blocks,
      blockOrder: seeded.blockOrder,
    }));
  }
  function patchBlock(id: string, partial: Partial<ThemeBlock>) {
    setTheme((t) => {
      const current = t.blocks[id] ?? { enabled: true, title: "", subtitle: "" };
      return {
        ...t,
        blocks: { ...t.blocks, [id]: { ...current, ...partial } },
        preset: "custom",
      };
    });
  }
  function moveBlock(index: number, dir: -1 | 1) {
    setTheme((t) => {
      const target = index + dir;
      if (target < 0 || target >= t.blockOrder.length) return t;
      const next = [...t.blockOrder];
      const [m] = next.splice(index, 1);
      next.splice(target, 0, m!);
      return { ...t, blockOrder: next, preset: "custom" };
    });
  }
  function setMedia(key: MediaKey, next: string[]) {
    setTheme((t) => ({
      ...t,
      media: { ...t.media, [key]: next },
      preset: "custom",
    }));
  }
  function addTestimonial() {
    setTheme((t) => ({
      ...t,
      testimonials: [...t.testimonials, { quote: "", author: "" }],
      preset: "custom",
    }));
  }
  function updateTestimonial(index: number, partial: Partial<Testimonial>) {
    setTheme((t) => ({
      ...t,
      testimonials: t.testimonials.map((x, i) =>
        i === index ? { ...x, ...partial } : x,
      ),
      preset: "custom",
    }));
  }
  function removeTestimonial(index: number) {
    setTheme((t) => ({
      ...t,
      testimonials: t.testimonials.filter((_, i) => i !== index),
      preset: "custom",
    }));
  }
  function toggleSection(id: SectionId, on: boolean) {
    setTheme((t) => {
      const sections = on
        ? [...t.sections, id]
        : t.sections.filter((s) => s !== id);
      return { ...t, sections, preset: "custom" };
    });
  }
  function moveSection(index: number, dir: -1 | 1) {
    setTheme((t) => {
      const target = index + dir;
      if (target < 0 || target >= t.sections.length) return t;
      const next = [...t.sections];
      const [m] = next.splice(index, 1);
      next.splice(target, 0, m!);
      return { ...t, sections: next, preset: "custom" };
    });
  }

  async function save() {
    setSaving(true);
    const res = await updateStoreTheme(theme as ThemeInput);
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "No se pudo guardar");
    toast.success("Diseño guardado");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_360px]">
      {/* Controls */}
      <div className="order-2 space-y-5 lg:order-1">
        {/* Presets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plantillas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {THEME_PRESETS.map((p) => {
              const Icon = PRESET_ICONS[p.icon] ?? Store;
              const active = theme.layout === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={cn(
                    "overflow-hidden rounded-xl border text-left transition-colors",
                    active ? "border-primary ring-1 ring-primary" : "hover:border-primary/40",
                  )}
                >
                  <div
                    className="flex h-12 items-center justify-between px-3"
                    style={{ background: p.theme.colors.primary }}
                  >
                    <Icon className="size-5 text-white/90" />
                    <span
                      className="size-4 rounded-full ring-2 ring-white/40"
                      style={{ background: p.theme.colors.accent }}
                    />
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold">{p.label}</p>
                    <p className="text-[11px] text-muted-foreground">{p.desc}</p>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Colors + typography */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colores y estilo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <ColorField label="Principal" value={theme.colors.primary} onChange={(v) => patch({ colors: { ...theme.colors, primary: v } })} />
              <ColorField label="Acento" value={theme.colors.accent} onChange={(v) => patch({ colors: { ...theme.colors, accent: v } })} />
              <ColorField label="Fondo" value={theme.colors.surface} onChange={(v) => patch({ colors: { ...theme.colors, surface: v } })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipografía</Label>
              <Select value={theme.font} onValueChange={(v) => patch({ font: v as ThemeFont })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {THEME_FONTS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Botones</Label>
                <Choice<ButtonStyle>
                  value={theme.buttonStyle}
                  onChange={(v) => patch({ buttonStyle: v })}
                  options={[{ id: "rounded", label: "Redondeado" }, { id: "square", label: "Cuadrado" }]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tarjetas</Label>
                <Choice<CardStyle>
                  value={theme.cardStyle}
                  onChange={(v) => patch({ cardStyle: v })}
                  options={[{ id: "soft", label: "Suave" }, { id: "bordered", label: "Con borde" }]}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Announcement + hero texts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Textos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Barra de anuncio</p>
                <p className="text-xs text-muted-foreground">Una franja arriba de todo.</p>
              </div>
              <Switch
                checked={theme.announcement.enabled}
                onCheckedChange={(v) => patch({ announcement: { ...theme.announcement, enabled: v } })}
              />
            </div>
            {theme.announcement.enabled && (
              <Input
                value={theme.announcement.text}
                onChange={(e) => patch({ announcement: { ...theme.announcement, text: e.target.value } })}
                placeholder="Ej. Envío gratis en compras > $50"
              />
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Titular de portada</Label>
              <Input
                value={theme.hero.headline}
                onChange={(e) => patch({ hero: { ...theme.hero, headline: e.target.value } })}
                placeholder={`Bienvenido a ${store.name}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subtítulo</Label>
              <Input
                value={theme.hero.subtext}
                onChange={(e) => patch({ hero: { ...theme.hero, subtext: e.target.value } })}
                placeholder="Frase corta de tu tienda"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Texto del botón</Label>
              <Input
                value={theme.hero.ctaText}
                onChange={(e) => patch({ hero: { ...theme.hero, ctaText: e.target.value } })}
                placeholder="Ver productos"
              />
            </div>
          </CardContent>
        </Card>

        {/* Sections */}
        {blockDefs ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Secciones del diseño</CardTitle>
              <p className="text-xs text-muted-foreground">
                Activá, renombrá y reordená las secciones de tu home.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {theme.blockOrder.map((id, i) => {
                const def = blockDefs.find((d) => d.id === id);
                if (!def) return null;
                const block = theme.blocks[id] ?? {
                  enabled: true,
                  title: "",
                  subtitle: "",
                };
                return (
                  <div key={id} className="rounded-lg border p-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moveBlock(i, -1)}
                          disabled={i === 0}
                          className="text-muted-foreground enabled:hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBlock(i, 1)}
                          disabled={i === theme.blockOrder.length - 1}
                          className="text-muted-foreground enabled:hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                      </div>
                      <span className="flex-1 text-sm font-medium">{def.label}</span>
                      {def.removable ? (
                        <Switch
                          checked={block.enabled}
                          onCheckedChange={(v) => patchBlock(id, { enabled: v })}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">Fija</span>
                      )}
                    </div>

                    {block.enabled && def.fields.length > 0 && (
                      <div className="mt-2.5 space-y-2 border-t pt-2.5">
                        {def.fields.includes("title") && (
                          <Input
                            value={block.title}
                            onChange={(e) => patchBlock(id, { title: e.target.value })}
                            placeholder={def.defaultTitle}
                            className="h-9"
                          />
                        )}
                        {def.fields.includes("subtitle") && (
                          <Input
                            value={block.subtitle}
                            onChange={(e) => patchBlock(id, { subtitle: e.target.value })}
                            placeholder={def.defaultSubtitle ?? "Subtítulo"}
                            className="h-9"
                          />
                        )}
                        {def.fields.includes("body") && (
                          <Textarea
                            value={theme.about.text}
                            onChange={(e) =>
                              patch({ about: { ...theme.about, text: e.target.value } })
                            }
                            placeholder="Contá la historia de tu tienda…"
                            rows={3}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Non-reorderable extras (e.g. countdown toggle) */}
              {blockDefs
                .filter((d) => !d.reorderable && d.removable)
                .map((def) => {
                  const block = theme.blocks[def.id] ?? {
                    enabled: true,
                    title: "",
                    subtitle: "",
                  };
                  return (
                    <div
                      key={def.id}
                      className="flex items-center gap-2 rounded-lg border border-dashed p-2.5"
                    >
                      <span className="flex-1 text-sm font-medium">{def.label}</span>
                      <Switch
                        checked={block.enabled}
                        onCheckedChange={(v) => patchBlock(def.id, { enabled: v })}
                      />
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Secciones de la home</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {onList.map((id, i) => (
                <div key={id} className="flex items-center gap-2 rounded-lg border p-2.5">
                  <div className="flex flex-col">
                    <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0} className="text-muted-foreground enabled:hover:text-foreground disabled:opacity-30">
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button type="button" onClick={() => moveSection(i, 1)} disabled={i === onList.length - 1} className="text-muted-foreground enabled:hover:text-foreground disabled:opacity-30">
                      <ArrowDown className="size-3.5" />
                    </button>
                  </div>
                  <span className="flex-1 text-sm font-medium">{SECTION_LABELS[id]}</span>
                  {id === "catalog" ? (
                    <span className="text-xs text-muted-foreground">Siempre visible</span>
                  ) : (
                    <Switch checked onCheckedChange={() => toggleSection(id, false)} />
                  )}
                </div>
              ))}
              {offList.map((id) => (
                <div key={id} className="flex items-center gap-2 rounded-lg border border-dashed p-2.5 opacity-70">
                  <span className="flex-1 text-sm font-medium">{SECTION_LABELS[id]}</span>
                  <Switch checked={false} onCheckedChange={() => toggleSection(id, true)} />
                </div>
              ))}

              {onList.includes("about") && (
                <div className="space-y-2 border-t pt-3">
                  <Input
                    value={theme.about.title}
                    onChange={(e) => patch({ about: { ...theme.about, title: e.target.value } })}
                    placeholder="Título (ej. Sobre nosotros)"
                  />
                  <Textarea
                    value={theme.about.text}
                    onChange={(e) => patch({ about: { ...theme.about, text: e.target.value } })}
                    placeholder="Contá la historia de tu tienda…"
                    rows={3}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Images */}
        {mediaDefs && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Imágenes del diseño</CardTitle>
              <p className="text-xs text-muted-foreground">
                Subí tus propias imágenes para este diseño.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {mediaDefs.map((m) => (
                <div key={m.key} className="space-y-1.5">
                  <Label className="text-xs">{m.label}</Label>
                  <ImageUploader
                    storeId={store.id}
                    value={theme.media[m.key]}
                    onChange={(next) => setMedia(m.key, next)}
                    folder={m.key}
                    max={m.max}
                    hideCoverHint
                  />
                  <p className="text-[11px] text-muted-foreground">{m.help}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Testimonials */}
        {showTestimonials && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historias reales</CardTitle>
              <p className="text-xs text-muted-foreground">
                Testimonios de clientes que se muestran en la home.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {theme.testimonials.map((t, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Historia {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTestimonial(i)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Quitar"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <Textarea
                    value={t.quote}
                    onChange={(e) => updateTestimonial(i, { quote: e.target.value })}
                    placeholder="“Mi piel nunca se sintió tan bien…”"
                    rows={2}
                  />
                  <Input
                    value={t.author}
                    onChange={(e) => updateTestimonial(i, { author: e.target.value })}
                    placeholder="Nombre del cliente"
                    className="h-9"
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTestimonial}
                className="w-full"
              >
                <Plus className="size-4" /> Agregar historia
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Live preview */}
      <div className="order-1 lg:order-2">
        <div className="space-y-3 lg:sticky lg:top-20">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Check className="size-4" /> Vista previa en vivo
          </div>
          <StorePreview theme={theme} storeName={store.name} logoUrl={logoUrl} products={sampleProducts} />
          <Button onClick={save} disabled={saving} className="w-full" size="lg">
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Guardar diseño
          </Button>
        </div>
      </div>
    </div>
  );
}
