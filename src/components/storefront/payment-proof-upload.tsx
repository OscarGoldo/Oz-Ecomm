"use client";

import { useRef, useState } from "react";
import { FileImage, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { PAYMENT_PROOFS_BUCKET, fileExt } from "@/lib/storage";
import { createProofUploadTicket } from "@/lib/storage-actions";

/**
 * Tiene que coincidir con `file_size_limit` del bucket (migración 0021). El
 * chequeo de acá es solo cortesía para dar un mensaje decente: el límite real
 * lo aplica Storage, porque un control en el navegador no es un control.
 */
const MAX_BYTES = 5 * 1024 * 1024;

interface PaymentProofUploadProps {
  storeId: string;
  value: string | null;
  onChange: (path: string | null) => void;
  /**
   * Subcarpeta dentro de `<storeId>/`. "proofs" son los pagos de pedidos;
   * "subs" son los del plan de la tienda. Siempre queda bajo el storeId, que es
   * lo que exigen las policies del bucket.
   */
  folder?: string;
  /** Texto del botón cuando todavía no hay archivo. */
  label?: string;
  /** Aclaración bajo el archivo ya cargado. */
  hint?: string;
}

export function PaymentProofUpload({
  storeId,
  value,
  onChange,
  folder = "proofs",
  label = "Subir foto del comprobante",
  hint = "Lo verá la tienda al revisar tu pedido.",
}: PaymentProofUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Sube una imagen del comprobante");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("La imagen supera 5 MB. Sácale una foto más liviana.");
      return;
    }

    setUploading(true);
    try {
      // La ruta la decide el servidor, no este componente: así el archivo
      // nunca puede terminar en la carpeta de otra tienda.
      const ticket = await createProofUploadTicket(
        storeId,
        fileExt(file.name),
        folder,
      );
      if (!ticket.ok || !ticket.path || !ticket.token) {
        toast.error(ticket.error ?? "No se pudo subir el comprobante");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.storage
        .from(PAYMENT_PROOFS_BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, file);

      if (error) {
        toast.error("No se pudo subir el comprobante. Intenta de nuevo.");
        return;
      }
      setPreview(URL.createObjectURL(file));
      onChange(ticket.path);
    } catch {
      toast.error("Se cortó la subida. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setUploading(false);
    }
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
          <p className="truncate text-xs text-muted-foreground">{hint}</p>
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
            <FileImage className="size-4" /> {label}
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
