"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth";
import { PROMO_CODE_MIN, normalizePromoCode } from "@/lib/promo";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function isSuperAdmin(): Promise<boolean> {
  const ctx = await getSessionContext();
  return ctx?.user.role === "super_admin";
}

const schema = z.object({
  code: z
    .string()
    .transform(normalizePromoCode)
    .pipe(
      z
        .string()
        .min(
          PROMO_CODE_MIN,
          `El código necesita al menos ${PROMO_CODE_MIN} letras o números`,
        ),
    ),
  months: z
    .number("Pon cuántos meses regala")
    .int("Los meses van sin decimales")
    .min(1, "Tiene que regalar al menos 1 mes")
    .max(24, "Máximo 24 meses"),
  /** null = sin límite de cupos. */
  max_uses: z
    .number()
    .int("Los cupos van sin decimales")
    .min(1, "Los cupos tienen que ser 1 o más")
    .max(100_000)
    .nullable(),
  /** Último día en que se acepta, "AAAA-MM-DD". null = no vence. */
  expires_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .nullable(),
  note: z.string().trim().max(200).optional(),
});

export type PromoCodeInput = z.input<typeof schema>;

/**
 * Crea un código promocional.
 *
 * La fecha de vencimiento se guarda como el final de ese día en Venezuela
 * (UTC−4): "vence el 31" quiere decir que el 31 todavía sirve, y el público de
 * una campaña está allá aunque el servidor corra en UTC.
 */
export async function createPromoCode(
  input: PromoCodeInput,
): Promise<ActionResult> {
  if (!(await isSuperAdmin())) return { ok: false, error: "No autorizado" };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  const expiresAt = d.expires_on
    ? new Date(`${d.expires_on}T23:59:59-04:00`)
    : null;
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return { ok: false, error: "Esa fecha ya pasó" };
  }

  const { error } = await createAdminClient().from("promo_codes").insert({
    code: d.code,
    months: d.months,
    max_uses: d.max_uses,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    note: d.note || null,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `Ya existe un código ${d.code}` };
    }
    return {
      ok: false,
      error:
        "No se pudo crear el código. Si es la primera vez, falta correr la migración 0029 en Supabase.",
    };
  }

  revalidatePath("/super/codigos");
  return { ok: true };
}

/** Prende o apaga un código. Apagado deja de aceptarse; no borra quién lo usó. */
export async function setPromoCodeActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  if (!(await isSuperAdmin())) return { ok: false, error: "No autorizado" };

  const { error } = await createAdminClient()
    .from("promo_codes")
    .update({ active })
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar el código" };

  revalidatePath("/super/codigos");
  return { ok: true };
}
