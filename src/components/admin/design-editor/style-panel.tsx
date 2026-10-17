"use client";

import { useState } from "react";
import {
  Cpu,
  Dumbbell,
  Flame,
  Flower,
  Gem,
  Lock,
  Medal,
  Shirt,
  Smartphone,
  Sparkles,
  Store,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProChip } from "@/components/admin/pro-lock";
import { HEADING_FONTS } from "@/lib/design/design";
import type { AnnouncementStyle, HeadingFont, LookId, StoreDesign } from "@/lib/design/types";
import {
  TEMPLATE_CATEGORIES,
  THEME_FONTS,
  THEME_PRESETS,
  isFreeLayout,
  type ButtonStyle,
  type CardStyle,
  type ThemeFont,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  store: Store,
  shirt: Shirt,
  medal: Medal,
  flame: Flame,
  gem: Gem,
  sparkles: Sparkles,
  flower: Flower,
  cpu: Cpu,
  smartphone: Smartphone,
  dumbbell: Dumbbell,
  zap: Zap,
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Group({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-3 border-b pb-5 last:border-b-0">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border bg-background"
          aria-label={label}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 px-2 font-mono text-xs" maxLength={7} />
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

/**
 * La pestaña "Estilo": el look de la tienda (lo que antes era la plantilla),
 * colores, fuentes, botones, tarjetas y la barra de anuncio.
 */
export function StylePanel({
  design,
  pro,
  onTokens,
  onLook,
  onTemplate,
  onAnnouncement,
}: {
  design: StoreDesign;
  pro: boolean;
  onTokens: (patch: Partial<StoreDesign["tokens"]>) => void;
  onLook: (look: LookId) => void;
  onTemplate: (look: LookId) => void;
  onAnnouncement: (patch: Partial<StoreDesign["header"]["announcement"]>) => void;
}) {
  const t = design.tokens;
  const [category, setCategory] = useState(
    () => THEME_PRESETS.find((p) => p.id === t.look)?.category ?? "classic",
  );
  const current = THEME_PRESETS.find((p) => p.id === t.look);
  const ann = design.header.announcement;

  return (
    <div className="space-y-5">
      <Group
        title="Estilo de la tienda"
        hint="Cambia cómo se ven las tarjetas, los títulos, el encabezado y el pie. Tus secciones y textos se quedan."
      >
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                category === c.id ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {THEME_PRESETS.filter((p) => p.category === category).map((p) => {
            const Icon = ICONS[p.icon] ?? Store;
            const active = t.look === p.id;
            const locked = !pro && !isFreeLayout(p.id as LookId);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onLook(p.id as LookId)}
                className={cn(
                  "overflow-hidden rounded-xl border text-left transition-colors",
                  active ? "border-primary ring-1 ring-primary" : "hover:border-primary/40",
                )}
              >
                <div className="relative flex h-9 items-center justify-between px-2.5" style={{ background: p.theme.colors.primary }}>
                  <Icon className="size-4 text-white/90" />
                  <span className="size-3.5 rounded-full ring-2 ring-white/40" style={{ background: p.theme.colors.accent }} />
                  {locked && (
                    <span className="absolute inset-0 grid place-items-center bg-black/40">
                      <Lock className="size-3.5 text-white" />
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <p className="flex items-center gap-1 text-xs font-semibold">
                    {p.label} {locked && <ProChip />}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
        {current && (
          <button
            type="button"
            onClick={() => onTemplate(t.look)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Empezar de cero con las secciones de {current.label}
          </button>
        )}
      </Group>

      <Group title="Colores">
        <div className="grid grid-cols-3 gap-2">
          <ColorField label="Principal" value={t.colors.primary} onChange={(v) => onTokens({ colors: { ...t.colors, primary: v } })} />
          <ColorField label="Acento" value={t.colors.accent} onChange={(v) => onTokens({ colors: { ...t.colors, accent: v } })} />
          <ColorField label="Fondo" value={t.colors.surface} onChange={(v) => onTokens({ colors: { ...t.colors, surface: v } })} />
        </div>
      </Group>

      <Group title="Tipografía">
        <div className="space-y-1.5">
          <Label className="text-xs">Títulos</Label>
          <select className={selectClass} value={t.headingFont} onChange={(e) => onTokens({ headingFont: e.target.value as HeadingFont })}>
            {HEADING_FONTS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Texto</Label>
          <select className={selectClass} value={t.font} onChange={(e) => onTokens({ font: e.target.value as ThemeFont })}>
            {THEME_FONTS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>
      </Group>

      <Group title="Botones y tarjetas">
        <div className="space-y-1.5">
          <Label className="text-xs">Botones</Label>
          <Choice<ButtonStyle>
            value={t.buttonStyle}
            onChange={(v) => onTokens({ buttonStyle: v })}
            options={[{ id: "rounded", label: "Redondeados" }, { id: "square", label: "Cuadrados" }]}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tarjetas (estilo Clásico)</Label>
          <Choice<CardStyle>
            value={t.cardStyle}
            onChange={(v) => onTokens({ cardStyle: v })}
            options={[{ id: "soft", label: "Suaves" }, { id: "bordered", label: "Con borde" }]}
          />
        </div>
      </Group>

      <Group title="Barra de anuncio" hint="Una franja arriba de todo, en todas las páginas.">
        <div className="flex items-center justify-between rounded-lg border p-2.5">
          <Label htmlFor="ann" className="text-xs font-medium">Mostrar barra de anuncio</Label>
          <Switch id="ann" checked={ann.enabled} onCheckedChange={(v) => onAnnouncement({ enabled: v })} />
        </div>
        {ann.enabled && (
          <>
            <Input
              value={ann.text}
              onChange={(e) => onAnnouncement({ text: e.target.value })}
              maxLength={140}
              placeholder="Ej. Envío gratis en compras de más de $50"
              className="h-9"
            />
            <select
              className={selectClass}
              value={ann.style}
              onChange={(e) => onAnnouncement({ style: e.target.value as AnnouncementStyle })}
            >
              <option value="auto">Como la trae el estilo</option>
              <option value="fija">Fija</option>
              <option value="movimiento">En movimiento</option>
            </select>
          </>
        )}
      </Group>
    </div>
  );
}
