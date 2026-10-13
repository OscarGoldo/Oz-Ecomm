"use server";

import { z } from "zod";

import { getSessionContext } from "@/lib/auth";
import { feedbackEmail, sendEmail } from "@/lib/email";
import { reportError } from "@/lib/report-error";
import { publicSiteUrl } from "@/lib/site-url";
import { feedbackKindLabel } from "@/lib/support";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Comentarios que una tienda puede mandar por hora, contra el envío repetido. */
const HOURLY_LIMIT = 10;

const schema = z.object({
  kind: z.enum(["problem", "idea", "other"]),
  message: z
    .string()
    .trim()
    .min(5, "Cuéntanos un poco más")
    .max(4000, "El mensaje es muy largo"),
});

export type FeedbackInput = z.input<typeof schema>;

/**
 * El comerciante le escribe a Tiendify desde su panel.
 *
 * Hace dos cosas, y con una que salga bien alcanza: guarda el comentario para
 * la bandeja de /super/comentarios, y lo manda por correo a los super admin.
 * Van las dos porque fallan por motivos distintos (la tabla puede no existir
 * todavía, el correo puede no estar configurado), y un comentario que el
 * comerciante cree enviado y nadie recibió es peor que no tener el botón.
 */
export async function sendFeedback(input: FeedbackInput): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  const ctx = await getSessionContext();
  if (!ctx?.store) return { ok: false, error: "No autorizado" };
  const { user, store } = ctx;

  const db = createAdminClient();

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count: recent } = await db
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)
    .gte("created_at", hourAgo);
  if ((recent ?? 0) >= HOURLY_LIMIT) {
    return {
      ok: false,
      error: "Ya nos escribiste varias veces en esta hora. Danos un rato para leerte.",
    };
  }

  const { error: saveErr } = await db.from("feedback").insert({
    store_id: store.id,
    user_id: user.id,
    kind: d.kind,
    message: d.message,
  });

  const { data: admins } = await db
    .from("users")
    .select("email")
    .eq("role", "super_admin")
    .eq("active", true);
  const to = (admins ?? []).map((a) => a.email).filter(Boolean);

  const emailed =
    to.length > 0 &&
    (await sendEmail({
      to,
      replyTo: user.email,
      ...feedbackEmail({
        storeName: store.name,
        kindLabel: feedbackKindLabel(d.kind),
        message: d.message,
        ownerName: user.full_name,
        ownerEmail: user.email,
        whatsapp: store.whatsapp,
        inboxUrl: `${publicSiteUrl()}/super/comentarios`,
      }),
    }));

  if (saveErr) {
    // Con el correo entregado el comentario llegó, pero la bandeja está rota y
    // conviene enterarse igual.
    const { ref } = reportError("sendFeedback", new Error(saveErr.message), {
      storeId: store.id,
      emailed,
    });
    if (!emailed) {
      return {
        ok: false,
        error: `No pudimos enviar tu mensaje. Intenta de nuevo (código ${ref}).`,
      };
    }
  }

  return { ok: true };
}
