/**
 * De dónde llegó una visita a la tienda. Archivo puro: lo usan la acción que
 * registra la visita y la analítica del panel, que nombra cada origen.
 *
 * Se mira en este orden, del dato más confiable al menos:
 *
 * 1. `utm_source` en el enlace: si el comerciante lo puso, manda.
 * 2. La app que abrió la tienda: Instagram, Facebook y TikTok abren los
 *    enlaces en su propio navegador y se anuncian en el user agent.
 * 3. La página anterior (`document.referrer`). En Android las apps que abren
 *    enlaces en una pestaña de Chrome se presentan como
 *    `android-app://com.whatsapp/`; así se reconoce WhatsApp.
 *
 * Sin nada de eso es "directo": alguien que escribió la dirección, la tenía
 * guardada o la abrió desde una app que no deja rastro. WhatsApp en iPhone cae
 * ahí: abre Safari sin decir de dónde viene.
 */

export const VISIT_SOURCES = [
  { id: "instagram", label: "Instagram", color: "#e87ba4" },
  { id: "whatsapp", label: "WhatsApp", color: "#1baf7a" },
  { id: "facebook", label: "Facebook", color: "#6250d6" },
  { id: "tiktok", label: "TikTok", color: "#0B1B2B" },
  { id: "buscadores", label: "Google y buscadores", color: "#eb6834" },
  { id: "directo", label: "Directo", color: "#0284C7" },
  { id: "otros", label: "Otros sitios", color: "#BFCEDD" },
] as const;

export type VisitSource = (typeof VISIT_SOURCES)[number]["id"];

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|brave)\./;

function fromTag(tag: string): VisitSource {
  const t = tag.trim().toLowerCase();
  if (/insta|^ig$/.test(t)) return "instagram";
  if (/whats|^wa$|^wsp$/.test(t)) return "whatsapp";
  if (/face|^fb$|messenger/.test(t)) return "facebook";
  if (/tiktok|^tt$/.test(t)) return "tiktok";
  if (/google|bing|search/.test(t)) return "buscadores";
  return "otros";
}

function fromApp(userAgent: string): VisitSource | null {
  if (/Instagram/i.test(userAgent)) return "instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS|Messenger/i.test(userAgent)) return "facebook";
  if (/musical_ly|BytedanceWebview|TikTok/i.test(userAgent)) return "tiktok";
  if (/WhatsApp/i.test(userAgent)) return "whatsapp";
  return null;
}

function fromReferrer(referrer: string): VisitSource | null {
  const r = referrer.trim().toLowerCase();
  if (!r) return null;
  if (r.startsWith("android-app://")) {
    if (r.includes("com.whatsapp")) return "whatsapp";
    if (r.includes("com.instagram")) return "instagram";
    if (r.includes("com.facebook")) return "facebook";
    if (r.includes("musically") || r.includes("com.ss.android")) return "tiktok";
    if (r.includes("com.google.android.googlequicksearchbox")) return "buscadores";
    return "otros";
  }
  let host: string;
  try {
    host = new URL(r).hostname;
  } catch {
    return "otros";
  }
  if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
  if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(host)) return "whatsapp";
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/.test(host)) return "facebook";
  if (/(^|\.)tiktok\.com$/.test(host)) return "tiktok";
  if (SEARCH.test(host)) return "buscadores";
  return "otros";
}

export function detectVisitSource({
  tag,
  userAgent,
  referrer,
}: {
  tag: string | null;
  userAgent: string | null;
  referrer: string | null;
}): VisitSource {
  if (tag) return fromTag(tag);
  return fromApp(userAgent ?? "") ?? fromReferrer(referrer ?? "") ?? "directo";
}

export function isVisitSource(v: unknown): v is VisitSource {
  return VISIT_SOURCES.some((s) => s.id === v);
}
