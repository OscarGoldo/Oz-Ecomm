"use client";

import { useRef, useState } from "react";
import { Camera, FileImage, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { PAYMENT_PROOFS_BUCKET } from "@/lib/storage";
import { uploadImage } from "@/lib/upload";
import { formatBytes } from "@/lib/image-compress";

const MAX_BYTES = 25 * 1024 * 1024;

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
  const [phase, setPhase] = useState<"idle" | "compressing" | "uploading">("idle");
  const [percent, setPercent] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [finalSize, setFinalSize] = useState<number | null>(null);

  const busy = phase !== "idle";

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Sube una foto o captura del comprobante");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("La imagen es demasiado grande. Prueba con una captura.");
      return;
    }

    const supabase = createClient();
    setPhase("compressing");
    setPercent(0);

    const path = `${storeId}/${folder}/${crypto.randomUUID()}.jpg`;
    const res = await uploadImage({
      supabase,
      bucket: PAYMENT_PROOFS_BUCKET,
      path,
      file,
      onProgress: (p) => {
        setPhase("uploading");
        setPercent(p);
      },
    });

    setPhase("idle");
    setPercent(0);

    if (!res.ok || !res.path) {
      toast.error("No se pudo subir el comprobante. Revisa tu conexión.", {
        description: "Puedes intentar de nuevo con la misma foto.",
      });
      return;
    }
    setPreview(URL.createObjectURL(file));
    setFinalSize(file.size);
    onChange(res.path);
  }

  function clear() {
    setPreview(null);
    setFinalSize(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/5 p-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Comprobante"
            className="size-14 shrink-0 rounded-md border object-cover"
          />
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
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
          className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Quitar comprobante"
        >
          <X className="size-5" />
        </button>
      </div>
    );
  }

  if (busy) {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="size-4 animate-spin text-primary" />
          {phase === "compressing" ? "Preparando la imagen…" : "Subiendo…"}
          {phase === "uploading" && (
            <span className="ml-auto tabular-nums text-muted-foreground">
              {percent}%
            </span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: phase === "compressing" ? "8%" : `${percent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {phase === "compressing"
            ? "Achicamos la foto para que suba rápido y gastes menos datos."
            : finalSize
              ? `Enviando ${formatBytes(finalSize)}`
              : "No cierres esta pantalla."}
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex min-h-[72px] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
      >
        <span className="inline-flex items-center gap-2">
          <Camera className="size-5" /> {label}
        </span>
        <span className="text-xs font-normal text-muted-foreground">
          Una foto o captura de la pantalla de tu banco
        </span>
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
