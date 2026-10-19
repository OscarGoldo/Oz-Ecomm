import "server-only";

import { formatBs, formatUSD } from "@/lib/format";
import type { OrderMessageData } from "@/lib/order-messages";
import type { PlanNoticeKind } from "@/types/database";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Escapa texto antes de meterlo en el HTML del correo. Nombres de cliente y de
 * producto son texto libre — sin esto, un `<` en un nombre rompe el maquetado.
 */
function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  /** A quién le llega la respuesta si quien lo recibe toca "Responder". */
  replyTo?: string;
}

/**
 * Send a transactional email via Resend. No-op (returns false) when
 * RESEND_API_KEY is not configured, so local dev / unconfigured deploys keep
 * working without errors.
 */
export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[email] RESEND_API_KEY unset — order notification skipped.");
    }
    return false;
  }
  const from = process.env.EMAIL_FROM ?? "Tiendify <onboarding@resend.dev>";

  // Resend's sandbox sender (onboarding@resend.dev) only delivers to the Resend
  // account owner. In production that means every OTHER tenant gets nothing —
  // surface it loudly so the misconfiguration is caught. Fix: verify a domain in
  // Resend and set EMAIL_FROM to an address on it.
  if (process.env.NODE_ENV === "production" && from.includes("resend.dev")) {
    console.warn(
      "[email] EMAIL_FROM uses the resend.dev sandbox sender — emails will NOT reach other tenants. Verify a domain in Resend and update EMAIL_FROM.",
    );
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[email] Resend send failed (${res.status}): ${body.slice(0, 300)}`);
    }
    return res.ok;
  } catch (err) {
    console.warn(`[email] Resend request threw: ${String(err)}`);
    return false;
  }
}

interface NewOrderEmailParams {
  storeName: string;
  orderNumber: number;
  customerName: string;
  totalLabel: string;
  itemsCount: number;
  fulfillmentLabel: string;
  orderUrl: string;
}

/** Build the "new order" notification email for the store owner. */
export function newOrderEmail(p: NewOrderEmailParams): {
  subject: string;
  html: string;
} {
  const subject = `🛒 Nuevo pedido #${p.orderNumber} · ${p.storeName}`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 4px">¡Tienes un nuevo pedido! 🎉</h2>
    <p style="margin:0 0 16px;color:#64748b">${esc(p.storeName)}</p>
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px">
      <p style="margin:0 0 8px;font-size:18px;font-weight:700">Pedido #${esc(p.orderNumber)}</p>
      <p style="margin:0;color:#334155">Cliente: <strong>${esc(p.customerName)}</strong></p>
      <p style="margin:0;color:#334155">Entrega: ${esc(p.fulfillmentLabel)}</p>
      <p style="margin:0;color:#334155">${esc(p.itemsCount)} ${p.itemsCount === 1 ? "artículo" : "artículos"} · Total: <strong>${esc(p.totalLabel)}</strong></p>
    </div>
    <a href="${esc(p.orderUrl)}" style="display:inline-block;background:#0EA5E9;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Ver pedido en el panel</a>
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Tiendify</p>
  </div>`;
  return { subject, html };
}

interface ReferralRewardEmailParams {
  ownerName: string;
  storeName: string;
  /** null si la tienda referida se borró entre el premio y el correo. */
  referredName: string | null;
  months: number;
  /** El referidor ya tiene Pro de por vida: no hay meses que sumarle. */
  lifetime: boolean;
}

/**
 * Aviso al comerciante de que su referido se activó y ya tiene el mes de Pro.
 *
 * Dice explícitamente que los meses se suman al FINAL del período: si tiene la
 * renovación automática, el premio no le frena el cobro de este mes,
 * y sin esa línea llega el reclamo.
 */
export function referralRewardEmail(p: ReferralRewardEmailParams): {
  subject: string;
  html: string;
} {
  const monthLabel = p.months === 1 ? "1 mes" : `${p.months} meses`;
  const subject = p.lifetime
    ? "🎉 Tu referido ya está vendiendo"
    : `🎁 Ganaste ${monthLabel} de Pro por tu referido`;

  // A quien tiene Pro de por vida no se le promete un mes que no se le puede
  // sumar: se le agradece y listo.
  const reward = p.lifetime
    ? `<p style="margin:0;font-size:18px;font-weight:700">
         ¡Gracias por hacer crecer Tiendify!
       </p>
       <p style="margin:8px 0 0;color:#64748b;font-size:14px">
         Tu Pro no tiene vencimiento, así que no hay meses que sumar.
       </p>`
    : `<p style="margin:0;font-size:18px;font-weight:700">
         Sumamos ${esc(monthLabel)} de Pro a ${esc(p.storeName)}
       </p>`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 4px">¡Tu referido arrancó! 🎉</h2>
    <p style="margin:0 0 16px;color:#64748b">Hola ${esc(p.ownerName)}</p>
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px">
      <p style="margin:0 0 8px;color:#334155;line-height:1.5">
        ${p.referredName ? `<strong>${esc(p.referredName)}</strong> ya` : "La tienda que trajiste ya"}
        publicó sus productos y confirmó su primera venta.
      </p>
      ${reward}
    </div>
    ${
      p.lifetime
        ? ""
        : `<p style="margin:0 0 16px;color:#64748b;font-size:14px;line-height:1.5">
      Los meses se agregan al final de tu período actual. Si pagas tu plan con
      renovación automática, el cobro de este mes sigue igual y tu vencimiento
      se corre hacia adelante.
    </p>`
    }
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Tiendify</p>
  </div>`;
  return { subject, html };
}

interface FeedbackEmailParams {
  storeName: string;
  kindLabel: string;
  message: string;
  ownerName: string;
  ownerEmail: string;
  /** WhatsApp de la tienda, tal como está guardado. */
  whatsapp: string | null;
  /** La bandeja en /super/comentarios. */
  inboxUrl: string;
}

/**
 * Aviso al super admin de que un comerciante escribió desde su panel.
 *
 * Lleva el mensaje entero y cómo contactarlo, para poder contestar desde el
 * correo sin abrir nada: quien lo manda pone al comerciante en el "responder".
 */
export function feedbackEmail(p: FeedbackEmailParams): {
  subject: string;
  html: string;
} {
  const subject = `💬 ${p.storeName}: ${p.kindLabel.toLowerCase()}`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 4px">${esc(p.kindLabel)}</h2>
    <p style="margin:0 0 16px;color:#64748b">${esc(p.storeName)}</p>
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px">
      <p style="margin:0;color:#334155;line-height:1.5;white-space:pre-wrap">${esc(p.message)}</p>
    </div>
    <p style="margin:0;color:#334155"><strong>${esc(p.ownerName)}</strong></p>
    <p style="margin:0;color:#334155">${esc(p.ownerEmail)}</p>
    ${p.whatsapp ? `<p style="margin:0 0 16px;color:#334155">WhatsApp: ${esc(p.whatsapp)}</p>` : `<p style="margin:0 0 16px"></p>`}
    <a href="${esc(p.inboxUrl)}" style="display:inline-block;background:#0EA5E9;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Ver en el panel</a>
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Tiendify · Responde este correo para escribirle a ${esc(p.ownerName)}.</p>
  </div>`;
  return { subject, html };
}

interface CustomerStatusEmailParams {
  storeName: string;
  orderNumber: number;
  statusLabel: string;
  message: string;
  /** Página pública de seguimiento del pedido. */
  orderUrl?: string | null;
}

/** Build the "order status update" email for the customer. */
export function customerOrderStatusEmail(p: CustomerStatusEmailParams): {
  subject: string;
  html: string;
} {
  const subject = `Tu pedido #${p.orderNumber}: ${p.statusLabel} · ${p.storeName}`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <p style="margin:0 0 4px;color:#64748b">${esc(p.storeName)}</p>
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px">
      <p style="margin:0 0 8px;font-size:18px;font-weight:700">Pedido #${esc(p.orderNumber)} · ${esc(p.statusLabel)}</p>
      <p style="margin:0;color:#334155;line-height:1.5">${esc(p.message)}</p>
    </div>
    ${
      p.orderUrl
        ? `<a href="${esc(p.orderUrl)}" style="display:inline-block;margin-top:16px;background:#0EA5E9;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Ver mi pedido</a>`
        : ""
    }
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Enviado por ${esc(p.storeName)} vía Tiendify</p>
  </div>`;
  return { subject, html };
}

/**
 * Recibo para el cliente apenas compra. Es el mismo contenido que el mensaje de
 * WhatsApp (`orderReceiptCustomerMessage`), por eso comparte `OrderMessageData`:
 * si cambia lo que se le informa al cliente, cambia en los dos canales.
 */
/**
 * En qué punto del camino está el pedido cuando se manda el recibo.
 *  - awaiting_payment: eligió pago por fuera y todavía no subió el comprobante.
 *  - pending_proof:    ya lo subió y la tienda tiene que verificarlo.
 *  - confirmed:        efectivo o tarjeta, no hay nada que esperar.
 */
export type ReceiptState = "awaiting_payment" | "pending_proof" | "confirmed";

export function customerOrderReceiptEmail(
  d: OrderMessageData,
  opts: { state: ReceiptState },
): { subject: string; html: string } {
  const awaiting = opts.state === "awaiting_payment";
  const pendingProof = opts.state === "pending_proof";
  const subject = awaiting
    ? `Termina tu pedido #${d.orderNumber} · ${d.storeName}`
    : pendingProof
      ? `Recibimos tu pedido #${d.orderNumber} · ${d.storeName}`
      : `Pedido #${d.orderNumber} confirmado · ${d.storeName}`;

  const rows = d.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#334155">
          ${esc(i.productName)}${i.variantName ? `<br><span style="font-size:12px;color:#0EA5E9">${esc(i.variantName)}</span>` : ""}
          <br><span style="font-size:12px;color:#94a3b8">Cantidad: ${esc(i.quantity)}</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap;color:#0f172a;font-weight:600">
          ${esc(formatUSD(i.subtotal))}
        </td>
      </tr>`,
    )
    .join("");

  const line = (label: string, value: string, color = "#64748b") =>
    `<tr><td style="padding:2px 0;color:${color}">${esc(label)}</td><td style="padding:2px 0;text-align:right;color:${color}">${esc(value)}</td></tr>`;

  const breakdown = [
    d.discount > 0 || d.shipping > 0
      ? line("Subtotal", formatUSD(d.subtotal))
      : "",
    d.discount > 0
      ? line(
          `Descuento${d.couponCode ? ` (${d.couponCode})` : ""}`,
          `−${formatUSD(d.discount)}`,
          "#16a34a",
        )
      : "",
    d.shipping > 0 ? line("Envío", formatUSD(d.shipping)) : "",
  ].join("");

  const fulfillment =
    d.fulfillment === "delivery"
      ? `Delivery${d.deliveryAddress ? ` · ${d.deliveryAddress}` : ""}`
      : `Retiro en tienda${d.pickupAddress ? ` · ${d.pickupAddress}` : ""}`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <p style="margin:0 0 4px;color:#64748b">${esc(d.storeName)}</p>
    <h2 style="margin:0 0 4px">${
      awaiting
        ? "Te guardamos tu pedido ⏳"
        : pendingProof
          ? "¡Recibimos tu pedido! ⏳"
          : "¡Pedido confirmado! ✅"
    }</h2>
    <p style="margin:0 0 16px;color:#64748b">
      ${
        awaiting
          ? "Falta que hagas el pago y subas el comprobante. Abre el enlace de abajo cuando lo tengas: te toma menos de un minuto."
          : pendingProof
            ? "Estamos verificando tu pago. Te avisamos apenas quede confirmado."
            : "Ya lo estamos preparando. Te avisamos cuando avance."
      }
    </p>

    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px">
      <p style="margin:0 0 12px;font-size:18px;font-weight:700">Pedido #${esc(d.orderNumber)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px">
        ${breakdown}
        <tr>
          <td style="padding:8px 0 0;font-weight:700">Total</td>
          <td style="padding:8px 0 0;text-align:right;font-weight:700;font-size:16px">
            ${esc(formatUSD(d.total))}${d.totalBs ? `<br><span style="font-size:12px;font-weight:400;color:#94a3b8">${esc(formatBs(d.totalBs))}</span>` : ""}
          </td>
        </tr>
      </table>
    </div>

    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px;font-size:14px;color:#334155">
      ${d.paymentLabel ? `<p style="margin:0 0 4px">Pago: <strong>${esc(d.paymentLabel)}</strong></p>` : ""}
      <p style="margin:0">Entrega: ${esc(fulfillment)}</p>
    </div>

    ${
      d.orderUrl
        ? `<a href="${esc(d.orderUrl)}" style="display:inline-block;background:#0EA5E9;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Ver mi pedido</a>`
        : ""
    }
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Enviado por ${esc(d.storeName)} vía Tiendify</p>
  </div>`;

  return { subject, html };
}

interface PlanNoticeEmailParams {
  kind: PlanNoticeKind;
  ownerName: string | null;
  storeName: string;
  /** Es la prueba gratis (con o sin código), no un plan que pagó. */
  trial: boolean;
  /** Días que faltan para lo que anuncia el aviso: el vencimiento o la pausa. */
  days: number;
  /** El día en que la tienda se pausa, ya escrito ("27 de octubre"). */
  pauseDate: string;
  /** Lo que cuesta Pro al mes, para decirlo en el correo. */
  monthlyPrice: number;
  /** La página del plan en el panel. */
  planUrl: string;
}

/**
 * Los avisos a una tienda nueva cuando se le vence el plan (ver lib/plans:
 * no tiene Gratis, tiene gracia y después pausa). Los manda el cron diario,
 * uno por etapa, desde lib/plan-notices.ts.
 *
 * Todos dicen lo mismo de fondo: qué pasa, cuándo, que no se borra nada y
 * cómo se evita. La palabra "pausa" va siempre con lo que significa para el
 * comerciante (sus clientes no pueden comprar), no como estado técnico.
 */
export function planNoticeEmail(p: PlanNoticeEmailParams): {
  subject: string;
  html: string;
} {
  const inDays = (n: number) =>
    n <= 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`;
  const price = formatUSD(p.monthlyPrice);
  const what = p.trial ? "Tu prueba gratis" : "Tu plan Pro";

  let subject: string;
  let title: string;
  let body: string;
  let cta = "Activar Pro";
  switch (p.kind) {
    case "ending":
      subject = `${what} de Tiendify termina ${inDays(p.days)}`;
      title = `${what} termina ${inDays(p.days)}`;
      body = `Para que <strong>${esc(p.storeName)}</strong> siga vendiendo sin cortes, activa Pro por ${esc(price)} al mes. Lo pagas por Pago Móvil, Binance o tarjeta, y si renuevas antes, los días que te quedan se suman.`;
      break;
    case "grace":
      subject = `Tu plan venció: ${p.storeName} se pausa el ${p.pauseDate}`;
      title = "Tu plan venció";
      body = `<strong>${esc(p.storeName)}</strong> sigue funcionando hasta el ${esc(p.pauseDate)}. Si no renuevas antes, la tienda se pausa: tus clientes verán un aviso y no podrán comprar. No se borra nada.`;
      cta = "Renovar Pro";
      break;
    case "pause_soon":
      subject = `${p.storeName} se pausa ${inDays(p.days)}`;
      title = `Tu tienda se pausa ${inDays(p.days)}`;
      body = `Desde el ${esc(p.pauseDate)} tus clientes no podrán comprar en <strong>${esc(p.storeName)}</strong>. Renueva Pro por ${esc(price)} al mes y sigue vendiendo como hasta ahora.`;
      cta = "Renovar Pro";
      break;
    case "paused":
      subject = `${p.storeName} está en pausa`;
      title = "Tu tienda está en pausa";
      body = `Tus clientes ven un aviso y no pueden comprar en <strong>${esc(p.storeName)}</strong>. Tus productos, pedidos y clientes siguen guardados: activa Pro por ${esc(price)} al mes y la tienda vuelve al instante, tal como estaba.`;
      break;
  }

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 4px">${esc(title)}</h2>
    <p style="margin:0 0 16px;color:#64748b">Hola${p.ownerName ? ` ${esc(p.ownerName)}` : ""}</p>
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px">
      <p style="margin:0;color:#334155;line-height:1.5">${body}</p>
    </div>
    <a href="${esc(p.planUrl)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">${esc(cta)}</a>
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Tiendify</p>
  </div>`;
  return { subject, html };
}
