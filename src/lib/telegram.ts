import "server-only";

/**
 * Avisos al grupo de Telegram de Tiendify.
 *
 * Es el canal interno de los dueños de la plataforma: un grupo con los socios
 * y un bot que escribe ahí cada cosa que pasa. Se eligió Telegram y no
 * WhatsApp porque acá el texto es libre: la Cloud API de WhatsApp exige una
 * plantilla aprobada por Meta para cada tipo de mensaje (ver
 * whatsapp-cloud.ts), y con veinte tipos de evento eso no se sostiene.
 *
 * Variables de entorno:
 *   TELEGRAM_BOT_TOKEN   — el token que da @BotFather al crear el bot
 *   TELEGRAM_CHAT_ID     — el id del grupo (un número negativo)
 *
 * Sin ellas no hace nada y devuelve false, igual que `sendEmail` sin
 * RESEND_API_KEY: un aviso que no sale nunca puede tumbar un pago.
 */

interface TelegramCreds {
  token: string;
  chatId: string;
}

function creds(): TelegramCreds | null {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID ?? "").trim();
  if (!token || !chatId) return null;
  return { token, chatId };
}

export function telegramConfigured(): boolean {
  return creds() !== null;
}

/** El texto de un evento puede traer `<` o `&` (el nombre de una tienda). */
export function escapeTelegramHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Manda un mensaje al grupo. `html` usa el subconjunto de HTML de Telegram
 * (<b>, <i>, <a>); lo que venga de afuera tiene que pasar antes por
 * `escapeTelegramHtml`.
 *
 * Nunca lanza, y no espera más de unos segundos: esto corre adentro de un
 * webhook de pago o del registro de una tienda.
 */
export async function sendTelegram(html: string): Promise<boolean> {
  const c = creds();
  if (!c) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${c.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: c.chatId,
        text: html,
        parse_mode: "HTML",
        // Sin la tarjeta de vista previa del enlace: cada aviso ocuparía media
        // pantalla del grupo.
        link_preview_options: { is_disabled: true },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[telegram] envío falló (${res.status}): ${body.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[telegram] la petición reventó: ${String(err)}`);
    return false;
  }
}
