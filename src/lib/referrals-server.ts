import "server-only";

import { sendEmail, referralRewardEmail } from "@/lib/email";
import { extendExpiry } from "@/lib/plans";
import {
  QUALIFY_MIN_ORDERS,
  QUALIFY_MIN_PRODUCTS,
  REFERRAL_REWARD_MONTHS,
  REWARD_CAP_PER_30D,
  REWARD_CAP_WINDOW_DAYS,
  normalizeReferralCode,
} from "@/lib/referrals";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ejecución del programa de referidos. Todo con service role, porque `referrals`
 * no tiene policy de escritura para tenants a propósito.
 *
 * Regla que atraviesa el archivo: NADA de esto puede tumbar la operación que lo
 * llama. Si el programa de referidos falla, el registro se completa igual y el
 * pedido se confirma igual. Por eso todas las entradas públicas atrapan sus
 * propios errores.
 */

interface AttachParams {
  referredStoreId: string;
  /** Email del dueño de la tienda nueva, para frenar el auto-referido. */
  referredEmail: string;
  /** El código tal cual vino de la cookie o del formulario. */
  code: string | null | undefined;
  signupIp?: string | null;
}

/**
 * Registra que a esta tienda la trajo alguien. Se llama al final del registro.
 * No acredita nada: el premio depende de que la tienda referida se active.
 */
export async function attachReferral(p: AttachParams): Promise<void> {
  try {
    const code = normalizeReferralCode(p.code);
    if (!code) return;

    const db = createAdminClient();

    const { data: referrer } = await db
      .from("stores")
      .select("id, name")
      .eq("referral_code", code)
      .maybeSingle();
    if (!referrer) return;

    // Referirse a sí mismo. El CHECK de la tabla también lo frena, pero aquí el
    // caso se descarta sin generar un error en los logs.
    if (referrer.id === p.referredStoreId) return;

    // Misma persona con dos tiendas: el dueño del código no puede cobrarse por
    // registrar otra tienda suya con el mismo email.
    const { data: referrerOwner } = await db
      .from("users")
      .select("email")
      .eq("store_id", referrer.id)
      .eq("role", "store_owner")
      .maybeSingle();
    if (
      referrerOwner?.email &&
      referrerOwner.email.toLowerCase() === p.referredEmail.toLowerCase()
    ) {
      return;
    }

    // Si ya existía una fila para esta tienda, el UNIQUE la rechaza y listo:
    // una tienda se refiere una sola vez en su vida.
    await db.from("referrals").insert({
      referrer_store_id: referrer.id,
      referred_store_id: p.referredStoreId,
      code_used: code,
      status: "pending",
      reward_months: REFERRAL_REWARD_MONTHS,
      signup_ip: p.signupIp ?? null,
    });
  } catch {
    // Un referido perdido no vale romperle el registro a un comerciante nuevo.
  }
}

/**
 * ¿La tienda referida ya se activó? Si sí, acredita el mes (o lo manda a la
 * cola de revisión si el referidor pasó el tope).
 *
 * Se llama cada vez que una tienda confirma un pedido, así que tiene que ser
 * barato y idempotente: sale en la primera consulta si no hay referido
 * pendiente, y el premio se reclama con un UPDATE condicional que solo una
 * ejecución puede ganar.
 */
export async function maybeQualifyReferral(referredStoreId: string): Promise<void> {
  try {
    const db = createAdminClient();

    const { data: referral } = await db
      .from("referrals")
      .select("id, referrer_store_id, reward_months")
      .eq("referred_store_id", referredStoreId)
      .eq("status", "pending")
      .maybeSingle();
    if (!referral) return;

    const { count: products } = await db
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", referredStoreId)
      .eq("status", "active");
    if ((products ?? 0) < QUALIFY_MIN_PRODUCTS) return;

    // `confirmed_at` y no `status`: un pedido que ya avanzó a "entregado" sigue
    // contando, y uno cancelado después de confirmarse no.
    const { count: orders } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", referredStoreId)
      .not("confirmed_at", "is", null)
      .neq("status", "cancelled");
    if ((orders ?? 0) < QUALIFY_MIN_ORDERS) return;

    const now = new Date().toISOString();

    // ¿El referidor ya se pasó del tope en la ventana móvil?
    const windowStart = new Date(
      Date.now() - REWARD_CAP_WINDOW_DAYS * 24 * 3600_000,
    ).toISOString();
    const { count: recent } = await db
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_store_id", referral.referrer_store_id)
      .eq("status", "rewarded")
      .gte("rewarded_at", windowStart);

    if ((recent ?? 0) >= REWARD_CAP_PER_30D) {
      await db
        .from("referrals")
        .update({
          status: "qualified",
          qualified_at: now,
          note: `Superó el tope de ${REWARD_CAP_PER_30D} referidos en ${REWARD_CAP_WINDOW_DAYS} días. Requiere aprobación manual.`,
        })
        .eq("id", referral.id)
        .eq("status", "pending");
      return;
    }

    await grantReferralReward(referral.id, now);
  } catch {
    // Confirmar el pedido es lo importante; el referido se reevalúa en el próximo.
  }
}

/**
 * Acredita el premio de un referido y le suma los meses a quien refirió.
 *
 * Primero RECLAMA la fila con un UPDATE condicional. Si otra ejecución ya se la
 * llevó, el update no toca nada y salimos — es lo que evita acreditar dos veces
 * el mismo referido cuando llegan dos pedidos casi juntos.
 *
 * Devuelve false si no había nada que acreditar.
 */
export async function grantReferralReward(
  referralId: string,
  atIso = new Date().toISOString(),
): Promise<boolean> {
  const db = createAdminClient();

  const { data: claimed } = await db
    .from("referrals")
    .update({ status: "rewarded", qualified_at: atIso, rewarded_at: atIso })
    .eq("id", referralId)
    .in("status", ["pending", "qualified"])
    .select("id, referrer_store_id, referred_store_id, reward_months")
    .maybeSingle();
  if (!claimed) return false;

  const { data: referrer } = await db
    .from("stores")
    .select("id, name, plan, plan_expires_at, plan_source, plan_note")
    .eq("id", claimed.referrer_store_id)
    .maybeSingle();
  if (!referrer) return false;

  const { data: referred } = await db
    .from("stores")
    .select("name")
    .eq("id", claimed.referred_store_id)
    .maybeSingle();

  const referredName = referred?.name ?? "una tienda";

  /**
   * Pro sin vencimiento = cortesía de por vida (ver migración 0016). A estas
   * tiendas NO se les toca el plan: `extendExpiry(null, 1)` devuelve hoy + 1
   * mes, así que "premiarlas" les convertiría el Pro vitalicio en uno que vence
   * en 30 días. El referido se acredita igual, pero no hay nada que estirar.
   */
  const lifetime = referrer.plan === "pro" && !referrer.plan_expires_at;

  const note = lifetime
    ? `Refirió a ${referredName} (Pro de por vida: sin meses que sumar)`
    : `+${claimed.reward_months} mes por referir a ${referredName}`;

  await db
    .from("stores")
    .update({
      plan: "pro",
      ...(lifetime
        ? {}
        : {
            plan_expires_at: extendExpiry(
              referrer.plan_expires_at,
              claimed.reward_months,
            ),
            // Quien pagó sigue figurando como 'paid': el premio le estira el
            // vencimiento, no le cambia de dónde salió el plan.
            plan_source: referrer.plan_source === "paid" ? "paid" : "comp",
          }),
      plan_note: appendNote(referrer.plan_note, note),
    })
    .eq("id", referrer.id);

  await notifyReferrer({
    storeId: referrer.id,
    storeName: referrer.name,
    referredName: referred?.name ?? null,
    months: claimed.reward_months,
    lifetime,
  });
  return true;
}

/** Marca un referido como no válido (solo desde /super). */
export async function rejectReferral(
  referralId: string,
  reason: string,
): Promise<boolean> {
  const db = createAdminClient();
  const { data } = await db
    .from("referrals")
    .update({ status: "rejected", note: reason.trim() || null })
    .eq("id", referralId)
    .in("status", ["pending", "qualified"])
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

/** Historial corto y acotado: `plan_note` es para leer de un vistazo. */
function appendNote(current: string | null, addition: string): string {
  const next = current ? `${current} · ${addition}` : addition;
  return next.length <= 500 ? next : next.slice(next.length - 500);
}

/** Avisa al que refirió que ya tiene su mes. Nunca tira. */
async function notifyReferrer(p: {
  storeId: string;
  storeName: string;
  referredName: string | null;
  months: number;
  lifetime: boolean;
}): Promise<void> {
  try {
    const db = createAdminClient();
    const { data: owner } = await db
      .from("users")
      .select("email, full_name")
      .eq("store_id", p.storeId)
      .eq("role", "store_owner")
      .maybeSingle();
    if (!owner?.email) return;

    const { subject, html } = referralRewardEmail({
      ownerName: owner.full_name,
      storeName: p.storeName,
      referredName: p.referredName,
      months: p.months,
      lifetime: p.lifetime,
    });
    await sendEmail({ to: owner.email, subject, html });
  } catch {
    /* el premio ya está acreditado; el correo es un extra */
  }
}
