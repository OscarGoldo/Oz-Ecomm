// Helpers for the Drops (sports-drops) layout.

const TYPE_RULES: { kw: string[]; label: string }[] = [
  { kw: ["player", "versión jugador", "version jugador", "jugador"], label: "PLAYER" },
  { kw: ["retro", "vintage", "clásica", "clasica"], label: "RETRO" },
  { kw: ["limitad", "limited", "edición especial", "edicion especial", "exclusiv"], label: "LIMITADA" },
  { kw: ["mundial", "world cup", "copa"], label: "MUNDIAL" },
  { kw: ["firmad", "signed", "autograf"], label: "FIRMADA" },
];

/** Collector "type" badge derived from product text (only when mentioned). */
export function extractDropBadge(
  name: string,
  description: string | null | undefined,
): string | null {
  const text = `${name} ${description ?? ""}`.toLowerCase();
  for (const { kw, label } of TYPE_RULES) {
    if (kw.some((k) => text.includes(k))) return label;
  }
  return null;
}
