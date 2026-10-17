import "server-only";

/**
 * El editor por secciones se prende por tienda mientras se prueba.
 *
 * `DESIGN_V2=all` lo prende para todas; `DESIGN_V2=mitienda,otra` solo para
 * esas. Sin la variable, todo sigue como siempre: el editor viejo y las
 * plantillas de siempre. Así se prueba en una tienda real (la tuya) antes de
 * que lo vean las demás.
 */
export function designV2Enabled(store: { slug: string }): boolean {
  const raw = process.env.DESIGN_V2?.trim();
  if (!raw) return false;
  if (raw === "all") return true;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(store.slug.toLowerCase());
}
