"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { STORE_IMAGES_BUCKET, fileExt, getImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

const MAX_BYTES = 15 * 1024 * 1024;

interface BrandingImageUploadProps {
  storeId: string;
  value: string | null;
  onChange: (path: string | null) => void;
  /** subfolder under <storeId>/, e.g. "logo" or "banner" */
  folder: string;
  aspect?: "square" | "wide";
}

export function BrandingImageUpload({
  storeId,
  value,
  onChange,
  folder,
  aspect = "square",
}: BrandingImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const url = getImageUrl(value);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Subí una imagen");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("La imagen supera 15 MB");
      return;
    }
    const supabase = createClient();
    setUploading(true);
    const path = `${storeId}/${folder}/${crypto.randomUUID()}.${fileExt(file.name)}`;
    const { error } = await supabase.storage
      .from(STORE_IMAGES_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });
    setUploading(false);
    if (error) {
      toast.error("No se pudo subir la imagen");
      return;
    }
    onChange(path);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-muted",
          aspect === "square" ? "size-28" : "aspect-[16/6] w-full",
        )}
      >
        {url ? (
          <Image src={url} alt="" fill sizes="320px" className="object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="grid h-full w-full place-items-center text-muted-foreground hover:text-primary"
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-6" />
            )}
          </button>
        )}
        {url && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-background/90 text-destructive shadow hover:bg-background"
            aria-label="Quitar"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {url && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          {uploading ? "Subiendo…" : "Cambiar"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
