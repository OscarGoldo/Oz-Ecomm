"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, ImagePlus, Loader2, RotateCcw, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createProductsFromPhotos,
  readProductPhoto,
  type PhotoProductInput,
} from "@/app/(admin)/panel/productos/fotos/actions";
import type { AiPhotoQuota } from "@/lib/ai-products";
import { createClient } from "@/lib/supabase/client";
import { STORE_IMAGES_BUCKET, productImagePath } from "@/lib/storage";
import { uploadImage } from "@/lib/upload";
import { cn } from "@/lib/utils";

/** Cuántas fotos se suben y se leen a la vez. Más satura los datos móviles. */
const CONCURRENCY = 2;
/** Lo que acepta la acción de guardar de una vez. */
const MAX_ITEMS = 20;
/** Techo antes de comprimir, igual que el uploader de productos. */
const MAX_BYTES = 25 * 1024 * 1024;
const NONE = "none";
const NEW_PREFIX = "new:";

type Status = "uploading" | "reading" | "ready" | "not_product" | "failed" | "manual";

interface Item {
  key: string;
  /** Vista previa local (object URL), para no esperar a Storage. */
  preview: string;
  /** Ruta en Storage, cuando ya subió. */
  path: string | null;
  status: Status;
  message: string | null;
  name: string;
  description: string;
  price: string;
  stock: string;
  /** NONE, el id de una categoría existente o "new:<nombre>". */
  category: string;
  priceFromPhoto: boolean;
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

function parsePrice(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function parseStock(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function PhotoProductLoader({
  storeId,
  categories,
  slotsLeft,
  initialQuota,
  batchSize,
}: {
  storeId: string;
  categories: { id: string; name: string }[];
  /** Productos que todavía caben en el plan. null = sin tope (Pro). */
  slotsLeft: number | null;
  initialQuota: AiPhotoQuota;
  /** Fotos por cada vez que elige. */
  batchSize: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [quota, setQuota] = useState(initialQuota);
  const [saving, setSaving] = useState(false);

  // La cola vive en refs: los trabajos terminan fuera del render y tienen que
  // ver siempre el estado más nuevo.
  const files = useRef(new Map<string, File>());
  const queue = useRef<string[]>([]);
  const running = useRef(0);
  const quotaRef = useRef(initialQuota);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    const current = itemsRef;
    return () => current.current.forEach((i) => URL.revokeObjectURL(i.preview));
  }, []);

  function patch(key: string, changes: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...changes } : i)));
  }

  const capacity = Math.max(
    0,
    Math.min(MAX_ITEMS, slotsLeft ?? Number.POSITIVE_INFINITY) - items.length,
  );
  const busy = items.some((i) => i.status === "uploading" || i.status === "reading");

  async function process(key: string) {
    const file = files.current.get(key);
    let path = itemsRef.current.find((i) => i.key === key)?.path ?? null;

    if (!path) {
      if (!file) return;
      patch(key, { status: "uploading", message: null });
      const res = await uploadImage({
        supabase: createClient(),
        bucket: STORE_IMAGES_BUCKET,
        path: productImagePath(storeId, `${crypto.randomUUID()}.jpg`),
        file,
      });
      if (!res.ok || !res.path) {
        patch(key, { status: "failed", message: "No se pudo subir la foto. Revisa tu conexión." });
        return;
      }
      path = res.path;
      patch(key, { path });
    }

    if (quotaRef.current.remaining <= 0) {
      patch(key, {
        status: "manual",
        message: quotaRef.current.pro
          ? "Se acabaron las fotos con IA por ahora. Complétalo a mano."
          : `Ya usaste las ${quotaRef.current.limit} fotos con IA del mes. Complétalo a mano.`,
      });
      return;
    }

    patch(key, { status: "reading", message: null });
    const res = await readProductPhoto(path);
    if (res.quota) {
      quotaRef.current = res.quota;
      setQuota(res.quota);
    }
    if (!res.ok) {
      patch(key, { status: "failed", message: res.error });
      return;
    }

    const d = res.draft;
    // Si otra foto ya propuso la misma categoría nueva ("Zapatos" / "zapatos"),
    // se usa esa escritura: una sola opción en el selector, una sola categoría.
    const twin = d.newCategory
      ? itemsRef.current
          .map((i) => i.category)
          .find((c) => c.startsWith(NEW_PREFIX) && norm(c.slice(NEW_PREFIX.length)) === norm(d.newCategory!))
      : undefined;
    if (!d.isProduct) {
      patch(key, {
        status: "not_product",
        message: "No parece un producto. Quítala o complétala a mano.",
      });
      return;
    }
    patch(key, {
      status: "ready",
      message: null,
      name: d.name,
      description: d.description,
      price: d.priceUsd !== null ? String(d.priceUsd) : "",
      priceFromPhoto: d.priceUsd !== null,
      category: d.categoryId ?? twin ?? (d.newCategory ? `${NEW_PREFIX}${d.newCategory}` : NONE),
    });
  }

  function pump() {
    while (running.current < CONCURRENCY && queue.current.length > 0) {
      const key = queue.current.shift()!;
      running.current++;
      process(key)
        .catch(() => patch(key, { status: "failed", message: "Algo falló. Intenta de nuevo." }))
        .finally(() => {
          running.current--;
          pump();
        });
    }
  }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const images = Array.from(list).filter((f) => {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name}: no es una imagen`);
        return false;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}: es demasiado grande`);
        return false;
      }
      return true;
    });
    const room = Math.min(capacity, batchSize);
    if (room <= 0) {
      toast.error(
        slotsLeft !== null && items.length >= slotsLeft
          ? "No caben más productos en el plan Gratis."
          : "Publica estas antes de agregar más.",
      );
      return;
    }
    const picked = images.slice(0, room);
    if (images.length > room) toast.info(`Caben ${room} fotos más; tomamos las primeras.`);

    const fresh: Item[] = picked.map((file) => {
      const key = crypto.randomUUID();
      files.current.set(key, file);
      return {
        key,
        preview: URL.createObjectURL(file),
        path: null,
        status: "uploading",
        message: null,
        name: "",
        description: "",
        price: "",
        stock: "",
        category: NONE,
        priceFromPhoto: false,
      };
    });
    // Se agregan al estado antes de encolarlas: `process` lee itemsRef.
    itemsRef.current = [...itemsRef.current, ...fresh];
    setItems((prev) => [...prev, ...fresh]);
    queue.current.push(...fresh.map((i) => i.key));
    pump();
    if (inputRef.current) inputRef.current.value = "";
  }

  function retry(key: string) {
    queue.current.push(key);
    pump();
  }

  function remove(key: string) {
    const item = items.find((i) => i.key === key);
    if (item) URL.revokeObjectURL(item.preview);
    files.current.delete(key);
    queue.current = queue.current.filter((k) => k !== key);
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  // Categorías nuevas que propuso la IA en esta tanda, sin repetir.
  const proposed: string[] = [];
  for (const i of items) {
    if (!i.category.startsWith(NEW_PREFIX)) continue;
    const name = i.category.slice(NEW_PREFIX.length);
    if (!proposed.some((p) => norm(p) === norm(name))) proposed.push(name);
  }

  const withPrice = items.filter((i) => (parsePrice(i.price) ?? 0) > 0).length;
  const withoutPrice = items.length - withPrice;

  async function publish() {
    if (busy || saving || items.length === 0) return;
    const notUploaded = items.filter((i) => !i.path);
    if (notUploaded.length > 0) {
      toast.error("Hay fotos que no se subieron. Reintenta o quítalas.");
      return;
    }
    const unnamed = items.filter((i) => i.name.trim().length < 2);
    if (unnamed.length > 0) {
      toast.error(
        unnamed.length === 1
          ? "A un producto le falta el nombre."
          : `A ${unnamed.length} productos les falta el nombre.`,
      );
      return;
    }

    const payload: PhotoProductInput[] = items.map((i) => ({
      image: i.path!,
      name: i.name.trim(),
      description: i.description.trim(),
      price: parsePrice(i.price),
      stock: parseStock(i.stock),
      categoryId: i.category !== NONE && !i.category.startsWith(NEW_PREFIX) ? i.category : null,
      newCategory: i.category.startsWith(NEW_PREFIX) ? i.category.slice(NEW_PREFIX.length) : null,
    }));

    setSaving(true);
    const res = await createProductsFromPhotos(payload);
    setSaving(false);

    if (!res.ok) {
      // Lo que alcanzó a guardarse sale de la lista, para no duplicarlo.
      if (res.saved?.length) {
        const savedKeys = new Set(res.saved.map((idx) => items[idx]?.key));
        items.filter((i) => savedKeys.has(i.key)).forEach((i) => URL.revokeObjectURL(i.preview));
        setItems((prev) => prev.filter((i) => !savedKeys.has(i.key)));
      }
      toast.error(res.error);
      return;
    }

    const parts = [];
    if (res.published) {
      parts.push(res.published === 1 ? "1 producto publicado" : `${res.published} productos publicados`);
    }
    if (res.drafts) {
      parts.push(
        res.drafts === 1 ? "1 quedó como borrador (sin precio)" : `${res.drafts} quedaron como borrador (sin precio)`,
      );
    }
    toast.success(parts.join(" · "));
    router.push("/panel/productos");
    router.refresh();
  }

  const quotaLine =
    quota.remaining > 0
      ? `Te quedan ${quota.remaining} de ${quota.limit} fotos con IA este mes.`
      : quota.pro
        ? "Se acabaron las fotos con IA por ahora. Las que subas las completas a mano."
        : `Ya usaste las ${quota.limit} fotos con IA del mes. Las que subas las completas a mano.`;

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-card px-6 py-12 text-center transition-colors hover:border-primary hover:bg-primary/5"
        >
          <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <ImagePlus className="size-6" />
          </span>
          <span className="font-semibold">Elige las fotos</span>
          <span className="max-w-sm text-sm text-muted-foreground">
            Hasta {Math.min(batchSize, capacity)} por vez. Cada foto es un producto: después le
            puedes agregar más fotos desde su ficha.
          </span>
        </button>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <PhotoItemCard
              key={item.key}
              item={item}
              categories={categories}
              proposed={proposed}
              onChange={(changes) => patch(item.key, changes)}
              onRemove={() => remove(item.key)}
              onRetry={() => retry(item.key)}
              disabled={saving}
            />
          ))}
        </ul>
      )}

      <div className="space-y-1 text-sm text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 shrink-0 text-primary" /> {quotaLine}
        </p>
        {slotsLeft !== null && (
          <p>
            En el plan Gratis puedes cargar {Math.max(0, slotsLeft - items.length)} productos más
            {items.length > 0 ? " después de estos." : "."}
          </p>
        )}
      </div>

      {items.length > 0 && (
        <>
          {capacity > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={saving}
            >
              <ImagePlus /> Agregar más fotos
            </Button>
          )}

          <PublishBar
            count={items.length}
            withPrice={withPrice}
            withoutPrice={withoutPrice}
            busy={busy}
            saving={saving}
            onPublish={publish}
          />
        </>
      )}
    </div>
  );
}

function PublishBar({
  count,
  withPrice,
  withoutPrice,
  busy,
  saving,
  onPublish,
}: {
  count: number;
  withPrice: number;
  withoutPrice: number;
  busy: boolean;
  saving: boolean;
  onPublish: () => void;
}) {
  const label = busy
    ? "Leyendo fotos…"
    : count === 1
      ? "Guardar producto"
      : `Guardar ${count} productos`;
  const summary =
    withoutPrice === 0
      ? "Todos salen publicados."
      : withPrice === 0
        ? "Sin precio quedan como borrador: no se ven en la tienda hasta que les pongas uno."
        : `${withPrice} salen publicados; ${withoutPrice} sin precio quedan como borrador.`;

  const button = (
    <Button type="button" onClick={onPublish} disabled={busy || saving} className="w-full md:w-auto">
      {saving || busy ? <Loader2 className="animate-spin" /> : <Upload />}
      {saving ? "Guardando…" : label}
    </Button>
  );

  return (
    <>
      <div className="hidden items-center justify-between gap-4 rounded-2xl border bg-card p-4 md:flex">
        <p className="text-sm text-muted-foreground">{summary}</p>
        {button}
      </div>
      {/* En móvil queda fijo sobre la barra de navegación, como en el formulario de producto. */}
      <div className="fixed inset-x-0 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-30 space-y-1.5 border-t bg-background/95 p-3 backdrop-blur md:hidden">
        <p className="text-center text-xs text-muted-foreground">{summary}</p>
        {button}
      </div>
    </>
  );
}

function PhotoItemCard({
  item,
  categories,
  proposed,
  onChange,
  onRemove,
  onRetry,
  disabled,
}: {
  item: Item;
  categories: { id: string; name: string }[];
  proposed: string[];
  onChange: (changes: Partial<Item>) => void;
  onRemove: () => void;
  onRetry: () => void;
  disabled: boolean;
}) {
  const working = item.status === "uploading" || item.status === "reading";
  const locked = working || disabled;
  const id = (field: string) => `${item.key}-${field}`;

  return (
    <li className="relative rounded-2xl border bg-card p-3 sm:p-4">
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Quitar esta foto"
        className="absolute right-2 top-2 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      {/* El aviso va a todo el ancho: al lado de la foto, en un teléfono, no
          cabía ni una palabra por línea. */}
      {item.message && (
        <div
          className={cn(
            "mb-3 mr-10 flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg px-2.5 py-2 text-xs",
            item.status === "failed"
              ? "bg-destructive/10 text-destructive"
              : "bg-warning-surface text-warning-text",
          )}
        >
          <span className="flex min-w-0 flex-1 basis-48 items-start gap-2">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            {item.message}
          </span>
          {item.status === "failed" && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex shrink-0 items-center gap-1 font-semibold underline-offset-2 hover:underline"
            >
              <RotateCcw className="size-3" /> Reintentar
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-4">
        <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
          <Image src={item.preview} alt="" fill unoptimized sizes="96px" className="object-cover" />
          {working && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45 text-white">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-2xs font-medium">
                {item.status === "uploading" ? "Subiendo" : "Leyendo"}
              </span>
            </div>
          )}
        </div>

        <div className={cn("min-w-0 space-y-1.5", !item.message && "pr-9")}>
          <Label htmlFor={id("name")}>Nombre</Label>
          <Input
            id={id("name")}
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={working ? "La IA lo está escribiendo…" : "Ej. Licuadora Oster 600 W"}
            disabled={locked}
            maxLength={120}
          />
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <Label htmlFor={id("desc")}>Descripción</Label>
        <Textarea
          id={id("desc")}
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          disabled={locked}
          placeholder={working ? "" : "Opcional"}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1.4fr]">
        <div className="space-y-1.5">
          <Label htmlFor={id("price")}>Precio (USD)</Label>
          <Input
            id={id("price")}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={item.price}
            onChange={(e) => onChange({ price: e.target.value, priceFromPhoto: false })}
            placeholder="0.00"
            disabled={locked}
          />
          {item.priceFromPhoto && (
            <p className="text-2xs text-muted-foreground">Leído de la foto. Revísalo.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("stock")}>Cantidad</Label>
          <Input
            id={id("stock")}
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={item.stock}
            onChange={(e) => onChange({ stock: e.target.value })}
            placeholder="Sin contar"
            disabled={locked}
          />
        </div>
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <Label>Categoría</Label>
          <Select
            value={item.category}
            onValueChange={(v) => onChange({ category: v })}
            disabled={locked}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin categoría</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
              {proposed.map((name) => (
                <SelectItem key={name} value={`${NEW_PREFIX}${name}`}>
                  {name} (nueva)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </li>
  );
}
