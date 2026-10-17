"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/admin/image-uploader";
import type { FieldSpec } from "@/lib/design/sections";

export interface FieldEnv {
  storeId: string;
  pro: boolean;
  categories: { slug: string; name: string }[];
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Un campo del editor, armado desde su definición en el catálogo de
 * secciones. Así cada sección nueva trae su formulario sin escribir UI.
 */
export function Field({
  field,
  value,
  onChange,
  env,
}: {
  field: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
  env: FieldEnv;
}) {
  const id = `f-${field.key}`;
  const help = "help" in field && field.help ? <p className="text-[11px] text-muted-foreground">{field.help}</p> : null;

  switch (field.kind) {
    case "text":
    case "link":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs">{field.label}</Label>
          <Input
            id={id}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            maxLength={field.kind === "text" ? field.max : 400}
            placeholder={field.kind === "text" ? field.placeholder : "#catalogo"}
            className="h-9"
          />
          {help}
        </div>
      );
    case "textarea":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs">{field.label}</Label>
          <Textarea
            id={id}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            maxLength={field.max}
            rows={field.rows ?? 3}
            placeholder={field.placeholder}
          />
          {help}
        </div>
      );
    case "select":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs">{field.label}</Label>
          <select id={id} className={selectClass} value={String(value)} onChange={(e) => onChange(e.target.value)}>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
                {o.pro && !env.pro ? " · Pro" : ""}
              </option>
            ))}
          </select>
          {help}
        </div>
      );
    case "toggle":
      return (
        <div className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
          <Label htmlFor={id} className="text-xs font-medium">{field.label}</Label>
          <Switch id={id} checked={Boolean(value)} onCheckedChange={(v) => onChange(v)} />
        </div>
      );
    case "number":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs">{field.label}</Label>
          <div className="flex items-center gap-3">
            <input
              id={id}
              type="range"
              min={field.min}
              max={field.max}
              value={Number(value)}
              onChange={(e) => onChange(Number(e.target.value))}
              className="flex-1 accent-[hsl(var(--primary))]"
            />
            <span className="w-6 text-right text-sm tabular-nums">{Number(value)}</span>
          </div>
        </div>
      );
    case "images":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          <ImageUploader
            storeId={env.storeId}
            value={(value as string[]) ?? []}
            onChange={(next) => onChange(next)}
            folder="design"
            max={field.max}
            hideCoverHint
          />
          {help}
        </div>
      );
    case "image":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          <ImageUploader
            storeId={env.storeId}
            value={value ? [String(value)] : []}
            onChange={(next) => onChange(next[0] ?? "")}
            folder="design"
            max={1}
            hideCoverHint
          />
          {help}
        </div>
      );
    case "category":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs">{field.label}</Label>
          {env.categories.length ? (
            <select id={id} className={selectClass} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
              <option value="">Elige una categoría</option>
              {env.categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-muted-foreground">Todavía no tienes categorías. Créalas en Categorías.</p>
          )}
        </div>
      );
    case "items":
      return <ItemsField field={field} value={(value as Record<string, string>[]) ?? []} onChange={onChange} />;
  }
}

function ItemsField({
  field,
  value,
  onChange,
}: {
  field: Extract<FieldSpec, { kind: "items" }>;
  value: Record<string, string>[];
  onChange: (v: unknown) => void;
}) {
  const update = (i: number, key: string, v: string) =>
    onChange(value.map((item, j) => (j === i ? { ...item, [key]: v } : item)));
  const move = (i: number, dir: -1 | 1) => {
    const t = i + dir;
    if (t < 0 || t >= value.length) return;
    const next = [...value];
    [next[i], next[t]] = [next[t]!, next[i]!];
    onChange(next);
  };
  const add = () => onChange([...value, Object.fromEntries(field.fields.map((f) => [f.key, ""]))]);

  return (
    <div className="space-y-2">
      <Label className="text-xs">{field.label}</Label>
      {field.help && <p className="text-[11px] text-muted-foreground">{field.help}</p>}
      {value.map((item, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-2.5">
          <div className="flex items-center gap-1">
            <span className="flex-1 text-xs font-medium text-muted-foreground">
              {field.itemLabel} {i + 1}
            </span>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-muted-foreground enabled:hover:text-foreground disabled:opacity-30" aria-label="Subir">
              <ArrowUp className="size-3.5" />
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} className="p-1 text-muted-foreground enabled:hover:text-foreground disabled:opacity-30" aria-label="Bajar">
              <ArrowDown className="size-3.5" />
            </button>
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Quitar">
              <Trash2 className="size-3.5" />
            </button>
          </div>
          {field.fields.map((f) =>
            f.kind === "textarea" ? (
              <Textarea
                key={f.key}
                value={item[f.key] ?? ""}
                onChange={(e) => update(i, f.key, e.target.value)}
                maxLength={f.max}
                rows={2}
                placeholder={f.placeholder ?? f.label}
              />
            ) : (
              <Input
                key={f.key}
                value={item[f.key] ?? ""}
                onChange={(e) => update(i, f.key, e.target.value)}
                maxLength={f.max}
                placeholder={f.placeholder ?? f.label}
                className="h-9"
              />
            ),
          )}
        </div>
      ))}
      {value.length < field.max && (
        <Button type="button" variant="outline" size="sm" onClick={add} className="w-full">
          <Plus className="size-4" /> Agregar {field.itemLabel.toLowerCase()}
        </Button>
      )}
    </div>
  );
}

