/**
 * Build a wa.me link. Normalizes the phone to digits only (Venezuela numbers
 * stored like "584241234567" or "0424-1234567"). Local 0xxx numbers are
 * converted to the +58 country code.
 */
export function whatsappUrl(
  phone: string | null | undefined,
  message?: string,
): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  // Local format starting with 0 → Venezuela country code 58.
  if (digits.startsWith("0")) digits = `58${digits.slice(1)}`;

  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
