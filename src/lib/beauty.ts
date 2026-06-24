// Helpers for the Belleza layout.

const TAG_RULES: { kw: string[]; label: string }[] = [
  { kw: ["orgánic", "organic"], label: "Orgánico" },
  { kw: ["vegano", "vegan"], label: "Vegano" },
  { kw: ["cruelty"], label: "Cruelty Free" },
  { kw: ["natural"], label: "Natural" },
  { kw: ["hipoalerg"], label: "Hipoalergénico" },
  { kw: ["sin paraben", "paraben free"], label: "Sin parabenos" },
  { kw: ["dermatológ", "dermatolog"], label: "Dermatológico" },
];

/** Visual tags derived from the product text (only shown when actually mentioned). */
export function extractBeautyTags(
  name: string,
  description: string | null | undefined,
  max = 2,
): string[] {
  const text = `${name} ${description ?? ""}`.toLowerCase();
  const out: string[] = [];
  for (const { kw, label } of TAG_RULES) {
    if (kw.some((k) => text.includes(k))) out.push(label);
    if (out.length >= max) break;
  }
  return out;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Deterministic placeholder rating/count per product (stable across renders).
 * NOTE: not real reviews — a visual element for the Belleza template. Can be
 * wired to a real review system later.
 */
export function reviewStub(id: string): { rating: number; count: number } {
  const h = hashStr(id);
  return { rating: 4.5 + ((h >> 4) % 2) * 0.5, count: 8 + (h % 52) };
}
