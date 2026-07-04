import "server-only";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

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
  const from = process.env.EMAIL_FROM ?? "OzShop <onboarding@resend.dev>";

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
    <p style="margin:0 0 16px;color:#64748b">${p.storeName}</p>
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px">
      <p style="margin:0 0 8px;font-size:18px;font-weight:700">Pedido #${p.orderNumber}</p>
      <p style="margin:0;color:#334155">Cliente: <strong>${p.customerName}</strong></p>
      <p style="margin:0;color:#334155">Entrega: ${p.fulfillmentLabel}</p>
      <p style="margin:0;color:#334155">${p.itemsCount} ${p.itemsCount === 1 ? "artículo" : "artículos"} · Total: <strong>${p.totalLabel}</strong></p>
    </div>
    <a href="${p.orderUrl}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Ver pedido en el panel</a>
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">OzShop</p>
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
    <p style="margin:0 0 4px;color:#64748b">${p.storeName}</p>
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px">
      <p style="margin:0 0 8px;font-size:18px;font-weight:700">Pedido #${p.orderNumber} · ${p.statusLabel}</p>
      <p style="margin:0;color:#334155;line-height:1.5">${p.message}</p>
    </div>
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Enviado por ${p.storeName} vía OzShop</p>
  </div>`;
  return { subject, html };
}
