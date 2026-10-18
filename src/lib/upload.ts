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
  method: "POST" | "PUT";
  headers: Record<string, string>;
  body: File | FormData;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  const { url, method, headers, body, onProgress } = args;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);

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
    xhr.send(body);
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
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        apikey,
        "x-upsert": "false",
        "cache-control": `max-age=${cacheControl}`,
      };
      if (compressed.type) headers["Content-Type"] = compressed.type;
      await xhrUpload({
        url: `${base}/storage/v1/object/${bucket}/${path}`,
        method: "POST",
        headers,
        body: compressed,
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

/** Lo que devuelve el servidor al pedir permiso para subir (ver storage-actions.ts). */
export interface UploadTicket {
  ok: boolean;
  error?: string;
  path?: string;
  token?: string;
}

/** Extensión que corresponde al tipo del archivo ya comprimido. */
function extFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/heic") return "heic";
  if (type === "image/heif") return "heif";
  return "jpg";
}

/** El techo del bucket de comprobantes (migración 0021). */
const SIGNED_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Comprime y sube con una URL firmada que emite el servidor: la forma de subir
 * comprobantes desde la migración 0021, que quitó el permiso de subida directa
 * con la anon key. El servidor elige la ruta y da un token de un solo uso.
 *
 * `error` va listo para mostrarle al usuario cuando el problema es suyo (foto
 * muy pesada) o del servidor (tienda cerrada); si no, el componente pone su
 * mensaje de conexión.
 */
export async function uploadImageSigned({
  supabase,
  bucket,
  file,
  getTicket,
  cacheControl = "3600",
  onProgress,
}: {
  supabase: SupabaseClient<Database>;
  bucket: string;
  file: File;
  /** Pide la ruta y el token al servidor, con la extensión del archivo final. */
  getTicket: (ext: string) => Promise<UploadTicket>;
  cacheControl?: string;
  onProgress?: (percent: number) => void;
}): Promise<UploadResult & { userError?: boolean }> {
  const compressed = await compressImage(file);
  if (compressed.size > SIGNED_MAX_BYTES) {
    return {
      ok: false,
      userError: true,
      error: "La imagen es muy pesada. Sube una captura de pantalla del comprobante.",
    };
  }

  let ticket: UploadTicket;
  try {
    ticket = await getTicket(extFor(compressed.type));
  } catch {
    return { ok: false, error: "fallo de red" };
  }
  if (!ticket.ok || !ticket.path || !ticket.token) {
    return { ok: false, userError: true, error: ticket.error ?? "No se pudo preparar la subida" };
  }
  const { path, token } = ticket;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (base && apikey) {
    try {
      // Mismo pedido que arma supabase-js en uploadToSignedUrl, pero con XHR
      // para tener el avance. El token va en la URL; no hace falta sesión.
      const body = new FormData();
      body.append("cacheControl", cacheControl);
      body.append("", compressed);
      await xhrUpload({
        url: `${base}/storage/v1/object/upload/sign/${bucket}/${path}?token=${encodeURIComponent(token)}`,
        method: "PUT",
        headers: { apikey, "x-upsert": "false" },
        body,
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
    .uploadToSignedUrl(path, token, compressed, { cacheControl });
  if (error) return { ok: false, error: error.message };
  onProgress?.(100);
  return { ok: true, path };
}
