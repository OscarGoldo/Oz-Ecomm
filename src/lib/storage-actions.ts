"use server";

import { randomUUID } from "crypto";

import { getSessionContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAYMENT_PROOFS_BUCKET } from "@/lib/storage";

/**
 * Emisión de permisos de subida para el bucket privado de comprobantes.
 *
 * Por qué existe: hasta la migración 0021 la policy de storage era
 * `WITH CHECK (bucket_id = 'payment-proofs')` — es decir, cualquiera con la
 * anon key (que está en el bundle público) podía escribir el archivo que
 * quisiera, del tamaño que quisiera, en la carpeta que quisiera. Ahora esa
 * policy no existe y el navegador ya no elige la ruta: la arma el servidor y
 * entrega un token de un solo uso para ESA ruta.
 *
 * Nota: acá todavía falta un límite por IP (hallazgo #22 de la auditoría). El
 * tope de 5 MB y de tipo MIME ya lo aplica el bucket, así que el peor caso es
 * ruido, no una factura.
 */

const ALLOWED_FOLDERS = ["proofs", "subs"] as const;
type ProofFolder = (typeof ALLOWED_FOLDERS)[number];

/** Extensiones que se corresponden con los MIME que acepta el bucket. */
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ProofUploadTicket {
  ok: boolean;
  error?: string;
  /** Ruta definitiva dentro del bucket. Es la que se guarda en la orden. */
  path?: string;
  /** Token de un solo uso para `uploadToSignedUrl`. */
  token?: string;
}

/**
 * Devuelve una URL firmada para subir UN comprobante a la carpeta de una
 * tienda. El nombre del archivo lo genera el servidor, así que el cliente no
 * puede escribir fuera de `<store_id>/<carpeta>/`.
 */
export async function createProofUploadTicket(
  storeId: string,
  fileExtension: string,
  folder: string = "proofs",
): Promise<ProofUploadTicket> {
  if (!UUID_RE.test(storeId)) {
    return { ok: false, error: "Tienda inválida" };
  }

  const sub = (folder || "proofs").toLowerCase();
  if (!ALLOWED_FOLDERS.includes(sub as ProofFolder)) {
    return { ok: false, error: "Destino inválido" };
  }

  const ext = (fileExtension || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ALLOWED_EXT.has(ext)) {
    return { ok: false, error: "Sube una foto (JPG, PNG o WEBP)" };
  }

  const db = createAdminClient();

  // El comprobante del plan Pro lo sube el comerciante desde su panel: ahí sí
  // exigimos que la sesión sea la dueña de esa tienda. El de un pedido lo sube
  // un cliente anónimo, así que solo se verifica que la tienda esté abierta.
  if (sub === "subs") {
    const ctx = await getSessionContext();
    if (!ctx?.store || ctx.store.id !== storeId) {
      return { ok: false, error: "No autorizado" };
    }
  } else {
    const { data: store } = await db
      .from("stores")
      .select("id, active")
      .eq("id", storeId)
      .maybeSingle();
    if (!store || !store.active) {
      return { ok: false, error: "La tienda no está disponible" };
    }
  }

  const path = `${storeId}/${sub}/${randomUUID()}.${ext}`;
  const { data, error } = await db.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { ok: false, error: "No se pudo preparar la subida" };
  }

  return { ok: true, path: data.path, token: data.token };
}
