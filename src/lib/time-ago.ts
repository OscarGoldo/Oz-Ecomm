/**
 * "Hace cuánto", corto, para chips y listas del panel. Se arma en el servidor
 * y viaja como texto: calcularlo en el cliente daría otro minuto al hidratar.
 */

/** "Hace 35 min", "Hace 2 h", "Ayer", "Hace 3 días", "Hace 2 sem", "Hace 4 meses". */
export function shortAgo(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `Hace ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "Ayer";
  if (d < 14) return `Hace ${d} días`;
  if (d < 60) return `Hace ${Math.round(d / 7)} sem`;
  const m = Math.round(d / 30);
  return m < 12 ? `Hace ${m} meses` : m < 24 ? "Hace un año" : `Hace ${Math.round(m / 12)} años`;
}

/** Lo mismo en minúscula, para ir dentro de una frase: "le escribiste hace 20 h". */
export function agoInline(iso: string, now = Date.now()): string {
  const s = shortAgo(iso, now);
  return s === "Ayer" ? "ayer" : s.charAt(0).toLowerCase() + s.slice(1);
}
