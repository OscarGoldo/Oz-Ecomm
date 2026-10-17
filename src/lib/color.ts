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

/**
 * Whether a hex color is "dark" (low perceived luminance). Used to switch the
 * storefront chrome to a dark token set when the surface color is dark.
 */
export function isDarkColor(hex: string | null | undefined): boolean {
  if (!hex) return false;
  let value = hex.trim().replace(/^#/, "");
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return false;

  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  // Rec. 601 perceived luminance.
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 0.4;
}

/**
 * ¿Texto blanco encima de este color? Sí, mientras el contraste WCAG con
 * blanco llegue a 3:1 (texto grande y en negrita, que es lo que va sobre un
 * color de marca). Prefiere blanco a propósito: sobre un magenta o un rojo,
 * el blanco es lo que espera cualquiera aunque el negro contraste un poco más.
 */
export function prefersWhiteText(hex: string | null | undefined): boolean {
  const value = hex?.trim().replace(/^#/, "") ?? "";
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return true;
  const lin = (i: number) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
  return 1.05 / (L + 0.05) >= 3;
}
