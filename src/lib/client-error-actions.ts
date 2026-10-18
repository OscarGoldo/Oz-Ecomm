"use server";

import { headers } from "next/headers";

import { alertError } from "@/lib/error-alerts";

/**
 * Errores que pasan en el navegador del usuario y que el servidor nunca ve:
 * una subida a Storage rechazada, una pantalla de error. Lo de octubre de 2026
 * (los comprobantes que no subían) fue justo eso: el teléfono del cliente
 * hablaba directo con Supabase y nadie se enteró.
 *
 * Es una acción pública (la llama el checkout, sin sesión), así que solo
 * acepta los lugares de esta lista: con una clave libre, cualquiera podría
 * inventar mil y llenar el grupo de Telegram. Cada lugar avisa como mucho una
 * vez cada 30 minutos (ver error-alerts.ts).
 */
const PLACES = {
  comprobante: "No se pudo subir un comprobante de pago",
  pagina: "Una página mostró la pantalla de error",
  "carga-fotos": "No se pudo subir una foto en Cargar con fotos",
  "fotos-producto": "No se pudo subir una foto de producto",
} as const;

export type ClientErrorPlace = keyof typeof PLACES;

/** "Mozilla/5.0 (Linux; Android 13…) … Instagram" → "Android · Instagram". */
function device(ua: string): string {
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS/.test(ua)
          ? "Mac"
          : "otro";
  const app = /Instagram/.test(ua)
    ? "Instagram"
    : /FBAN|FBAV/.test(ua)
      ? "Facebook"
      : /WhatsApp/.test(ua)
        ? "WhatsApp"
        : /EdgA?\//.test(ua)
          ? "Edge"
          : /Chrome|CriOS/.test(ua)
            ? "Chrome"
            : /Safari/.test(ua)
              ? "Safari"
              : /Firefox|FxiOS/.test(ua)
                ? "Firefox"
                : "navegador";
  return `${os} · ${app}`;
}

export async function reportClientError(input: {
  place: ClientErrorPlace;
  message?: string;
  path?: string;
  /** El código que Next le pone a un error del servidor (pantalla de error). */
  digest?: string;
}): Promise<void> {
  try {
    if (
      !input ||
      typeof input.place !== "string" ||
      !Object.prototype.hasOwnProperty.call(PLACES, input.place)
    ) {
      return;
    }
    const place = input.place;
    const message = String(input.message ?? "").slice(0, 300) || "sin detalle";
    const path = String(input.path ?? "").slice(0, 200) || undefined;
    const ua = headers().get("user-agent") ?? "";

    console.error(`[client-error] ${place} ${path ?? ""} — ${message}`);
    await alertError({
      source: "navegador",
      where: place,
      detail: `${PLACES[place]}. ${message}${input.digest ? ` (digest ${String(input.digest).slice(0, 40)})` : ""} · ${device(ua)}`,
      path,
    });
  } catch {
    // Reportar nunca le puede dar un error al usuario.
  }
}
