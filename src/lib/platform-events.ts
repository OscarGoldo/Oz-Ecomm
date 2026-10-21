import "server-only";

import { formatUSD } from "@/lib/format";
import { reportError } from "@/lib/report-error";
import { publicSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeTelegramHtml, sendTelegram } from "@/lib/telegram";
import type { Json } from "@/types/database";

/**
 * Lo que pasa en Tiendify, anotado una vez (tabla `platform_events`, migración
 * 0031) y avisado al grupo de Telegram de los socios.
 *
 * Quien llama escribe el título y el detalle ya en castellano: es quien sabe
 * qué pasó. Esto solo lo guarda, le pone el ícono de su grupo y lo manda.
 */
export type PlatformEventType =
  // Clientes
  | "store.created"
  | "store.closed"
  | "feedback.received"
  // Dinero que entra
  | "plan.paid"
  | "plan.proof_submitted"
  | "plan.proof_approved"
  | "plan.proof_rejected"
  | "order.card_paid"
  // Dinero que sale
  | "payout.sent"
  // Crecimiento
  | "referral.needs_review"
  // Alertas
  | "plan.expiring"
  | "plan.paused"
  | "plan.cancelled"
  | "plan.payment_failed"
  | "stripe.dispute"
  | "stripe.refund"
  | "stripe.orphan_charge"
  | "ai.budget_reached"
  | "ai.budget_warning"
  // Errores (los anota y avisa src/lib/error-alerts.ts, no recordPlatformEvent)
  | "system.error";

export type EventGroup = "clientes" | "dinero" | "pagos" | "crecimiento" | "alerta";

export const EVENT_GROUP: Record<PlatformEventType, EventGroup> = {
  "store.created": "clientes",
  "store.closed": "clientes",
  "feedback.received": "clientes",
  "plan.paid": "dinero",
  "plan.proof_submitted": "dinero",
  "plan.proof_approved": "dinero",
  "plan.proof_rejected": "dinero",
  "order.card_paid": "dinero",
  "payout.sent": "pagos",
  "referral.needs_review": "crecimiento",
  "plan.expiring": "alerta",
  "plan.paused": "alerta",
  "plan.cancelled": "alerta",
  "plan.payment_failed": "alerta",
  "stripe.dispute": "alerta",
  "stripe.refund": "alerta",
  "stripe.orphan_charge": "alerta",
  "ai.budget_reached": "alerta",
  "ai.budget_warning": "alerta",
  "system.error": "alerta",
};

/** Un ícono por grupo, para leer el grupo de Telegram de un vistazo. */
const TELEGRAM_ICON: Record<EventGroup, string> = {
  clientes: "🏪",
  dinero: "💰",
  pagos: "📤",
  crecimiento: "🎁",
  alerta: "⚠️",
};

export interface PlatformEventInput {
  type: PlatformEventType;
  title: string;
  detail?: string | null;
  storeId?: string | null;
  /** En USD. Se agrega al título del aviso. */
  amount?: number | null;
  /** Ruta de /super ("/super/pagos") o enlace absoluto (Stripe). */
  url?: string | null;
  data?: Record<string, unknown>;
  /** Para lo que se revisa todos los días: el mismo aviso no se repite. */
  dedupeKey?: string | null;
}

export interface PlatformEvent {
  id: string;
  type: PlatformEventType;
  store_id: string | null;
  amount: number | null;
  title: string;
  detail: string | null;
  url: string | null;
  created_at: string;
}

function absoluteUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${publicSiteUrl()}${url}`;
}

/**
 * Anota el evento y lo avisa por Telegram.
 *
 * Nunca lanza: corre adentro de pagos, registros y webhooks, y un aviso que
 * falla no puede tumbar nada de eso. Si la tabla todavía no existe (0031 sin
 * correr) el aviso sale igual; si Telegram no está configurado, queda anotado.
 */
export async function recordPlatformEvent(e: PlatformEventInput): Promise<void> {
  try {
    const db = createAdminClient();
    const { data: row, error } = await db
      .from("platform_events")
      .insert({
        type: e.type,
        title: e.title,
        detail: e.detail ?? null,
        store_id: e.storeId ?? null,
        amount: e.amount ?? null,
        url: e.url ?? null,
        data: (e.data ?? {}) as Json,
        dedupe_key: e.dedupeKey ?? null,
      })
      .select("id")
      .maybeSingle();

    // Ya estaba anotado (mismo dedupe_key): ya se avisó, no se repite.
    if (error?.code === "23505") return;
    // Sin la migración 0031 la tabla no existe: el aviso sale igual, y no se
    // llena el registro de errores con uno por cada pago o registro.
    const missingTable = error?.code === "42P01" || error?.code === "PGRST205";
    if (error && !missingTable) {
      reportError("recordPlatformEvent", new Error(error.message), { type: e.type });
    }

    const icon = TELEGRAM_ICON[EVENT_GROUP[e.type]];
    const lines = [
      `${icon} <b>${escapeTelegramHtml(e.title)}${
        e.amount != null ? ` · ${formatUSD(e.amount)}` : ""
      }</b>`,
    ];
    if (e.detail) lines.push(escapeTelegramHtml(e.detail));
    if (e.url) lines.push(`<a href="${absoluteUrl(e.url)}">Abrir</a>`);

    const sent = await sendTelegram(lines.join("\n"));
    if (sent && row) {
      await db
        .from("platform_events")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  } catch (err) {
    reportError("recordPlatformEvent", err, { type: e.type });
  }
}

/** Lo último que pasó, para Inicio. null si la migración 0031 no está. */
export async function getRecentEvents(limit = 12): Promise<PlatformEvent[] | null> {
  const { data, error } = await createAdminClient()
    .from("platform_events")
    .select("id, type, store_id, amount, title, detail, url, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return null;
  return (data ?? []).map((r) => ({
    ...r,
    type: r.type as PlatformEventType,
    amount: r.amount != null ? Number(r.amount) : null,
  }));
}
