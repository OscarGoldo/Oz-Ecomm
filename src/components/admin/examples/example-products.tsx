"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImageOff, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteExampleProduct, saveExampleProduct } from "@/app/(superadmin)/super/ejemplos/actions";
import { ExampleImageInput } from "@/components/admin/examples/example-image-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RubroId } from "@/lib/design/bases";
import { formatUSD } from "@/lib/format";
import { getImageUrl } from "@/lib/storage";

export interface ExampleProductItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  category: string | null;
  image: string | null;
  featured: boolean;
}

interface Draft {
  name: string;
  price: string;
  compareAtPrice: string;
  category: string;
  description: string;
  image: string | null;
  featured: boolean;
}

const EMPTY: Draft = { name: "", price: "", compareAtPrice: "", category: "", description: "", image: null, featured: false };

function toDraft(p: ExampleProductItem): Draft {
  return {
    name: p.name,
    price: String(p.price),
    compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : "",
    category: p.category ?? "",
    description: p.description ?? "",
    image: p.image,
    featured: p.featured,
  };
}

/** Los productos de la página ejemplo: lista, agregar, cambiar y borrar. */
export function ExampleProducts({
  storeId,
  rubro,
  products,
  categories,
}: {
  storeId: string;
  rubro: RubroId;
  products: ExampleProductItem[];
  categories: string[];
}) {
  const router = useRouter();
  /** null = cerrado, "new" = agregando, id = cambiando ese producto. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  function open(p: ExampleProductItem | null) {
    setEditing(p ? p.id : "new");
    setDraft(p ? toDraft(p) : EMPTY);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await saveExampleProduct(storeId, editing === "new" ? null : editing, {
      name: draft.name,
      price: Number(draft.price.replace(",", ".")),
      compareAtPrice: draft.compareAtPrice.trim() ? Number(draft.compareAtPrice.replace(",", ".")) : null,
      category: draft.category,
      description: draft.description,
      image: draft.image,
      featured: draft.featured,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    toast.success(editing === "new" ? "Producto agregado" : "Producto guardado");
    setEditing(null);
    router.refresh();
  }

  async function remove(p: ExampleProductItem) {
    setDeleting(p.id);
    const res = await deleteExampleProduct(storeId, p.id);
    setDeleting(null);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo borrar");
      return;
    }
    router.refresh();
  }

  const form = (
    <form onSubmit={save} className="space-y-4 rounded-lg border bg-background p-3">
      <ExampleImageInput
        storeId={storeId}
        folder="products"
        value={draft.image}
        onChange={(image) => setDraft((d) => ({ ...d, image }))}
        stock="products"
        rubro={rubro}
        label="Foto"
      />
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem]">
        <div className="space-y-1.5">
          <Label htmlFor="p-name">Nombre</Label>
          <Input
            id="p-name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="iPhone 13 128 GB"
            maxLength={120}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-price">Precio (US$)</Label>
          <Input
            id="p-price"
            value={draft.price}
            onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
            inputMode="decimal"
            placeholder="420"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-before">Antes (opcional)</Label>
          <Input
            id="p-before"
            value={draft.compareAtPrice}
            onChange={(e) => setDraft((d) => ({ ...d, compareAtPrice: e.target.value }))}
            inputMode="decimal"
            placeholder="460"
          />
        </div>
      </div>
      <div className="space-y-1.5 sm:max-w-xs">
        <Label htmlFor="p-cat">Categoría</Label>
        <Input
          id="p-cat"
          list="example-categories"
          value={draft.category}
          onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
          placeholder="Teléfonos"
          maxLength={40}
        />
        <datalist id="example-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-desc">Descripción (opcional)</Label>
        <Textarea
          id="p-desc"
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          rows={2}
          maxLength={2000}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.featured}
          onChange={(e) => setDraft((d) => ({ ...d, featured: e.target.checked }))}
          className="size-4 accent-[hsl(var(--primary))]"
        />
        Destacado (sale primero en la portada)
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {editing === "new" ? "Agregar" : "Guardar"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={busy}>
          Cancelar
        </Button>
      </div>
    </form>
  );

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          Productos <span className="font-normal text-muted-foreground">· {products.length}</span>
        </h2>
        {editing === null && (
          <Button type="button" size="sm" variant="outline" onClick={() => open(null)}>
            <Plus /> Agregar producto
          </Button>
        )}
      </div>

      {editing === "new" && form}

      {products.length === 0 && editing !== "new" ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Todavía no tiene productos. Ármalos con la IA de arriba o agrégalos a mano.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {products.map((p) =>
            editing === p.id ? (
              <li key={p.id} className="p-2">
                {form}
              </li>
            ) : (
              <li key={p.id} className="flex items-center gap-3 p-2.5">
                <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                  {p.image ? (
                    <Image src={getImageUrl(p.image)!} alt="" fill sizes="48px" className="object-cover" />
                  ) : (
                    <ImageOff className="size-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {p.featured && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Destacado" />}
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatUSD(p.price)}
                    {p.category ? ` · ${p.category}` : ""}
                    {!p.image ? " · sin foto" : ""}
                  </span>
                </span>
                <Button type="button" variant="ghost" size="icon" aria-label={`Cambiar ${p.name}`} onClick={() => open(p)}>
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Borrar ${p.name}`}
                  disabled={deleting === p.id}
                  onClick={() => remove(p)}
                >
                  {deleting === p.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
