import { NextResponse, type NextRequest } from "next/server";

import { formatUSD } from "@/lib/format";
import { recordPlatformEvent } from "@/lib/platform-events";
import { daysUntilExpiry, isPro } from "@/lib/plans";
import { publicSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { planBadge } from "@/lib/super-format";
import { segmentsOf } from "@/lib/super-segments";
import { getStoreStats, getSuperOverview } from "@/lib/super-stats";
import { escapeTelegramHtml, sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/** Con cuántos días de anticipación se avisa que vence un plan que no se renueva solo. */
const EXPIRING_ALERT_DAYS = 3;
const DAY_MS = 86_400_000;

const TODAY = new Intl.DateTimeFormat("es-VE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Caracas",
});

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Cron diario (8:05 AM Venezuela, después del de la tasa BCV). Hace dos cosas:
 *
 *  1. Avisa de cada plan Pro que vence en los próximos días y no se renueva
 *     solo: es el momento de escribirle al comerciante, no cuando ya cayó a
 *     Gratis. El `dedupeKey` lleva la fecha de vencimiento, así el mismo aviso
 *     no se repite mañana, pero sí vuelve si renueva y otra vez está por vencer.
 *  2. Manda al grupo de Telegram el resumen de las últimas 24 horas.
 *
 * Protegido con CRON_SECRET, igual que /api/cron/bcv.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const db = createAdminClient();
  const now = new Date();
  const dayAgo = now.getTime() - DAY_MS;

  const [overview, { stores, complete }, { count: referrals }, { count: feedback }] =
    await Promise.all([
      getSuperOverview(1),
      getStoreStats(),
      db
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("status", "qualified"),
      db
        .from("feedback")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
    ]);

  // ── 1. Planes por vencer ──────────────────────────────────────────────────
  let expiringAlerts = 0;
  for (const s of stores) {
    if (!isPro(s)) continue;
    const autoRenew =
      s.stripe_subscription_status === "active" ||
      s.paypal_subscription_status === "active";
    const days = daysUntilExpiry(s);
    if (autoRenew || days === null || days > EXPIRING_ALERT_DAYS) continue;
    const plan = planBadge(s, now);
    await recordPlatformEvent({
      type: "plan.expiring",
      storeId: s.id,
      title: `Por vencer: ${s.name}`,
      detail: [`${plan.label} · ${plan.sub}`, s.owner_name, s.whatsapp]
        .filter(Boolean)
        .join(" · "),
      url: `/super/tiendas/${s.id}`,
      dedupeKey: `expiring:${s.id}:${s.plan_expires_at}`,
    });
    expiringAlerts += 1;
  }

  // ── 2. Resumen ────────────────────────────────────────────────────────────
  const recent = (iso: string | null) => iso !== null && Date.parse(iso) >= dayAgo;
  const newStores = stores.filter((s) => recent(s.created_at));
  const firstSales = stores.filter((s) => recent(s.first_sale_at));

  let expiring = 0;
  let failed = 0;
  let dormantPro = 0;
  for (const s of stores) {
    const seg = segmentsOf(s, now.getTime());
    if (seg.includes("expiring")) expiring += 1;
    if (seg.includes("failed")) failed += 1;
    if (complete && isPro(s) && seg.includes("dormant")) dormantPro += 1;
  }

  const names = (list: typeof stores) =>
    escapeTelegramHtml(
      list.length > 3
        ? `${list
            .slice(0, 3)
            .map((s) => s.name)
            .join(", ")} y ${list.length - 3} más`
        : list.map((s) => s.name).join(", "),
    );

  const lines: string[] = [`☀️ <b>Resumen de Tiendify</b> · ${TODAY.format(now)}`, ""];

  lines.push("<b>Últimas 24 horas</b>");
  if (overview) {
    const net = overview.collected - overview.fees;
    lines.push(
      overview.collected > 0
        ? `Cobrado: ${formatUSD(overview.collected)}${
            overview.fees > 0 ? ` (neto ${formatUSD(net)})` : ""
          }`
        : "Cobrado: nada",
    );
    lines.push(`Vendido por las tiendas: ${formatUSD(overview.gmv)}`);
  }
  lines.push(
    newStores.length > 0
      ? `Tiendas nuevas: ${newStores.length} (${names(newStores)})`
      : "Tiendas nuevas: ninguna",
  );
  if (firstSales.length > 0) {
    lines.push(`Primera venta: ${names(firstSales)}`);
  }

  const todo: string[] = [];
  if (overview && overview.pendingSubs > 0) {
    todo.push(
      `${plural(overview.pendingSubs, "comprobante", "comprobantes")} por aprobar (${formatUSD(overview.pendingSubsUsd)})`,
    );
  }
  if (overview && overview.owed > 0) {
    todo.push(
      `${formatUSD(overview.owed)} por pagar a ${plural(overview.owedStores, "tienda", "tiendas")}`,
    );
  }
  if (referrals) todo.push(`${plural(referrals, "referido", "referidos")} por decidir`);
  if (feedback) todo.push(`${plural(feedback, "comentario", "comentarios")} sin leer`);
  lines.push("", "<b>Por hacer</b>", ...(todo.length > 0 ? todo : ["Nada, todo al día"]));

  const risk: string[] = [];
  if (expiring > 0) risk.push(`${expiring} vencen esta semana`);
  if (failed > 0) risk.push(plural(failed, "cobro fallido", "cobros fallidos"));
  if (dormantPro > 0) risk.push(`${dormantPro} Pro sin actividad`);
  if (risk.length > 0) lines.push("", "<b>En riesgo</b>", risk.join(" · "));

  if (overview) {
    lines.push(
      "",
      `MRR ${formatUSD(overview.mrr)} · ${plural(overview.paying, "tienda paga", "tiendas pagan")} · ${plural(overview.stores, "tienda", "tiendas")} en total`,
    );
  }
  lines.push(`<a href="${publicSiteUrl()}/super">Abrir el panel</a>`);

  const summarySent = await sendTelegram(lines.join("\n"));

  return NextResponse.json({ ok: true, expiringAlerts, summarySent });
}
