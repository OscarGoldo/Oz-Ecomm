import "server-only";

import webpush from "web-push";

import { reportError } from "@/lib/report-error";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Avisos al teléfono del comerciante (Web Push).
 *
 * Por qué existe: el único aviso que le llegaba al comerciante por su cuenta
 * era un correo, y acá nadie mira el correo. WhatsApp desde un número de
 * Tiendify cuesta por mensaje y pide un trámite con Meta; esto es gratis.
 *
 * Cómo llega con el navegador cerrado: el teléfono mantiene siempre abierta
 * una conexión con Google (Android) o Apple (iPhone), la misma de los avisos
 * de cualquier app. Al activar, el navegador nos da una dirección en esos
 * servidores (`endpoint`); Tiendify manda el aviso ahí, cifrado con las
 * claves VAPID, y el sistema despierta un momento a public/sw.js para
 * mostrarlo.
 *
 * Variables de entorno (se generan una vez con `npx web-push generate-vapid-keys`):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — la pública; el navegador la usa al suscribirse
 *   VAPID_PRIVATE_KEY             — la privada; firma cada envío
 *
 * Sin ellas no hace nada, igual que `sendEmail` sin RESEND_API_KEY: un aviso
 * que no sale nunca puede tumbar un pedido.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** Ruta del panel que se abre al tocar el aviso. */
  url: string;
  /** Avisos con el mismo tag se reemplazan en vez de apilarse. */
  tag?: string;
}

const SUBJECT = "https://usatiendify.com";

/**
 * "María Pérez González" → "María P.". El aviso se ve en la pantalla bloqueada:
 * con el nombre de pila y la inicial alcanza para reconocer el pedido.
 */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Un cliente";
  return parts.length === 1 ? parts[0]! : `${parts[0]} ${parts[1]![0]!.toUpperCase()}.`;
}

/** El aviso de un pedido que acaba de entrar, según cómo quedó. */
export function newOrderPush(o: {
  id: string;
  orderNumber: number;
  customerName: string;
  totalLabel: string;
  paymentLabel?: string | null;
  status: "pending_payment" | "pending_confirmation" | "confirmed" | string;
}): PushPayload {
  const n = `#${o.orderNumber}`;
  const title =
    o.status === "confirmed"
      ? `✅ Pedido ${n} pagado`
      : o.status === "pending_confirmation"
        ? `🧾 Pedido ${n}: comprobante por revisar`
        : `🛍️ Nuevo pedido ${n}`;
  return {
    title,
    body: [o.totalLabel, o.paymentLabel, shortName(o.customerName)].filter(Boolean).join(" · "),
    url: `/panel/pedidos/${o.id}`,
    tag: `pedido-${o.id}`,
  };
}

/** El aviso de un comprobante que llegó después del pedido. */
export function proofPush(o: { id: string; orderNumber: number; customerName: string }): PushPayload {
  return {
    title: `🧾 Comprobante del pedido #${o.orderNumber}`,
    body: `${shortName(o.customerName)} subió el pago. Revísalo y confírmalo.`,
    url: `/panel/pedidos/${o.id}`,
    tag: `pedido-${o.id}`,
  };
}

let configured: boolean | null = null;

/** ¿Están las claves VAPID? Configura web-push la primera vez. */
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  try {
    // El "subject" es cómo nos contactan Google o Apple si algo anda mal. Tiene
    // que ser https y no localhost (Apple rechaza el envío), así que en local
    // va también el dominio real.
    webpush.setVapidDetails(SUBJECT, publicKey, privateKey);
    configured = true;
  } catch (e) {
    reportError("pushConfigured", e);
    configured = false;
  }
  return configured;
}

/** Lo que guarda el navegador al suscribirse (PushSubscription.toJSON()). */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

type Db = ReturnType<typeof createAdminClient>;
type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Entrega el aviso a cada dirección. Las que Google o Apple dan por muertas
 * (404/410: borró los datos, desinstaló) se borran, para no insistir en cada
 * pedido. Devuelve a cuántas llegó.
 */
async function deliver(db: Db, subs: SubRow[], payload: PushPayload, storeId: string): Promise<number> {
  const body = JSON.stringify(payload);
  const dead: string[] = [];
  const results = await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          // Un pedido de hace dos días ya no sirve como aviso: si el teléfono
          // está apagado más de un día, se descarta. Urgencia alta para que
          // Android no lo demore por ahorro de batería.
          { TTL: 24 * 60 * 60, urgency: "high", timeout: 10_000 },
        );
        return true;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
        else reportError("pushDeliver", e, { storeId, status });
        return false;
      }
    }),
  );
  if (dead.length) await db.from("push_subscriptions").delete().in("id", dead);
  return results.filter(Boolean).length;
}

/**
 * Manda el aviso a todos los teléfonos activados de la tienda. Nunca lanza.
 * Devuelve a cuántos teléfonos llegó.
 */
export async function sendStorePush(storeId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;
  try {
    const db = createAdminClient();
    const { data: subs, error } = await db
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("store_id", storeId);
    // Sin la migración 0034 la tabla no existe: se ignora en silencio.
    if (error || !subs?.length) return 0;
    return await deliver(db, subs, payload, storeId);
  } catch (e) {
    reportError("sendStorePush", e, { storeId });
    return 0;
  }
}

/**
 * Cuántos teléfonos (o computadoras) de la tienda tienen los avisos activos.
 * El Resumen deja de ofrecerlos cuando ya hay alguno: si ya le suena el
 * teléfono, verlo en la computadora todos los días es ruido (en Ajustes sigue
 * la opción para activarlos también ahí). 0 si la tabla no existe.
 */
export async function storePushDeviceCount(storeId: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);
  return error ? 0 : (count ?? 0);
}

/** El aviso de prueba: solo al teléfono que lo pidió. */
export async function sendPushToEndpoint(
  storeId: string,
  endpoint: string,
  payload: PushPayload,
): Promise<boolean> {
  if (!pushConfigured()) return false;
  try {
    const db = createAdminClient();
    const { data: sub } = await db
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("store_id", storeId)
      .eq("endpoint", endpoint)
      .maybeSingle();
    if (!sub) return false;
    return (await deliver(db, [sub], payload, storeId)) > 0;
  } catch (e) {
    reportError("sendPushToEndpoint", e, { storeId });
    return false;
  }
}
