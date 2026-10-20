"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Images, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { exampleUploadTicket } from "@/app/(superadmin)/super/ejemplos/actions";
import { Button } from "@/components/ui/button";
import type { RubroId } from "@/lib/design/bases";
import { RUBRO_HERO_PHOTO, STOCK_PHOTOS, heroPhotoUrl, stockPhotoUrl } from "@/lib/example-photos";
import type { ExampleUploadFolder } from "@/lib/example-pages";
import { STORE_IMAGES_BUCKET, getImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { uploadImageSigned } from "@/lib/upload";
import { cn } from "@/lib/utils";

const MAX_BYTES = 25 * 1024 * 1024;

interface Props {
  storeId: string;
  folder: ExampleUploadFolder;
  value: string | null;
  onChange: (next: string | null) => void;
  /** Ofrecer las fotos de stock además de subir una. */
  stock?: "products" | "hero" | false;
  /** El rubro de la página, para mostrar primero sus fotos. */
  rubro?: RubroId;
  /** Cuadrada (producto, logo) o apaisada (portada). */
  shape?: "square" | "wide";
  label: string;
}

/**
 * Una foto de una página ejemplo: se sube con una URL firmada que da el
 * servidor (el super admin no es dueño de la carpeta de la tienda) o se elige
 * de las fotos de stock. Devuelve la ruta en storage o la URL de la foto.
 */
export function ExampleImageInput({
  storeId,
  folder,
  value,
  onChange,
  stock = false,
  rubro,
  shape = "square",
  label,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [picking, setPicking] = useState(false);
  const url = getImageUrl(value);

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Sube una foto (JPG, PNG o WEBP)");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("La foto es demasiado grande");
      return;
    }
    setBusy(true);
    setPercent(0);
    const res = await uploadImageSigned({
      supabase: createClient(),
      bucket: STORE_IMAGES_BUCKET,
      file,
      getTicket: (ext) => exampleUploadTicket(storeId, ext, folder),
      onProgress: setPercent,
    });
    setBusy(false);
    if (!res.ok || !res.path) {
      toast.error(res.userError && res.error ? res.error : "No se pudo subir la foto. Prueba de nuevo.");
      return;
    }
    onChange(res.path);
  }

  const photos =
    stock === "hero"
      ? (Object.entries(RUBRO_HERO_PHOTO) as [RubroId, string][]).map(([r, id]) => ({ id, rubro: r, label: r }))
      : [...STOCK_PHOTOS].sort((a, b) => Number(b.rubro === rubro) - Number(a.rubro === rubro));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted",
            shape === "wide" ? "aspect-[16/9] w-40" : "size-20",
          )}
        >
          {url ? (
            <Image
              src={url}
              alt=""
              fill
              sizes={shape === "wide" ? "160px" : "80px"}
              className="object-cover"
            />
          ) : (
            <ImagePlus className="size-5 text-muted-foreground" />
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-background/80 text-xs font-medium">
              {percent ? `${percent}%` : <Loader2 className="size-4 animate-spin" />}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            <ImagePlus /> Subir foto
          </Button>
          {stock && (
            <Button type="button" variant="outline" size="sm" onClick={() => setPicking((p) => !p)}>
              <Images /> {picking ? "Cerrar fotos" : "Foto de stock"}
            </Button>
          )}
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <X /> Quitar
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {picking && stock && (
        <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto rounded-lg border bg-background p-2 sm:grid-cols-6">
          {photos.map((p) => {
            const full = stock === "hero" ? heroPhotoUrl(p.id) : stockPhotoUrl(p.id);
            return (
              <button
                key={p.id}
                type="button"
                title={p.label}
                onClick={() => {
                  onChange(full);
                  setPicking(false);
                }}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-md border-2 transition-colors",
                  value === full ? "border-primary" : "border-transparent hover:border-border",
                )}
              >
                <Image src={stockPhotoUrl(p.id, 200)} alt={p.label} fill sizes="96px" className="object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
