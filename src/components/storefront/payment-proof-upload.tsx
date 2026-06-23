"use client";

import { useRef, useState } from "react";
import { FileImage, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { PAYMENT_PROOFS_BUCKET, fileExt } from "@/lib/storage";

const MAX_BYTES = 15 * 1024 * 1024;

interface PaymentProofUploadProps {
  storeId: string;
  value: string | null;
  onChange: (path: string | null) => void;
}

export function PaymentProofUpload({
  storeId,
  value,
  onChange,
}: PaymentProofUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Subí una imagen del comprobante");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("La imagen supera 15 MB");
      return;
    }

    const supabase = createClient();
    setUploading(true);
    const path = `${storeId}/proofs/${crypto.randomUUID()}.${fileExt(file.name)}`;
    const { error } = await supabase.storage
      .from(PAYMENT_PROOFS_BUCKET)
      .upload(path, file, { upsert: false });
    setUploading(false);

    if (error) {
      toast.error("No se pudo subir el comprobante");
      return;
    }
    setPreview(URL.createObjectURL(file));
    onChange(path);
  }

  function clear() {
    setPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Comprobante"
            className="size-14 rounded-md object-cover"
          />
        ) : (
          <span className="grid size-14 place-items-center rounded-md bg-muted text-muted-foreground">
            <FileImage className="size-6" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-success">Comprobante cargado</p>
          <p className="truncate text-xs text-muted-foreground">
            Lo verá la tienda al revisar tu pedido.
          </p>
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Quitar comprobante"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
      >
        {uploading ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Subiendo…
          </>
        ) : (
          <>
            <FileImage className="size-4" /> Subir foto del comprobante
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </>
  );
}
