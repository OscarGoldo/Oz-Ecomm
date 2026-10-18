import { NextResponse, type NextRequest } from "next/server";

import { alertError } from "@/lib/error-alerts";
import { publicSiteUrl } from "@/lib/site-url";
import { PAYMENT_PROOFS_BUCKET } from "@/lib/storage";
import { createProofUploadTicket } from "@/lib/storage-actions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Revisión automática, cada hora (vercel.json): hace lo que hace un cliente en
 * lo que más importa y avisa a Telegram si algo no anda.
 *
 * Existe porque los errores de verdad solo aparecen cuando alguien usa la
 * función. En octubre de 2026 los comprobantes dejaron de subir y, como no
 * entraban pedidos, nadie lo vio. Esto lo habría avisado en menos de una hora.
 *
 * Usa la tienda de prueba del dueño (alfa-electronic). No deja nada: el
 * comprobante de prueba se borra apenas sube.
 *
 * `?prueba=1` manda además una alerta de prueba, para ver que el aviso de
 * errores llega al grupo. Protegido con CRON_SECRET, igual que los otros crons.
 */

const TEST_STORE_SLUG = "alfa-electronic";
const BCV_MAX_AGE_HOURS = 26;

/** JPEG mínimo válido (1×1 px). */
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

type Check = { name: string; ok: boolean; detail?: string };

/**
 * Sube un comprobante exactamente como lo hace el navegador del cliente: pide
 * la URL firmada al servidor y sube con la anon key. Después lo borra.
 */
async function checkProofUpload(storeId: string): Promise<Check> {
  const name = "comprobantes";
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !apikey) return { name, ok: false, detail: "Faltan las variables de Supabase" };

  const ticket = await createProofUploadTicket(storeId, "jpg", "proofs");
  if (!ticket.ok || !ticket.path || !ticket.token) {
    return { name, ok: false, detail: `El servidor no dio permiso para subir: ${ticket.error ?? "sin detalle"}` };
  }

  const body = new FormData();
  body.append("cacheControl", "60");
  body.append("", new Blob([TINY_JPEG], { type: "image/jpeg" }), "revision.jpg");
  const res = await fetch(
    `${base}/storage/v1/object/upload/sign/${PAYMENT_PROOFS_BUCKET}/${ticket.path}?token=${encodeURIComponent(ticket.token)}`,
    { method: "PUT", headers: { apikey, "x-upsert": "false" }, body, signal: AbortSignal.timeout(10_000) },
  );
  const text = res.ok ? "" : (await res.text().catch(() => "")).slice(0, 200);

  // Se borra pase lo que pase: la revisión no puede ir llenando el bucket.
  await createAdminClient().storage.from(PAYMENT_PROOFS_BUCKET).remove([ticket.path]);

  return res.ok
    ? { name, ok: true }
    : { name, ok: false, detail: `Storage rechazó la subida (${res.status}): ${text}` };
}

async function checkBcv(): Promise<Check> {
  const name = "tasa-bcv";
  const { data, error } = await createAdminClient()
    .from("bcv_rates")
    .select("updated_at, usd")
    .eq("id", "current")
    .maybeSingle();
  if (error || !data) return { name, ok: false, detail: `No se pudo leer la tasa: ${error?.message ?? "no hay fila"}` };
  const hours = (Date.now() - Date.parse(data.updated_at)) / 3_600_000;
  return hours <= BCV_MAX_AGE_HOURS
    ? { name, ok: true }
    : {
        name,
        ok: false,
        detail: `La tasa BCV no se actualiza hace ${Math.floor(hours)} horas (última: ${data.usd} Bs/USD). Las tiendas con tasa automática muestran precios en Bs viejos.`,
      };
}

async function checkStorefront(): Promise<Check> {
  const name = "tienda-publica";
  try {
    const res = await fetch(`${publicSiteUrl()}/${TEST_STORE_SLUG}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok
      ? { name, ok: true }
      : { name, ok: false, detail: `La tienda de prueba respondió ${res.status}` };
  } catch (e) {
    return { name, ok: false, detail: `La tienda de prueba no cargó: ${String(e).slice(0, 150)}` };
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const { data: store } = await createAdminClient()
    .from("stores")
    .select("id")
    .eq("slug", TEST_STORE_SLUG)
    .maybeSingle();

  const checks = await Promise.all([
    store
      ? checkProofUpload(store.id).catch((e) => ({ name: "comprobantes", ok: false, detail: String(e).slice(0, 200) }))
      : Promise.resolve({ name: "comprobantes", ok: false, detail: `No existe la tienda de prueba ${TEST_STORE_SLUG}` }),
    checkBcv().catch((e) => ({ name: "tasa-bcv", ok: false, detail: String(e).slice(0, 200) })),
    checkStorefront(),
  ]);

  for (const c of checks) {
    if (!c.ok) await alertError({ source: "revision", where: c.name, detail: c.detail ?? "sin detalle" });
  }

  if (request.nextUrl.searchParams.get("prueba") === "1") {
    await alertError({
      source: "revision",
      where: "prueba",
      detail: "Alerta de prueba: así te va a llegar cada error de Tiendify. No hay nada roto.",
    });
  }

  return NextResponse.json({ ok: checks.every((c) => c.ok), checks });
}
