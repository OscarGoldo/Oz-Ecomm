import "server-only";

/**
 * Aviso al comerciante por WhatsApp cuando entra un pedido.
 *
 * Por qué existe: hasta ahora el único aviso inmediato dependía de que el
 * CLIENTE tocara "Avisar a la tienda por WhatsApp" en la página de
 * confirmación. Si no lo tocaba, al comerciante le quedaba un correo — y acá
 * nadie mira el correo. Un pedido que se ve tres horas tarde es un pedido que
 * muchas veces ya se perdió.
 *
 * ── Lo que hay que saber antes de tocar esto ────────────────────────────────
 *
 * Meta NO deja mandar texto libre a alguien que no te escribió en las últimas
 * 24 horas. Un aviso iniciado por el negocio tiene que ir como PLANTILLA
 * aprobada. Por eso acá no se arma un mensaje: se manda el nombre de una
 * plantilla y sus parámetros, en orden.
 *
 * La plantilla hay que crearla en Meta Business Manager con exactamente tres
 * variables, por ejemplo:
 *
 *   "Nuevo pedido #{{1}} en {{2}} por {{3}}. Míralo en tu panel."
 *
 * y configurar:
 *   WHATSAPP_TOKEN             — token permanente de la app de Meta
 *   WHATSAPP_PHONE_NUMBER_ID   — id del número emisor (no el número)
 *   WHATSAPP_ORDER_TEMPLATE    — nombre de la plantilla aprobada
 *   WHATSAPP_TEMPLATE_LANG     — código de idioma, por defecto es_ES
 *
 * Sin esas variables la función no hace nada y devuelve false, igual que
 * `sendEmail` cuando falta RESEND_API_KEY: una integración a medias nunca
 * puede tumbar un pedido que ya se cobró.
 */

const GRAPH_VERSION = "v21.0";

interface CloudCreds {
  token: string;
  phoneNumberId: string;
  template: string;
  lang: string;
}

function creds(): CloudCreds | null {
  const token = (process.env.WHATSAPP_TOKEN ?? "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID ?? "").trim();
  const template = (process.env.WHATSAPP_ORDER_TEMPLATE ?? "").trim();
  if (!token || !phoneNumberId || !template) return null;
  return {
    token,
    phoneNumberId,
    template,
    lang: (process.env.WHATSAPP_TEMPLATE_LANG ?? "es_ES").trim(),
  };
}

/** ¿Está configurado el aviso por WhatsApp? */
export function whatsappCloudEnabled(): boolean {
  return creds() !== null;
}

/**
 * Normaliza a E.164 sin el `+`, que es lo que espera la Cloud API.
 * Mismo criterio que `whatsappUrl`: un 0 inicial es formato local venezolano.
 */
function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `58${digits.slice(1)}`;
  // Un número sin código de país no se puede mandar: mejor no intentarlo que
  // escribirle a un desconocido.
  return digits.length >= 11 ? digits : null;
}

export interface NewOrderNotice {
  /** WhatsApp del comerciante, como lo cargó en su panel. */
  toPhone: string | null | undefined;
  storeName: string;
  orderNumber: number;
  /** Ya formateado, ej. "$45,00". */
  totalLabel: string;
}

/**
 * Avisa al comerciante que entró un pedido. Nunca lanza: un aviso que falla no
 * puede afectar al pedido.
 */
export async function notifyOwnerNewOrder(
  notice: NewOrderNotice,
): Promise<boolean> {
  const c = creds();
  if (!c) return false;

  const to = toE164(notice.toPhone);
  if (!to) return false;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${c.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: c.template,
            language: { code: c.lang },
            components: [
              {
                type: "body",
                // El ORDEN importa: {{1}} número, {{2}} tienda, {{3}} total.
                parameters: [
                  { type: "text", text: String(notice.orderNumber) },
                  { type: "text", text: notice.storeName },
                  { type: "text", text: notice.totalLabel },
                ],
              },
            ],
          },
        }),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        `[whatsapp] envío falló (${res.status}): ${body.slice(0, 300)}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[whatsapp] la petición reventó: ${String(err)}`);
    return false;
  }
}
