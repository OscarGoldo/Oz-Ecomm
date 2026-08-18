"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { compressImage } from "@/lib/image-compress";
import type { Database } from "@/types/database";

/**
 * Subida de imágenes con progreso real.
 *
 * `supabase-js` v2 sube con fetch y no expone el avance, así que sobre una red
 * lenta el usuario ve un spinner que no le dice nada y vuelve a tocar el botón.
 * Acá se sube con XHR contra el endpoint REST de Storage, que sí emite
 * `progress`. Si algo del camino manual falla —headers, CORS, un proxy raro—
 * se reintenta con el cliente de supabase, que es el camino ya probado: el
 * progreso es una mejora, nunca un motivo para que la subida no ocurra.
 */

export interface UploadResult {
  ok: boolean;
  /** Ruta dentro del bucket, para guardar en la base. */
  path?: string;
  error?: string;
}

interface UploadArgs {
  supabase: SupabaseClient<Database>;
  bucket: string;
  path: string;
  file: File;
  cacheControl?: string;
  /** 0–100. Durante la compresión no se llama; arranca al empezar a subir. */
  onProgress?: (percent: number) => void;
}

/** Sube con XHR para poder informar el avance. Lanza si no termina en 2xx. */
function xhrUpload(args: {
  url: string;
  token: string;
  apikey: string;
  file: File;
  cacheControl: string;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  const { url, token, apikey, file, cacheControl, onProgress } = args;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", apikey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", `max-age=${cacheControl}`);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || !onProgress) return;
      // Se corta en 99: el 100 lo pone el load, cuando el server ya respondió.
      onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(new Error(`storage respondió ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("fallo de red"));
    xhr.onabort = () => reject(new Error("subida cancelada"));
    xhr.send(file);
  });
}

/**
 * Comprime y sube una imagen. Devuelve la ruta guardable en la base.
 * El archivo que llega ya tiene que estar validado (tipo y tamaño).
 */
export async function uploadImage({
  supabase,
  bucket,
  path,
  file,
  cacheControl = "3600",
  onProgress,
}: UploadArgs): Promise<UploadResult> {
  const compressed = await compressImage(file);

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (base && apikey) {
    try {
      // El token del usuario logueado si lo hay; si no, la anon key, que es lo
      // que usa el cliente que sube el comprobante sin cuenta.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? apikey;
      await xhrUpload({
        url: `${base}/storage/v1/object/${bucket}/${path}`,
        token,
        apikey,
        file: compressed,
        cacheControl,
        onProgress,
      });
      return { ok: true, path };
    } catch {
      // Cae al camino de supabase-js.
    }
  }

  onProgress?.(50);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, compressed, { cacheControl, upsert: false });
  if (error) return { ok: false, error: error.message };
  onProgress?.(100);
  return { ok: true, path };
}
