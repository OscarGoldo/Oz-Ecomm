/**
 * CSV para descargar: coma como separador, punto decimal y saltos CRLF
 * (RFC 4180), que es lo que esperan Google Sheets, Excel con configuración
 * regional de coma y los sistemas contables al importar.
 *
 * Empieza con BOM: sin él, Excel abre el archivo como Windows-1252 y
 * "Pago Móvil" sale "Pago MÃ³vil".
 */

export type CsvValue = string | number | null | undefined;

/**
 * Montos negativos y teléfonos ("+58 412-1234567"): empiezan con un signo
 * pero no tienen letras, así que no pueden llamar a ninguna función.
 */
const NUMBER_LIKE = /^[+-]?[\d\s().-]+$/;

function cell(v: CsvValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";

  let s = v;
  // Inyección de fórmulas: el nombre del cliente lo escribe cualquiera en el
  // checkout, y "=HYPERLINK(...)" en una celda Excel lo ejecuta al abrirlo.
  // El apóstrofo lo deja como texto.
  if (/^[=+\-@\t\r]/.test(s) && !NUMBER_LIKE.test(s)) s = `'${s}`;
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  return (
    "﻿" +
    [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") +
    "\r\n"
  );
}

/** Un monto con sus dos decimales ("45.50"), sin separador de miles. */
export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "";
  return Number(n).toFixed(2);
}
