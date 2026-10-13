import "server-only";

import { PROMO_CODE_MIN, normalizePromoCode, promoState } from "@/lib/promo";
import { createAdminClient } from "@/lib/supabase/admin";

/** Lo que regala un código que hoy se puede usar. */
export interface PromoOffer {
  code: string;
  months: number;
}

/** Un cupo ya reclamado: hay que usarlo o devolverlo. */
export interface ClaimedPromo extends PromoOffer {
  id: string;
}

/**
 * ¿Ese código se puede usar ahora? Solo mira, no reclama nada.
 *
 * Es para decirle a quien llega por el link de la campaña qué le toca ANTES de
 * que llene el formulario. La respuesta puede quedar vieja entre que carga la
 * página y que envía, así que la que vale es la de `claimPromoCode`.
 *
 * Devuelve null si el código no existe, no se puede usar, o si la tabla todavía
 * no está creada (migración 0029 sin correr): en los tres casos no hay oferta.
 */
export async function lookupPromoCode(
  raw: string | null | undefined,
): Promise<PromoOffer | null> {
  const code = normalizePromoCode(raw);
  if (code.length < PROMO_CODE_MIN) return null;

  const { data } = await createAdminClient()
    .from("promo_codes")
    .select("code, months, max_uses, used_count, expires_at, active")
    .eq("code", code)
    .maybeSingle();
  if (!data || promoState(data) !== "active") return null;
  return { code: data.code, months: data.months };
}

/**
 * Reclama un cupo del código. null = no existe, está apagado, venció o se
 * agotó.
 *
 * El chequeo del límite y el incremento son una sola sentencia en la base
 * (`claim_promo_code`), así que si veinte personas envían a la vez un código
 * con diez cupos, exactamente diez reciben el cupo.
 *
 * Quien reclama se compromete a usarlo o a devolverlo con `releasePromoCode`.
 */
export async function claimPromoCode(
  raw: string | null | undefined,
): Promise<ClaimedPromo | null> {
  const code = normalizePromoCode(raw);
  if (code.length < PROMO_CODE_MIN) return null;

  const { data, error } = await createAdminClient().rpc("claim_promo_code", {
    p_code: code,
  });
  if (error || !data || data.length === 0) return null;
  return data[0]!;
}

/** Devuelve el cupo cuando la tienda no llegó a crearse. */
export async function releasePromoCode(id: string): Promise<void> {
  await createAdminClient().rpc("release_promo_code", { p_id: id });
}
