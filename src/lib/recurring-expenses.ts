import type { RecurringFrequency } from "@/types/database";

/**
 * Los gastos que se repiten (alquiler, servicios…): cuándo toca cada pago.
 *
 * Un gasto que se repite guarda su primer pago (`starts_on`) y el próximo que
 * falta registrar (`next_due_on`). El cron diario (api/cron/gastos) registra
 * en `expenses` cada pago cuya fecha ya llegó y mueve el próximo. Todo lo de
 * acá son cuentas con fechas "AAAA-MM-DD", sin horas ni zona: corre igual en
 * el navegador (el aviso del formulario) que en el servidor.
 *
 * El día de cada pago sale siempre del primero, así los meses cortos no lo
 * van corriendo: un alquiler del 31 cae el 30 en abril y vuelve al 31 en mayo.
 */

export const RECURRING_FREQUENCIES: { value: RecurringFrequency; label: string }[] = [
  { value: "monthly", label: "Cada mes" },
  { value: "biweekly", label: "Cada quincena" },
  { value: "weekly", label: "Cada semana" },
  { value: "yearly", label: "Cada año" },
];

/** Veces por mes (52 semanas / 12 meses ≈ 4,33), como en la nómina. */
const PER_MONTH: Record<RecurringFrequency, number> = {
  weekly: 52 / 12,
  biweekly: 2,
  monthly: 1,
  yearly: 1 / 12,
};

/** Lo más atrás que puede empezar uno: los pagos viejos se cargan de una vez. */
export const MAX_BACKFILL_DAYS = 366;

/** Tope de pagos por pasada, para que una fecha absurda no llene la tabla. */
const MAX_PER_RUN = 60;

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const WEEKDAYS = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];

function parts(day: string): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number);
  return [y, m, d];
}

function daysIn(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = parts(day);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function nextMonth(y: number, m: number): [number, number] {
  return m === 12 ? [y + 1, 1] : [y, m + 1];
}

/**
 * Los dos días de la quincena: el del primer pago y quince días después, como
 * se cobra acá (el 15 y el 30, el 1 y el 16). Si empezó en la segunda mitad,
 * el otro es quince días antes.
 */
function biweeklyDays(startDay: number): [number, number] {
  const first = startDay > 15 ? startDay - 15 : startDay;
  return [first, first + 15];
}

/** El pago que sigue a `after` en la serie que empieza en `startsOn`. */
export function nextDue(startsOn: string, after: string, frequency: RecurringFrequency): string {
  const [, sm, sd] = parts(startsOn);
  const [y, m, d] = parts(after);
  switch (frequency) {
    case "weekly":
      return addDays(after, 7);
    case "monthly": {
      const [ny, nm] = nextMonth(y, m);
      return iso(ny, nm, Math.min(sd, daysIn(ny, nm)));
    }
    case "yearly":
      return iso(y + 1, sm, Math.min(sd, daysIn(y + 1, sm)));
    case "biweekly": {
      const [a, b] = biweeklyDays(sd);
      const first = Math.min(a, daysIn(y, m));
      const second = Math.min(b, daysIn(y, m));
      if (d < first) return iso(y, m, first);
      if (d < second) return iso(y, m, second);
      const [ny, nm] = nextMonth(y, m);
      return iso(ny, nm, Math.min(a, daysIn(ny, nm)));
    }
  }
}

/**
 * Los pagos que ya tocan desde `from` hasta `today` inclusive, y el que sigue.
 * Si se llega al tope, `next` queda en el pasado y la próxima pasada sigue.
 */
export function duePayments(
  startsOn: string,
  from: string,
  frequency: RecurringFrequency,
  today: string,
): { dates: string[]; next: string } {
  const dates: string[] = [];
  let cur = from;
  while (cur <= today && dates.length < MAX_PER_RUN) {
    dates.push(cur);
    cur = nextDue(startsOn, cur, frequency);
  }
  return { dates, next: cur };
}

/** Los pagos entre `from` y `to` inclusive que todavía no se registraron. */
export function pendingBetween(
  r: { starts_on: string; next_due_on: string; frequency: RecurringFrequency },
  from: string,
  to: string,
): string[] {
  const out: string[] = [];
  let cur = r.next_due_on;
  for (let i = 0; i < 400 && cur < from; i++) cur = nextDue(r.starts_on, cur, r.frequency);
  while (cur <= to && out.length < MAX_PER_RUN) {
    out.push(cur);
    cur = nextDue(r.starts_on, cur, r.frequency);
  }
  return out;
}

/** El primer pago desde `today` (para reanudar uno pausado sin cobrar lo de la pausa). */
export function firstDueFrom(
  r: { starts_on: string; next_due_on: string; frequency: RecurringFrequency },
  today: string,
): string {
  let cur = r.next_due_on;
  for (let i = 0; i < 400 && cur < today; i++) cur = nextDue(r.starts_on, cur, r.frequency);
  return cur;
}

export function monthlyEquivalent(amount: number, frequency: RecurringFrequency): number {
  return amount * PER_MONTH[frequency];
}

/** "cada mes, el día 1", "cada quincena, el 15 y el 30"… */
export function scheduleLabel(startsOn: string, frequency: RecurringFrequency): string {
  const [y, m, d] = parts(startsOn);
  switch (frequency) {
    case "weekly":
      return `cada semana, los ${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
    case "biweekly": {
      const [a, b] = biweeklyDays(d);
      return `cada quincena, el ${a} y el ${b}`;
    }
    case "monthly":
      return d >= 29 ? `cada mes, el ${d} (o el último día)` : `cada mes, el día ${d}`;
    case "yearly":
      return `cada año, el ${d} de ${MONTHS[m - 1]}`;
  }
}

/** "1 nov": el próximo pago, corto. */
export function shortDueLabel(day: string): string {
  const [, m, d] = parts(day);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}
