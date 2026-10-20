import type { FeedbackKind } from "@/types/database";

/**
 * El WhatsApp de Tiendify para los comerciantes, o null si no está puesto.
 *
 * Va por variable de entorno (`SUPPORT_WHATSAPP`, con código de país:
 * "584241234567") y no escrito en el código: es un número personal y cambia
 * sin que cambie nada más. Sin la variable, el botón de WhatsApp no aparece.
 */
export function supportWhatsapp(): string | null {
  return (process.env.SUPPORT_WHATSAPP ?? "").trim() || null;
}

/**
 * El mismo WhatsApp, listo para mostrar como contacto público (portada,
 * Términos, Privacidad): el link de wa.me y el número como se lee. null si la
 * variable no está, y entonces el contacto no se dibuja.
 */
export function supportContact(message?: string): { url: string; label: string } | null {
  const digits = (supportWhatsapp() ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return { url: `https://wa.me/${digits}${text}`, label: `+${digits}` };
}

/** Cómo se le dice a cada tipo de comentario, del lado de quien lo escribe. */
export const FEEDBACK_KINDS: { id: FeedbackKind; label: string }[] = [
  { id: "problem", label: "Algo no funciona" },
  { id: "idea", label: "Tengo una idea" },
  { id: "other", label: "Otra cosa" },
];

export function feedbackKindLabel(kind: FeedbackKind): string {
  return FEEDBACK_KINDS.find((k) => k.id === kind)?.label ?? kind;
}
