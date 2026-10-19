/**
 * Los tipos de cliente y cómo se muestran. Archivo puro: lo usan la lista
 * (cliente), la página y la descarga en CSV (servidor).
 */

export type CustomerSegment = "top" | "sleep" | "new" | "freq" | "one" | "none";

export const SEGMENT_META: Record<CustomerSegment, { label: string; className: string }> = {
  top: { label: "De los mejores", className: "bg-[#FFF4D6] text-[#7A5200]" },
  freq: { label: "Frecuente", className: "bg-[#E0F2FE] text-[#075985]" },
  new: { label: "Nuevo", className: "bg-[#DCF5EA] text-[#0E5A43]" },
  sleep: { label: "Para reactivar", className: "bg-[#FFEDE3] text-[#A8401A]" },
  one: { label: "Una compra", className: "bg-[#EEF3F8] text-pizarra" },
  none: { label: "Sin compra confirmada", className: "bg-[#F3F1EC] text-[#6B5E45]" },
};
