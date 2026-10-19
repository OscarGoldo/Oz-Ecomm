"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  cancelProStripeSubscription,
  cancelProSubscription,
} from "@/app/(admin)/panel/plan/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { getCachedBcvRates } from "@/lib/bcv";
import {
  autoRate,
  MARGIN_MAX,
  MARGIN_MIN,
  type RateSettings,
} from "@/lib/exchange-rate";
import { getUsdtRate } from "@/lib/usdt";
import { recordPlatformEvent } from "@/lib/platform-events";
import { storeClosedByOwner } from "@/lib/store-status";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function requireStoreId(): Promise<string> {
  const ctx = await getSessionContext();
  if (!ctx?.store) throw new Error("No autorizado");
  return ctx.store.id;
}

const optStr = z.string().trim().optional().nullable();

const storeSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto"),
  description: optStr,
  primary_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido (#RRGGBB)")
    .default("#0EA5E9"),
  logo_url: optStr,
  banner_url: optStr,
  whatsapp: optStr,
  instagram: optStr,
  phone: optStr,
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  address: optStr,
  show_bs_prices: z.boolean().default(true),
  exchange_rate: z.coerce.number().positive("Tasa inválida").nullable().optional(),
  auto_exchange_rate: z.boolean().default(false),
  exchange_rate_source: z.enum(["bcv_usd", "bcv_eur", "usdt"]).default("bcv_usd"),
  exchange_rate_margin: z.coerce
    .number()
    .min(MARGIN_MIN, `El ajuste va de ${MARGIN_MIN} % a +${MARGIN_MAX} %`)
    .max(MARGIN_MAX, `El ajuste va de ${MARGIN_MIN} % a +${MARGIN_MAX} %`)
    .default(0),
});

export type StoreSettingsInput = z.input<typeof storeSchema>;

export interface StoreSettingsResult extends ActionResult {
  /** Se guardó, pero hay algo que el comerciante tiene que saber. */
  notice?: string;
}

/** La columna no existe todavía: la migración 0036 no corrió. */
function missingColumn(error: { code?: string } | null): boolean {
  return error?.code === "PGRST204" || error?.code === "42703";
}

/**
 * La tasa automática que le toca a la tienda ahora mismo, para no esperar al
 * cron: el comerciante elige "USDT − 2 %", guarda y ya ve el número.
 */
async function rateNow(settings: RateSettings): Promise<number | null> {
  const [bcv, usdt] = await Promise.all([
    getCachedBcvRates(),
    settings.source === "usdt" ? getUsdtRate() : Promise.resolve(null),
  ]);
  return autoRate(settings, {
    usd: bcv?.usd ?? null,
    eur: bcv?.eur ?? null,
    usdt: usdt?.rate ?? null,
  });
}

export async function updateStoreSettings(
  input: StoreSettingsInput,
): Promise<StoreSettingsResult> {
  const parsed = storeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createClient();

  // El color vive en dos lugares: `primary_color` (esta pantalla, y lo que usa
  // el panel) y `customization.colors.primary` (Personalizar, y lo que usa la
  // tienda). `resolveTheme` prefiere el segundo, así que apenas el comerciante
  // tocaba Personalizar una vez, este campo dejaba de tener efecto sobre su
  // tienda para siempre: cambiaba el color, guardaba, abría su tienda y no veía
  // nada distinto. Guardar acá ahora escribe los dos.
  const { data: current } = await supabase
    .from("stores")
    .select("customization, exchange_rate, auto_exchange_rate, exchange_rate_updated_at")
    .eq("id", storeId)
    .maybeSingle();
  const customization = {
    ...((current?.customization as Record<string, unknown>) ?? {}),
    colors: {
      ...(((current?.customization as { colors?: Record<string, unknown> } | null)
        ?.colors) ?? {}),
      primary: d.primary_color,
    },
  };

  // La tasa. La automática se calcula ya; si su fuente no responde, la tienda
  // se queda con la que tenía y el cron la pone en la próxima pasada.
  const now = new Date().toISOString();
  const margin = Math.round(d.exchange_rate_margin * 100) / 100;
  const settings: RateSettings = {
    auto: d.auto_exchange_rate,
    source: d.exchange_rate_source,
    margin,
  };
  let rateFields: { exchange_rate?: number | null; exchange_rate_updated_at?: string | null } = {};
  let notice: string | undefined;
  if (settings.auto) {
    const rate = await rateNow(settings);
    if (rate != null) {
      rateFields = { exchange_rate: rate, exchange_rate_updated_at: now };
    } else {
      notice =
        settings.source === "usdt"
          ? "El precio del USDT no respondió ahora: tu tasa se pone sola en la próxima hora."
          : "La tasa del BCV no respondió ahora: tu tasa se pone sola en la próxima actualización.";
    }
  } else {
    const rate = d.exchange_rate ?? null;
    // Guardar el teléfono no puede hacer que una tasa de hace dos semanas
    // pase por "de hoy": la fecha solo cambia si cambia el número (o si
    // venía de la automática).
    const same =
      !current?.auto_exchange_rate &&
      rate != null &&
      current?.exchange_rate != null &&
      Number(current.exchange_rate) === rate;
    rateFields = {
      exchange_rate: rate,
      exchange_rate_updated_at:
        rate == null ? null : same ? (current?.exchange_rate_updated_at ?? now) : now,
    };
  }

  const fields = {
    name: d.name,
    description: d.description?.trim() ? d.description.trim() : null,
    primary_color: d.primary_color,
    customization,
    logo_url: d.logo_url || null,
    banner_url: d.banner_url || null,
    whatsapp: d.whatsapp?.trim() ? d.whatsapp.trim() : null,
    instagram: d.instagram?.trim() ? d.instagram.trim() : null,
    phone: d.phone?.trim() ? d.phone.trim() : null,
    email: d.email ? d.email : null,
    address: d.address?.trim() ? d.address.trim() : null,
    show_bs_prices: d.show_bs_prices,
    auto_exchange_rate: d.auto_exchange_rate,
    ...rateFields,
  };

  let { error } = await supabase
    .from("stores")
    .update({
      ...fields,
      exchange_rate_source: settings.source,
      exchange_rate_margin: settings.margin,
    })
    .eq("id", storeId);
  // Sin la migración 0036 las dos columnas no existen. Con dólar BCV sin
  // ajuste (lo único que había antes) se guarda igual; con otra tasa, no se
  // puede guardar sin mentir.
  if (missingColumn(error) && settings.source === "bcv_usd" && settings.margin === 0) {
    ({ error } = await supabase.from("stores").update(fields).eq("id", storeId));
  }

  if (error) return { ok: false, error: "No se pudieron guardar los cambios" };

  revalidatePath("/panel/configuracion");
  revalidatePath("/panel");
  return { ok: true, notice };
}

const deliverySchema = z.object({
  offers_delivery: z.boolean(),
  delivery_note: optStr,
  delivery_fee: z.coerce.number().min(0, "Monto inválido").default(0),
  free_delivery_min: z.coerce.number().min(0).nullable().optional(),
  offers_pickup: z.boolean(),
  pickup_address: optStr,
});

export type DeliverySettingsInput = z.input<typeof deliverySchema>;

export async function updateDeliverySettings(
  input: DeliverySettingsInput,
): Promise<ActionResult> {
  const parsed = deliverySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos" };
  }
  const d = parsed.data;

  if (!d.offers_delivery && !d.offers_pickup) {
    return { ok: false, error: "Activa al menos una opción de entrega" };
  }

  let storeId: string;
  try {
    storeId = await requireStoreId();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("stores")
    .update({
      offers_delivery: d.offers_delivery,
      delivery_note: d.delivery_note?.trim() ? d.delivery_note.trim() : null,
      delivery_fee: d.delivery_fee,
      free_delivery_min: d.free_delivery_min ?? null,
      offers_pickup: d.offers_pickup,
      pickup_address: d.pickup_address?.trim() ? d.pickup_address.trim() : null,
    })
    .eq("id", storeId);

  if (error) return { ok: false, error: "No se pudieron guardar los cambios" };

  revalidatePath("/panel/configuracion/entrega");
  return { ok: true };
}

// ── Cerrar la tienda ────────────────────────────────────────────────────────

/** Para comparar el nombre que escribe con el de la tienda sin ser quisquilloso. */
function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(a) === norm(b);
}

/** ¿Hay una suscripción que todavía puede cobrar? */
function billing(status: string | null): boolean {
  return status === "active" || status === "suspended";
}

/**
 * El dueño cierra su tienda: deja de estar en línea y se le deja de cobrar.
 *
 * No borra nada. Los pedidos, los productos y lo que la plataforma le debe por
 * ventas con tarjeta quedan en la base: borrarlos de un clic sería perder la
 * cuenta de plata que no es nuestra, y un cierre por error no tendría vuelta.
 * Por eso el mismo dueño puede reabrirla (ver `reopenStore`).
 *
 * El orden importa: primero se corta el cobro y recién después se cierra. Si
 * Stripe no confirma la cancelación, la tienda NO se cierra — una tienda
 * cerrada a la que le siguen debitando la tarjeta es el peor resultado posible.
 *
 * `active` y `subscription_status` están fuera del alcance del comerciante en
 * la base (migración 0021), así que esto escribe con service role.
 */
export async function closeStore(confirmName: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx?.store) return { ok: false, error: "No autorizado" };
  if (ctx.user.role !== "store_owner") {
    return { ok: false, error: "Solo el dueño de la tienda puede cerrarla" };
  }
  const store = ctx.store;

  // Escribir el nombre es el freno contra el clic distraído.
  if (!sameName(confirmName ?? "", store.name)) {
    return { ok: false, error: "El nombre no coincide con el de tu tienda" };
  }

  const failed = {
    ok: false,
    error:
      "No pudimos cancelar tu suscripción, así que no cerramos la tienda. Intenta de nuevo o escríbenos.",
  };
  if (store.stripe_subscription_id && billing(store.stripe_subscription_status)) {
    const res = await cancelProStripeSubscription();
    if (!res.ok) return failed;
  }
  if (store.paypal_subscription_id && billing(store.paypal_subscription_status)) {
    const res = await cancelProSubscription();
    if (!res.ok) return failed;
  }

  const { error } = await createAdminClient()
    .from("stores")
    .update({ active: false, subscription_status: "cancelled" })
    .eq("id", store.id);
  if (error) {
    return { ok: false, error: "No se pudo cerrar la tienda. Intenta de nuevo." };
  }

  await recordPlatformEvent({
    type: "store.closed",
    storeId: store.id,
    title: `Tienda cerrada por su dueño: ${store.name}`,
    detail: ctx.user.full_name,
    url: `/super/tiendas/${store.id}`,
  });

  revalidatePath("/panel", "layout");
  revalidatePath(`/${store.slug}`, "layout");
  return { ok: true };
}

/**
 * Reabre una tienda que cerró su propio dueño.
 *
 * Solo deshace ese cierre: una tienda que pausó el super admin se queda
 * pausada, porque `storeClosedByOwner` distingue los dos casos. La suscripción
 * no vuelve sola — se canceló al cerrar y hay que contratarla de nuevo.
 */
export async function reopenStore(): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx?.store) return { ok: false, error: "No autorizado" };
  if (ctx.user.role !== "store_owner") {
    return { ok: false, error: "Solo el dueño de la tienda puede reabrirla" };
  }
  if (!storeClosedByOwner(ctx.store)) {
    return { ok: false, error: "Tu tienda no está cerrada" };
  }

  const { error } = await createAdminClient()
    .from("stores")
    .update({ active: true, subscription_status: "active" })
    .eq("id", ctx.store.id);
  if (error) {
    return { ok: false, error: "No se pudo reabrir la tienda. Intenta de nuevo." };
  }

  revalidatePath("/panel", "layout");
  revalidatePath(`/${ctx.store.slug}`, "layout");
  return { ok: true };
}
