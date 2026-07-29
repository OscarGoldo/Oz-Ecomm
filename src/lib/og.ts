import { STORE_IMAGES_BUCKET, getImageUrl } from "@/lib/storage";

/**
 * Helpers de las tarjetas OG (`opengraph-image.tsx`) — la imagen que ve alguien
 * cuando pegan el link de una tienda o un producto en WhatsApp o Instagram.
 *
 * OJO: todo esto corre en el runtime EDGE. Las tarjetas van en edge porque
 * `next/og` en runtime Node se rompe en Windows al cargar su fuente por defecto
 * (arma `.\file:\C:\...`, que no es una URL válida), así que en local no se
 * podrían probar. Consecuencias que hay que respetar acá:
 *   - no hay `Buffer` → base64 a mano
 *   - nada de `server-only` ni de librerías que asuman Node
 *   - el bundle tiene tope, por eso se habla con PostgREST por `fetch` pelado
 *     en vez de arrastrar el cliente de Supabase
 */

/** El tamaño que esperan WhatsApp, Instagram y X. No lo cambies a ojo. */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

/** Si algo tarda más que esto, la tarjeta sale sin foto y listo. */
const FETCH_TIMEOUT_MS = 5000;

/**
 * GET contra PostgREST con la anon key.
 *
 * Con la anon key (no service role) siguen aplicando las policies de lectura
 * pública: una tarjeta OG nunca debe poder mostrar un producto en borrador ni
 * una tienda desactivada. Devuelve [] ante cualquier problema — quien llama
 * siempre tiene que poder dibujar algo.
 */
export async function restGet<T>(query: string): Promise<T[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return [];

  try {
    const res = await fetch(`${base}/rest/v1/${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch {
    return [];
  }
}

/** Cuenta filas sin traerlas (el total viene en el header Content-Range). */
export async function restCount(query: string): Promise<number> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return 0;

  try {
    const res = await fetch(`${base}/rest/v1/${query}`, {
      method: "HEAD",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const total = res.headers.get("content-range")?.split("/")[1];
    const n = Number(total);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Valor listo para meter en un filtro `eq.` de PostgREST. */
export function eq(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Los únicos formatos que satori/resvg sabe decodificar.
 *
 * WebP, AVIF y SVG NO entran, y los uploaders aceptan `image/*` — o sea que hay
 * fotos de productos que no se pueden dibujar. Por eso `loadOgImage` devuelve
 * null en vez de reventar: la tarjeta cae al diseño sin foto.
 */
const RENDERABLE = new Set(["image/jpeg", "image/pjpeg", "image/png", "image/gif"]);

/** Arriba de esto el render se vuelve lento y el PNG sale pesado. */
const MAX_SOURCE_BYTES = 4_000_000;

/** El recuadro, en píxeles, donde se va a dibujar la imagen. */
export interface OgBox {
  w: number;
  h: number;
}

/** base64 sin `Buffer`, por chunks para no reventar la pila con imágenes grandes. */
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * URLs a intentar, en orden de preferencia.
 *
 * Primero el endpoint de transformación de Supabase, que devuelve un JPEG ya
 * recortado al tamaño que necesitamos: baja el peso del PNG final (lo que
 * WhatsApp corta arriba de ~600 KB) y de paso convierte formatos que satori no
 * soporta. Si el proyecto no tiene transformaciones habilitadas responde error
 * y caemos al archivo original.
 */
function candidateUrls(pathOrUrl: string, box: OgBox): string[] {
  const urls: string[] = [];
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isAbsolute = /^https?:\/\//i.test(pathOrUrl);

  if (!isAbsolute && base) {
    const path = pathOrUrl.replace(/^\/+/, "");
    // Se pide EXACTAMENTE el tamaño al que se va a dibujar: si satori tiene que
    // reescalar, inventa colores intermedios y el PNG final engorda bastante.
    urls.push(
      `${base}/storage/v1/render/image/public/${STORE_IMAGES_BUCKET}/${path}` +
        `?width=${box.w}&height=${box.h}&resize=cover&quality=60`,
    );
  }

  const direct = getImageUrl(pathOrUrl);
  if (direct) urls.push(direct);

  return urls;
}

/**
 * Descarga una imagen y la devuelve como data URI listo para `<img>` de satori.
 * null = no se pudo (formato no soportado, muy pesada, 404, timeout). Quien
 * llama debe tener siempre un diseño alternativo.
 */
export async function loadOgImage(
  pathOrUrl: string | null | undefined,
  box: OgBox,
): Promise<string | null> {
  if (!pathOrUrl) return null;

  for (const url of candidateUrls(pathOrUrl, box)) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;

      const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
      if (!RENDERABLE.has(type)) continue;

      const buf = await res.arrayBuffer();
      if (buf.byteLength === 0 || buf.byteLength > MAX_SOURCE_BYTES) continue;

      return `data:${type};base64,${toBase64(buf)}`;
    } catch {
      // Siguiente candidata; si no queda ninguna, la tarjeta va sin foto.
    }
  }

  return null;
}

/** Corta en el último espacio antes del límite, para no partir una palabra. */
export function truncate(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Hex válido de 6 dígitos, o el azul por defecto de una tienda nueva. */
export function safeColor(hex: string | null | undefined): string {
  const value = (hex ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#2563EB";
}

/** La inicial que se dibuja cuando no hay foto ni logo. */
export function initialOf(name: string): string {
  return (name.trim()[0] ?? "T").toUpperCase();
}

/** El dominio público, sin protocolo, para el pie de la tarjeta. */
export function publicHost(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.tiendifyapp.com";
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}
