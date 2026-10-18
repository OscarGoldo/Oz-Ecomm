import "server-only";

import { randomUUID } from "crypto";
import { cookies, headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { detectVisitSource, isVisitSource, type VisitSource } from "@/lib/visit-source";

/** Anonymous per-browser session id. httpOnly so it can't be spoofed client-side. */
export const SESSION_COOKIE = "oz_sid";
const SESSION_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

/**
 * De dónde llegó la visita en curso (ver lib/visit-source.ts). Lo pone la
 * acción de la visita al entrar a la tienda y lo leen los eventos siguientes:
 * un producto visto o una compra quedan con el origen de esa visita.
 */
export const SOURCE_COOKIE = "oz_src";
const SOURCE_MAX_AGE = 60 * 60 * 24; // un día

export type StoreEventType =
  | "visit"
  | "product_view"
  | "add_to_cart"
  | "checkout_start"
  | "purchase";

/**
 * Read the visitor's session id, creating (and persisting) one on first sight.
 * Safe to call from a Server Action or Route Handler. Setting the cookie during
 * a plain Server Component render throws, so we swallow that — the caller still
 * gets a usable id for this request.
 */
export function getOrCreateSessionId(): string {
  const jar = cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  if (existing) return existing;
  const id = randomUUID();
  try {
    jar.set(SESSION_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  } catch {
    // Read-only context (e.g. rendering) — the event just won't tie to a cookie.
  }
  return id;
}

/**
 * Record a storefront analytics event. Fire-and-forget: never throws, so a
 * tracking hiccup can never break add-to-cart or checkout.
 */
export async function recordEvent(
  storeId: string,
  eventType: StoreEventType,
  productId?: string | null,
  source?: VisitSource,
): Promise<void> {
  try {
    const sessionId = getOrCreateSessionId();
    const fromCookie = cookies().get(SOURCE_COOKIE)?.value;
    const visitSource = source ?? (isVisitSource(fromCookie) ? fromCookie : null);
    const db = createAdminClient();
    const row = {
      store_id: storeId,
      session_id: sessionId,
      event_type: eventType,
      product_id: productId ?? null,
    };
    const { error } = visitSource
      ? await db.from("store_events").insert({ ...row, source: visitSource })
      : await db.from("store_events").insert(row);
    // Sin la migración 0035 la columna `source` no existe y el insert falla
    // entero: se guarda igual, sin origen, para no perder el evento.
    if (error && visitSource) await db.from("store_events").insert(row);
  } catch {
    // Analytics is best-effort; swallow everything.
  }
}

/**
 * Una entrada a la tienda desde afuera. Guarda de dónde vino en una cookie
 * para que los eventos de esa visita lo lleven, y la registra como "visit":
 * así cuenta también quien entra y se va sin abrir ningún producto.
 */
export async function recordVisit(
  storeId: string,
  referrer: string | null,
  tag: string | null,
): Promise<void> {
  try {
    const source = detectVisitSource({
      tag,
      referrer,
      userAgent: headers().get("user-agent"),
    });
    try {
      cookies().set(SOURCE_COOKIE, source, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: SOURCE_MAX_AGE,
      });
    } catch {
      // Contexto de solo lectura: la visita igual se registra con su origen.
    }
    await recordEvent(storeId, "visit", null, source);
  } catch {
    // Igual que el resto de la analítica: nunca rompe la tienda.
  }
}

