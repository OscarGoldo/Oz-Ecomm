import "server-only";

import { planNoticeEmail, sendEmail } from "@/lib/email";
import {
  GRACE_DAYS,
  daysUntilExpiry,
  daysUntilPause,
  planState,
  pricesFor,
} from "@/lib/plans";
import { getPlatformConfig } from "@/lib/platform";
import { recordPlatformEvent } from "@/lib/platform-events";
import { reportError } from "@/lib/report-error";
import { publicSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanNoticeKind } from "@/types/database";

/** Con cuántos días de anticipación se avisa que termina la prueba o el plan. */
const ENDING_NOTICE_DAYS = 3;
/** Con cuántos días de anticipación se avisa que la tienda se pausa. */
const PAUSE_SOON_DAYS = 2;
/** Hasta cuándo se mira para atrás: una pausa vieja ya se avisó o ya no importa. */
const LOOKBACK_DAYS = 30;
const DAY_MS = 86_400_000;

const PAUSE_DATE = new Intl.DateTimeFormat("es-VE", {
  day: "numeric",
  month: "long",
  timeZone: "America/Caracas",
});

/**
 * Los correos de vencimiento de las tiendas nuevas (las fundadoras caen a
 * Gratis y no los necesitan). Corre una vez al día desde /api/cron/resumen.
 *
 * Cada tienda recibe a lo sumo un aviso por etapa y por vencimiento:
 *   ending      → faltan 3 días o menos para que termine la prueba o el plan
 *   grace       → venció; sigue andando GRACE_DAYS días
 *   pause_soon  → se pausa en 2 días o menos
 *   paused      → ya está en pausa (además, aviso a los socios por Telegram)
 *
 * El aviso se anota en `plan_notices` ANTES de mandar el correo: si el cron
 * corre dos veces, el segundo choca con la clave y no repite. Si el correo no
 * sale, se borra la fila para que lo intente mañana.
 *
 * Devuelve cuántos correos salieron.
 */
export async function sendPlanNotices(): Promise<number> {
  const db = createAdminClient();
  const now = Date.now();

  const { data: stores, error } = await db
    .from("stores")
    .select(
      "id, name, plan, plan_expires_at, plan_source, founder, stripe_subscription_status, paypal_subscription_status",
    )
    .eq("founder", false)
    .eq("active", true)
    .eq("plan", "pro")
    .gte("plan_expires_at", new Date(now - LOOKBACK_DAYS * DAY_MS).toISOString())
    .lte("plan_expires_at", new Date(now + ENDING_NOTICE_DAYS * DAY_MS).toISOString());
  // Sin la migración 0037 no hay columna `founder`: no hay tiendas nuevas.
  if (error || !stores?.length) return 0;

  const { prices: listPrices } = await getPlatformConfig();
  const planUrl = `${publicSiteUrl()}/panel/plan`;
  let sent = 0;

  for (const s of stores) {
    const expiresAt = s.plan_expires_at;
    if (!expiresAt) continue;

    const state = planState(s);
    let kind: PlanNoticeKind | null = null;
    let days = 0;
    if (state === "pro") {
      // Con cobro automático el vencimiento se corre solo: avisar sería ruido.
      const autoRenew =
        s.stripe_subscription_status === "active" ||
        s.paypal_subscription_status === "active";
      days = daysUntilExpiry(s) ?? Infinity;
      if (!autoRenew && days <= ENDING_NOTICE_DAYS) kind = "ending";
    } else if (state === "grace") {
      days = daysUntilPause(s) ?? 0;
      kind = days <= PAUSE_SOON_DAYS ? "pause_soon" : "grace";
    } else if (state === "paused") {
      kind = "paused";
    }
    if (!kind) continue;

    const { error: claimErr } = await db
      .from("plan_notices")
      .insert({ store_id: s.id, kind, plan_expires_at: expiresAt });
    // 23505: este aviso ya salió. Cualquier otro error (la tabla no existe),
    // tampoco se manda: sin poder anotarlo, saldría todos los días.
    if (claimErr) continue;

    const pauseAt = new Date(new Date(expiresAt).getTime() + GRACE_DAYS * DAY_MS);

    if (kind === "paused") {
      await recordPlatformEvent({
        type: "plan.paused",
        storeId: s.id,
        title: `En pausa: ${s.name}`,
        detail: "Pasó la gracia sin renovar. Sus clientes ya no pueden comprar.",
        url: `/super/tiendas/${s.id}`,
        dedupeKey: `paused:${s.id}:${expiresAt}`,
      });
    }

    const { data: owner } = await db
      .from("users")
      .select("email, full_name")
      .eq("store_id", s.id)
      .eq("role", "store_owner")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    let ok = false;
    if (owner?.email) {
      const email = planNoticeEmail({
        kind,
        ownerName: owner.full_name,
        storeName: s.name,
        trial: s.plan_source === "comp",
        days,
        pauseDate: PAUSE_DATE.format(pauseAt),
        monthlyPrice: pricesFor(s, listPrices).monthly,
        planUrl,
      });
      ok = await sendEmail({ to: owner.email, ...email });
    }

    if (ok) {
      sent += 1;
    } else {
      await db
        .from("plan_notices")
        .delete()
        .eq("store_id", s.id)
        .eq("kind", kind)
        .eq("plan_expires_at", expiresAt);
      if (owner?.email) {
        reportError("plan-notices:email", new Error("no salió el correo"), {
          storeId: s.id,
          kind,
        });
      }
    }
  }

  return sent;
}
