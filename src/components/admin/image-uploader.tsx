"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import {
  STORE_IMAGES_BUCKET,
  fileExt,
  getImageUrl,
  productImagePath,
} from "@/lib/storage";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 6;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

interface ImageUploaderProps {
  storeId: string;
  value: string[];
  onChange: (next: string[]) => void;
}

export function ImageUploader({ storeId, value, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - value.length;
    if (remaining <= 0) {
      toast.error(`Máximo ${MAX_IMAGES} imágenes`);
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    const supabase = createClient();
    setUploading(true);
    const uploaded: string[] = [];

    for (const file of selected) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name}: no es una imagen`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: supera 5 MB`);
        continue;
      }

      const fileName = `${crypto.randomUUID()}.${fileExt(file.name)}`;
      const path = productImagePath(storeId, fileName);
      const { error } = await supabase.storage
        .from(STORE_IMAGES_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (error) {
        toast.error(`No se pudo subir ${file.name}`);
        continue;
      }
      uploaded.push(path);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (uploaded.length) onChange([...value, ...uploaded]);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function makeCover(index: number) {
    if (index === 0) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.unshift(item!);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((img, i) => (
          <div
            key={img}
            className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
          >
            <Image
              src={getImageUrl(img) ?? ""}
              alt={`Imagen ${i + 1}`}
              fill
              sizes="120px"
              className="object-cover"
            />
            {i === 0 && (
              <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                Portada
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
              {i !== 0 ? (
                <button
                  type="button"
                  onClick={() => makeCover(i)}
                  title="Hacer portada"
                  className="grid size-6 place-items-center rounded bg-white/90 text-foreground hover:bg-white"
                >
                  <Star className="size-3.5" />
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                title="Quitar"
                className="grid size-6 place-items-center rounded bg-white/90 text-destructive hover:bg-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        ))}

        {value.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
            <span className="text-[11px]">
              {uploading ? "Subiendo…" : "Agregar"}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-xs text-muted-foreground">
        Hasta {MAX_IMAGES} imágenes (máx. 5 MB c/u). La primera es la portada.
      </p>
    </div>
  );
}
