// Heuristic extraction of technical specs from a product's name + description,
// so the Tecnología layout can show spec bullets without a new data field.

const UNITS = [
  "kW", "W", "V", "A", "GHz", "MHz", "Hz", "GB", "TB", "MB", "mAh",
  "BTU", "MP", "RPM", "ml", "L", "kg", "cm", "mm", "px", "°C",
  "pulgadas", "litros", "tazas", "programas", "velocidades", "km/h",
];

const NUM_SPEC = new RegExp(
  String.raw`\b\d+(?:[.,]\d+)?\s?(?:${UNITS.join("|")})\b`,
  "gi",
);

const KEYWORDS = [
  "4K", "8K", "Full HD", "Ultra HD", "1080p", "720p",
  "Bluetooth", "Wi-Fi", "WiFi", "Inverter", "OLED", "QLED", "LED",
  "HDMI", "USB", "Smart TV", "Touch",
];

function escapeRe(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

/** Up to `max` spec-like tokens (e.g. "3.5 L", "1400 W", "Full HD"). */
export function extractSpecs(
  name: string,
  description: string | null | undefined,
  max = 4,
): string[] {
  const text = `${name} ${description ?? ""}`;
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const s = raw.trim();
    const key = s.toLowerCase().replace(/\s+/g, "");
    if (s && !seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  };

  for (const m of text.matchAll(NUM_SPEC)) push(m[0]);
  for (const kw of KEYWORDS) {
    if (new RegExp(`\\b${escapeRe(kw)}\\b`, "i").test(text)) push(kw);
  }
  return out.slice(0, max);
}
