"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { extendExpiry } from "@/lib/plans";
import { recordPlatformEvent } from "@/lib/platform-events";
import { monthsLabel } from "@/lib/promo";
import {
  claimPromoCode,
  releasePromoCode,
  type ClaimedPromo,
} from "@/lib/promo-server";
import { REFERRAL_COOKIE } from "@/lib/referrals";
import { attachReferral } from "@/lib/referrals-server";
import { reportError } from "@/lib/report-error";
import { isReservedSlug, slugify } from "@/lib/slug";

/** Best-effort client IP from the proxy headers (Vercel sets x-forwarded-for). */
function clientIp(): string {
  const h = headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Max store signups allowed from one IP per hour.
 *
 * Cuenta intentos, no tiendas creadas: un email repetido o un código mal
 * escrito también suman. Y en Venezuela las operadoras móviles ponen a muchos
 * clientes detrás de la misma IP pública, así que con 5 la gente que llegaba
 * junta por una campaña se bloqueaba entre sí.
 */
const PER_IP_HOURLY_LIMIT = 20;
/**
 * Global safety net: only trips on true mass abuse, not organic growth.
 *
 * Estaba en 60 y era demasiado bajo para una campaña: con un influencer la
 * primera hora puede pasar de 60 registros reales, y desde ahí cada persona
 * que llegaba por el anuncio veía "Estamos recibiendo muchos registros". El
 * freno real contra el abuso es el tope por IP de arriba.
 */
const GLOBAL_HOURLY_LIMIT = 500;

export interface SignupResult {
  ok: boolean;
  error?: string;
  /** El campo que causó el error, cuando es uno solo y se puede marcar. */
  field?: "promo";
  slug?: string;
  /** La sesión quedó abierta: el panel se abre directo, sin pasar por /login. */
  signedIn?: boolean;
  /** Meses de Pro gratis que le dio el código promocional, si usó uno. */
  promoMonths?: number;
}

const schema = z.object({
  store_name: z.string().trim().min(2, "El nombre de la tienda es muy corto"),
  owner_name: z.string().trim().min(2, "Ingresa tu nombre"),
  owner_email: z.string().trim().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  primary_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  // Obligatorio: es por donde le escriben sus clientes, y la única forma de
  // contactar al comerciante que no depende de que abra el correo. Llega del
  // PhoneInput como dígitos con el código de país ("584241234567").
  whatsapp: z
    .string({ error: "Ingresa tu WhatsApp" })
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(
      z
        .string()
        .min(1, "Ingresa tu WhatsApp")
        .regex(/^\d{8,15}$/, "Ese número de WhatsApp no parece válido"),
    ),
  /** Honeypot: hidden field humans never fill. */
  website: z.string().optional(),
  /** Timestamp of when the form was rendered (bot speed check). */
  form_ts: z.coerce.number().optional(),
  /** Código de referido de la URL; la cookie de /r/<codigo> tiene prioridad. */
  ref: z.string().trim().max(40).optional(),
  /** Código promocional de una campaña: meses de Pro gratis (ver lib/promo). */
  promo: z.string().trim().max(60).optional(),
});

export type SignupInput = z.input<typeof schema>;

/** Public self-service store creation (Shopify/Tiendanube style). */
export async function signUpStore(input: SignupInput): Promise<SignupResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  const db = createAdminClient();

  // ── Anti-spam guards ───────────────────────────────────────────────────────
  // Honeypot: bots fill hidden fields; humans never see it.
  if (d.website && d.website.trim() !== "") {
    return { ok: false, error: "No se pudo crear la tienda. Intenta de nuevo." };
  }
  // Bots submit instantly; a human takes at least a few seconds.
  if (!d.form_ts || Date.now() - d.form_ts < 3000) {
    return { ok: false, error: "Completa el formulario e intenta de nuevo." };
  }

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const ip = clientIp();

  // Per-IP cap: the real gate. Stops one actor mass-creating stores without
  // blocking legitimate growth from other users (unlike a single global cap).
  if (ip !== "unknown") {
    const { count: ipAttempts } = await db
      .from("signup_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", hourAgo);
    if ((ipAttempts ?? 0) >= PER_IP_HOURLY_LIMIT) {
      return {
        ok: false,
        error: "Alcanzaste el límite de tiendas por ahora. Intenta más tarde.",
      };
    }
  }

  // Global safety net: catches distributed floods; set high so organic surges
  // in real signups are never blocked.
  const { count: globalAttempts } = await db
    .from("stores")
    .select("id", { count: "exact", head: true })
    .gte("created_at", hourAgo);
  if ((globalAttempts ?? 0) >= GLOBAL_HOURLY_LIMIT) {
    return {
      ok: false,
      error: "Estamos recibiendo muchos registros. Intenta de nuevo en un rato.",
    };
  }

  // Record this attempt (per-IP counter). Fire-and-forget; never blocks signup.
  if (ip !== "unknown") {
    await db.from("signup_attempts").insert({ ip });
    // Opportunistic cleanup so the table stays small.
    const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
    await db.from("signup_attempts").delete().lt("created_at", dayAgo);
  }

  // Email must be free.
  const { data: existingUser } = await db
    .from("users")
    .select("id")
    .eq("email", d.owner_email)
    .maybeSingle();
  if (existingUser) {
    return {
      ok: false,
      error: "Ese email ya tiene una cuenta. Inicia sesión.",
    };
  }

  // Find a free slug (append a short suffix on collision).
  const base = slugify(d.store_name) || "tienda";
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (isReservedSlug(candidate)) continue;
    const { data: taken } = await db
      .from("stores")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!taken) {
      slug = candidate;
      break;
    }
    if (attempt === 4) {
      return { ok: false, error: "No se pudo generar un enlace único. Prueba otro nombre." };
    }
  }

  // ── Código promocional ─────────────────────────────────────────────────────
  // Se reclama el cupo ANTES de crear nada, y se devuelve en cada salida por
  // error de acá para abajo. Así quien llega tarde a "las primeras 10" se entera
  // antes de tener una tienda creada, y un registro que falla no le quema el
  // cupo a otro.
  let promo: ClaimedPromo | null = null;
  if (d.promo) {
    promo = await claimPromoCode(d.promo);
    if (!promo) {
      return {
        ok: false,
        field: "promo",
        error:
          "Ese código no es válido o ya se agotó. Bórralo y crea tu tienda gratis igual.",
      };
    }
  }

  // Create the store. Con código, nace en Pro por los meses que regala: es
  // cortesía ('comp'), no pago, así no infla el número de tiendas que pagan.
  const { data: store, error: storeErr } = await db
    .from("stores")
    .insert({
      slug,
      name: d.store_name,
      primary_color: d.primary_color ?? "#0EA5E9",
      whatsapp: d.whatsapp,
      active: true,
      ...(promo
        ? {
            plan: "pro" as const,
            plan_source: "comp" as const,
            plan_expires_at: extendExpiry(null, promo.months),
            plan_note: `Código ${promo.code}: ${monthsLabel(promo.months)} de Pro gratis`,
          }
        : {}),
    })
    .select("id")
    .single();
  if (storeErr || !store) {
    if (promo) await releasePromoCode(promo.id);
    return { ok: false, error: "No se pudo crear la tienda. Intenta de nuevo." };
  }

  // Create the owner auth user with their password.
  const created = await db.auth.admin.createUser({
    email: d.owner_email,
    password: d.password,
    email_confirm: true,
  });
  const userId = created.data.user?.id;
  if (!userId) {
    await db.from("stores").delete().eq("id", store.id);
    if (promo) await releasePromoCode(promo.id);
    return { ok: false, error: "No se pudo crear tu cuenta. ¿Ya estás registrado?" };
  }

  const { error: userErr } = await db.from("users").insert({
    id: userId,
    store_id: store.id,
    full_name: d.owner_name,
    email: d.owner_email,
    role: "store_owner",
    active: true,
  });
  if (userErr) {
    await db.auth.admin.deleteUser(userId);
    await db.from("stores").delete().eq("id", store.id);
    if (promo) await releasePromoCode(promo.id);
    return { ok: false, error: "No se pudo crear tu cuenta. Intenta de nuevo." };
  }

  // Quién usó el código, para verlo en /super/codigos. Si esto fallara, la
  // tienda ya tiene su Pro y el cupo ya está contado: solo faltaría el nombre
  // en la lista, y eso no justifica tumbar un registro que salió bien.
  if (promo) {
    const { error: redeemErr } = await db.from("promo_redemptions").insert({
      promo_code_id: promo.id,
      store_id: store.id,
      months: promo.months,
    });
    if (redeemErr) {
      reportError("signUpStore:promo-redemption", new Error(redeemErr.message), {
        storeId: store.id,
        code: promo.code,
      });
    }
  }

  // ¿Alguien la trajo? La cookie manda: la deja /r/<codigo> y sobrevive a que
  // el visitante dé vueltas por la landing antes de decidirse. El `ref` del
  // formulario es el respaldo para quien entra derecho a /crear-tienda?ref=…
  await attachReferral({
    referredStoreId: store.id,
    referredEmail: d.owner_email,
    code: cookies().get(REFERRAL_COOKIE)?.value ?? d.ref,
    signupIp: ip === "unknown" ? null : ip,
  });

  // Default cash payment method so checkout works immediately.
  await db.from("payment_methods").insert({
    store_id: store.id,
    type: "cash",
    label: "Efectivo",
    details: {},
    requires_proof: false,
    instructions: "Pagas al recibir o retirar el pedido.",
    display_order: 0,
  });

  await recordPlatformEvent({
    type: "store.created",
    storeId: store.id,
    title: `Tienda nueva: ${d.store_name}`,
    detail: [
      d.owner_name,
      d.owner_email,
      promo ? `código ${promo.code} (${monthsLabel(promo.months)} de Pro)` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    url: `/super/tiendas/${store.id}`,
  });

  // Dejarlo adentro. Antes la cuenta se creaba con la API admin y nadie iniciaba
  // sesión: al comerciante que acababa de registrarse se le pedía autenticarse
  // otra vez en /login, en el segundo de mayor intención que va a tener. Ahí se
  // perdía gente que ya había dicho que sí.
  // Si el login fallara, la tienda igual quedó creada: el formulario cae al
  // mensaje de "entra con tu email", que es el comportamiento viejo.
  let signedIn = false;
  try {
    const auth = createServerClient();
    const { error: signInErr } = await auth.auth.signInWithPassword({
      email: d.owner_email,
      password: d.password,
    });
    signedIn = !signInErr;
  } catch {
    // Queda en false y el cliente muestra el camino manual.
  }

  return { ok: true, slug, signedIn, promoMonths: promo?.months };
}
