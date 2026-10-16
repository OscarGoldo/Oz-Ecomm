/**
 * El período de un reporte de Finanzas: qué días cubre, cómo se llama y
 * contra qué período se compara.
 *
 * Todo se piensa en fechas de calendario de Caracas ("2026-09-30"), no en
 * `Date` del servidor. Vercel corre en UTC: con `new Date(2026, 8, 1)` el mes
 * arrancaba a las 8 de la noche del 31 de agosto en Caracas, y las ventas de
 * esas cuatro horas caían en el mes equivocado. Acá un día empieza a las
 * 00:00 de Caracas y recién al pedirle datos a la base se pasa a UTC.
 *
 * Archivo puro (sin Supabase): lo usan la página y la descarga en CSV, y los
 * dos tienen que entender exactamente el mismo rango.
 */

const TZ = "America/Caracas";

/**
 * Venezuela está en UTC−4 fijo desde mayo de 2016, sin horario de verano.
 * Tiendify no tiene ventas de antes, así que el desfase se puede escribir.
 */
const CARACAS_OFFSET = "-04:00";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MONTHS_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export const PERIOD_PRESETS = [
  { id: "hoy", label: "Hoy" },
  { id: "7d", label: "Últimos 7 días" },
  { id: "30d", label: "Últimos 30 días" },
  { id: "este-mes", label: "Este mes" },
  { id: "mes-pasado", label: "Mes pasado" },
  { id: "trimestre", label: "Este trimestre" },
  { id: "este-ano", label: "Este año" },
  { id: "ano-pasado", label: "Año pasado" },
] as const;

export type PeriodPresetId = (typeof PERIOD_PRESETS)[number]["id"];

export const DEFAULT_PRESET: PeriodPresetId = "este-mes";

export interface DateRange {
  /** Primer día, inclusive ("2026-09-01"). */
  from: string;
  /** Último día, inclusive ("2026-09-30"). */
  to: string;
}

export interface ReportPeriod extends DateRange {
  /** El atajo que coincide con este rango, o null si es uno a mano. */
  preset: PeriodPresetId | null;
  /** "septiembre 2026", "1–16 oct 2026", "2025". */
  label: string;
  /** Inicio en UTC para filtrar `created_at` (>=). */
  fromISO: string;
  /** Fin exclusivo en UTC: las 00:00 de Caracas del día siguiente a `to`. */
  toISO: string;
  /** El período contra el que se compara. */
  previous: DateRange & { label: string; fromISO: string; toISO: string };
}

// ── Fechas de calendario ────────────────────────────────────────────────────

const YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Hoy en Caracas, como "2026-10-16". */
export function caracasToday(now = new Date()): string {
  return YMD.format(now);
}

function parts(s: string): [number, number, number] {
  const [y, m, d] = s.split("-").map(Number);
  return [y, m, d];
}

function fromUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "2026-02-30" no existe: solo pasa lo que sobrevive a la ida y vuelta. */
export function isValidDay(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = parts(s);
  if (y < 2000 || y > 2100) return false;
  return fromUTC(new Date(Date.UTC(y, m - 1, d))) === s;
}

function addDays(s: string, n: number): string {
  const [y, m, d] = parts(s);
  return fromUTC(new Date(Date.UTC(y, m - 1, d + n)));
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Corre meses sin desbordar: 31 de marzo menos un mes es 28 de febrero. */
function addMonths(s: string, n: number): string {
  const [y, m, d] = parts(s);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const ty = first.getUTCFullYear();
  const tm = first.getUTCMonth() + 1;
  return fromUTC(new Date(Date.UTC(ty, tm - 1, Math.min(d, daysInMonth(ty, tm)))));
}

function startOfMonth(s: string): string {
  return `${s.slice(0, 7)}-01`;
}

function endOfMonth(s: string): string {
  const [y, m] = parts(s);
  return `${s.slice(0, 7)}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
}

function isEndOfMonth(s: string): boolean {
  return s === endOfMonth(s);
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = parts(from);
  const [ty, tm] = parts(to);
  return (ty - fy) * 12 + (tm - fm);
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** Las 00:00 de ese día en Caracas, en UTC. */
function startISO(day: string): string {
  return new Date(`${day}T00:00:00${CARACAS_OFFSET}`).toISOString();
}

// ── Nombres ─────────────────────────────────────────────────────────────────

/**
 * El nombre más corto que no deja dudas: un mes entero se llama por su
 * nombre, un año entero por su número, y un rango suelto repite solo lo que
 * cambia ("1–16 oct 2026", "15 sep – 16 oct 2026").
 */
export function rangeLabel(from: string, to: string): string {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  const short = (m: number) => MONTHS_SHORT[m - 1];

  if (from === to) return `${fd} ${short(fm)} ${fy}`;
  if (fd === 1 && isEndOfMonth(to)) {
    if (fm === 1 && tm === 12 && fy === ty) return String(fy);
    if (fy === ty && fm === tm) return `${MONTHS[fm - 1]} ${fy}`;
  }
  if (fy === ty && fm === tm) return `${fd}–${td} ${short(fm)} ${fy}`;
  if (fy === ty) return `${fd} ${short(fm)} – ${td} ${short(tm)} ${fy}`;
  return `${fd} ${short(fm)} ${fy} – ${td} ${short(tm)} ${ty}`;
}

// ── Atajos ──────────────────────────────────────────────────────────────────

function presetRange(id: PeriodPresetId, today: string): DateRange {
  switch (id) {
    case "hoy":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "este-mes":
      return { from: startOfMonth(today), to: today };
    case "mes-pasado": {
      const prev = addMonths(startOfMonth(today), -1);
      return { from: prev, to: endOfMonth(prev) };
    }
    case "trimestre": {
      const [y, m] = parts(today);
      const qm = Math.floor((m - 1) / 3) * 3 + 1;
      return { from: `${y}-${String(qm).padStart(2, "0")}-01`, to: today };
    }
    case "este-ano":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "ano-pasado": {
      const y = Number(today.slice(0, 4)) - 1;
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
  }
}

/**
 * Contra qué se compara. Lo que va "en lo que va de" (mes, trimestre, año)
 * se compara con los mismos días del período anterior: el 16 de octubre,
 * "este mes" va contra el 1–16 de septiembre, no contra septiembre entero,
 * que siempre ganaría. Un rango suelto va contra los mismos días justo antes.
 */
function previousRange(range: DateRange, preset: PeriodPresetId | null): DateRange {
  const monthsBack =
    preset === "este-mes" || preset === "mes-pasado"
      ? 1
      : preset === "trimestre"
        ? 3
        : preset === "este-ano" || preset === "ano-pasado"
          ? 12
          : // Uno a mano que justo cubre meses enteros se compara por meses.
            range.from.endsWith("-01") && isEndOfMonth(range.to)
            ? monthsBetween(range.from, range.to) + 1
            : 0;

  if (monthsBack > 0) {
    const to = addMonths(range.to, -monthsBack);
    return {
      from: addMonths(range.from, -monthsBack),
      to: isEndOfMonth(range.to) ? endOfMonth(to) : to,
    };
  }
  const length = daysBetween(range.from, range.to) + 1;
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
}

// ── Desde la URL ────────────────────────────────────────────────────────────

export interface PeriodParams {
  periodo?: string;
  desde?: string;
  hasta?: string;
  /** El reporte mensual viejo usaba `?m=2026-09`; esos enlaces siguen andando. */
  m?: string;
}

export function resolvePeriod(
  params: PeriodParams,
  today = caracasToday(),
): ReportPeriod {
  let range: DateRange;
  let preset: PeriodPresetId | null = null;

  if (isValidDay(params.desde) && isValidDay(params.hasta)) {
    range =
      params.desde <= params.hasta
        ? { from: params.desde, to: params.hasta }
        : { from: params.hasta, to: params.desde };
  } else if (/^\d{4}-\d{2}$/.test(params.m ?? "") && isValidDay(`${params.m}-01`)) {
    const first = `${params.m}-01`;
    range = { from: first, to: endOfMonth(first) };
  } else {
    preset = PERIOD_PRESETS.some((p) => p.id === params.periodo)
      ? (params.periodo as PeriodPresetId)
      : DEFAULT_PRESET;
    range = presetRange(preset, today);
  }

  // Un rango a mano que es idéntico a un atajo se muestra como ese atajo.
  if (!preset) {
    preset =
      PERIOD_PRESETS.find((p) => {
        const r = presetRange(p.id, today);
        return r.from === range.from && r.to === range.to;
      })?.id ?? null;
  }

  const prev = previousRange(range, preset);
  return {
    ...range,
    preset,
    label: rangeLabel(range.from, range.to),
    fromISO: startISO(range.from),
    toISO: startISO(addDays(range.to, 1)),
    previous: {
      ...prev,
      label: rangeLabel(prev.from, prev.to),
      fromISO: startISO(prev.from),
      toISO: startISO(addDays(prev.to, 1)),
    },
  };
}

/** Los parámetros de URL que reconstruyen este período. */
export function periodQuery(p: ReportPeriod): Record<string, string> {
  return p.preset ? { periodo: p.preset } : { desde: p.from, hasta: p.to };
}

// ── Fechas y horas de un registro ───────────────────────────────────────────

const DATE_TIME = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function dateTimeParts(iso: string) {
  const p = Object.fromEntries(
    DATE_TIME.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute };
}

/** "2026-09-30 14:05", hora de Caracas. Para el CSV: ordena bien como texto. */
export function csvDateTime(iso: string): string {
  const p = dateTimeParts(iso);
  return `${p.y}-${p.m}-${p.d} ${p.h}:${p.min}`;
}

/** "30 sep, 14:05", hora de Caracas. Para la tabla en pantalla. */
export function shortDateTime(iso: string): string {
  const p = dateTimeParts(iso);
  return `${Number(p.d)} ${MONTHS_SHORT[Number(p.m) - 1]}, ${p.h}:${p.min}`;
}

/** "30 sep" para un día de calendario ("2026-09-30"), sin pasar por zonas. */
export function shortDay(day: string): string {
  const [, m, d] = parts(day);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}
