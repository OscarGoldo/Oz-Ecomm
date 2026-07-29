import "server-only";

import { formatBs, formatUSD } from "@/lib/format";
import type { OrderMessageData } from "@/lib/order-messages";

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
      body: JSON.stringify({ from, to, subject, html }),
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
 * suscripción recurrente de PayPal, el premio no le frena el cobro de este mes,
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
      suscripción de PayPal, el cobro de este mes sigue igual y tu vencimiento
      se corre hacia adelante.
    </p>`
    }
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Tiendify</p>
  </div>`;
  return { subject, html };
}

interface CustomerStatusEmailParams {
  storeName: string;
  orderNumber: number;
  statusLabel: string;
  message: string;
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
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Enviado por ${esc(p.storeName)} vía Tiendify</p>
  </div>`;
  return { subject, html };
}

/**
 * Recibo para el cliente apenas compra. Es el mismo contenido que el mensaje de
 * WhatsApp (`orderReceiptCustomerMessage`), por eso comparte `OrderMessageData`:
 * si cambia lo que se le informa al cliente, cambia en los dos canales.
 */
export function customerOrderReceiptEmail(
  d: OrderMessageData,
  opts: { pendingProof: boolean },
): { subject: string; html: string } {
  const subject = opts.pendingProof
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
    <h2 style="margin:0 0 4px">${opts.pendingProof ? "¡Recibimos tu pedido! ⏳" : "¡Pedido confirmado! ✅"}</h2>
    <p style="margin:0 0 16px;color:#64748b">
      ${
        opts.pendingProof
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
