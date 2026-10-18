"use server";

import { z } from "zod";

import { getSessionContext } from "@/lib/auth";
import { pushConfigured, sendPushToEndpoint } from "@/lib/push";
import { reportError } from "@/lib/report-error";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PushActionResult {
  ok: boolean;
  error?: string;
}

// Las direcciones vienen de los servidores de push de los navegadores
// (Google, Apple, Mozilla, Microsoft), siempre https.
const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({
    p256dh: z.string().min(10).max(200),
    auth: z.string().min(4).max(100),
  }),
});

/** Guarda el teléfono que acaba de aceptar los avisos. */
export async function savePushSubscription(
  input: unknown,
  userAgent?: string,
): Promise<PushActionResult> {
  if (!pushConfigured()) return { ok: false, error: "Los avisos no están disponibles todavía." };
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "El navegador no entregó una suscripción válida." };

  const ctx = await getSessionContext();
  if (!ctx?.store) return { ok: false, error: "No autorizado" };

  // Con service role: la tabla no tiene policies para tenants (ver 0034). El
  // endpoint es único; si el mismo teléfono ya estaba (de esta u otra cuenta),
  // queda con la tienda de quien lo activó ahora.
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      {
        store_id: ctx.store.id,
        user_id: ctx.user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        user_agent: userAgent?.slice(0, 300) ?? null,
      },
      { onConflict: "endpoint" },
    );
  if (error) {
    reportError("savePushSubscription", new Error(error.message), { storeId: ctx.store.id });
    return { ok: false, error: "No pudimos activar los avisos. Intenta de nuevo." };
  }
  return { ok: true };
}

/** Deja de mandar avisos a este teléfono. */
export async function removePushSubscription(endpoint: string): Promise<PushActionResult> {
  const ctx = await getSessionContext();
  if (!ctx?.store) return { ok: false, error: "No autorizado" };
  if (typeof endpoint !== "string" || !endpoint) return { ok: true };

  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .delete()
    .eq("store_id", ctx.store.id)
    .eq("endpoint", endpoint);
  if (error) return { ok: false, error: "No pudimos desactivar los avisos. Intenta de nuevo." };
  return { ok: true };
}

/** Manda un aviso de prueba a este teléfono, para que vea cómo llega. */
export async function sendTestPush(endpoint: string): Promise<PushActionResult> {
  const ctx = await getSessionContext();
  if (!ctx?.store) return { ok: false, error: "No autorizado" };
  if (typeof endpoint !== "string" || !endpoint) return { ok: false, error: "Activa los avisos primero." };

  const ok = await sendPushToEndpoint(ctx.store.id, endpoint, {
    title: "Así te va a llegar cada pedido 🛍️",
    body: `Avisos activos para ${ctx.store.name}. Cuando entre un pedido, suena aquí.`,
    url: "/panel/pedidos",
    tag: "prueba",
  });
  return ok
    ? { ok: true }
    : { ok: false, error: "No pudimos mandar la prueba. Desactiva y vuelve a activar los avisos." };
}
