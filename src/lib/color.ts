/**
 * Convert a hex color (#RRGGBB or #RGB) to a Tailwind/shadcn-compatible HSL
 * triplet string like "221 83% 53%", suitable for `--primary: <triplet>`.
 * Returns null for invalid input so callers can fall back to the default theme.
 */
export function hexToHslTriplet(hex: string | null | undefined): string | null {
  if (!hex) return null;
  let value = hex.trim().replace(/^#/, "");
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;

  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  const hRound = Math.round(h);
  const sRound = Math.round(s * 100);
  const lRound = Math.round(l * 100);
  return `${hRound} ${sRound}% ${lRound}%`;
}
