import { formatBs, formatUSD } from "@/lib/format";
import type { ProofVerdict } from "@/types/database";

/**
 * Las reglas que comparan lo que la IA leyó en un comprobante con el pedido.
 *
 * La IA solo lee la imagen; no sabe cuánto tenía que pagar el cliente ni a
 * quién. Toda la comparación vive acá, en código, por dos razones: que una
 * misma captura dé siempre el mismo veredicto, y que el monto esperado nunca
 * llegue al modelo (si lo supiera, tendería a "verlo" en la imagen).
 *
 * Nada de esto confirma que la plata llegó: eso solo lo sabe el banco. Lo que
 * hace es frenar la captura falsa, repetida o con el monto corto, y dejarle al
 * comerciante el dato listo para buscar en su banco.
 *
 * Sin "server-only": las usan los componentes del panel para pintar el
 * resultado, y se prueban sin base de datos.
 */

export type ProofMethod = "pago_movil" | "transfer" | "zelle" | "binance" | "other" | "unknown";
export type ProofCurrency = "VES" | "USD" | "USDT" | "USDC" | "other";
export type ProofPaymentStatus = "success" | "pending" | "failed" | "unknown";

/** Lo que la IA leyó de la captura, ya limpio. */
export interface ProofReading {
  /** false = la imagen no es un comprobante de pago. */
  isReceipt: boolean;
  method: ProofMethod;
  amount: number | null;
  currency: ProofCurrency | null;
  /** La referencia como se ve en la captura. */
  reference: string | null;
  /** AAAA-MM-DD. */
  date: string | null;
  /** HH:MM, 24 h. */
  time: string | null;
  originBank: string | null;
  destinationBank: string | null;
  /** A dónde fue la plata: teléfono, cuenta, correo o ID, como se ve. */
  destination: string | null;
  /** Cédula o RIF de quien recibió. */
  recipientId: string | null;
  recipientName: string | null;
  status: ProofPaymentStatus;
  /** Señales de que la captura pudo ser editada, en palabras de la IA. */
  editSigns: string[];
}

export type ProofFlagSeverity = "danger" | "warning" | "info";

export type ProofFlagCode =
  | "not_receipt"
  | "payment_failed"
  | "payment_pending"
  | "amount_low"
  | "amount_high"
  | "amount_unreadable"
  | "date_old"
  | "date_future"
  | "destination_mismatch"
  | "recipient_id_mismatch"
  | "method_mismatch"
  | "reference_mismatch"
  | "reference_unreadable"
  | "reference_reused"
  | "reference_reused_elsewhere"
  | "image_reused"
  | "image_reused_elsewhere"
  | "edit_signs";

export interface ProofFlag {
  code: ProofFlagCode;
  severity: ProofFlagSeverity;
  /** Para el comerciante, en una línea. */
  message: string;
  /** Solo en amount_low: lo que se le muestra al cliente. */
  paid?: number;
  expected?: number;
  currency?: "VES" | "USD";
}

/** Lo que se sabe del pedido para comparar. */
export interface ProofOrderFacts {
  /** En dólares. */
  total: number;
  totalBs: number | null;
  exchangeRate: number | null;
  /** payment_method_type del pedido. */
  method: string | null;
  /** created_at del pedido (ISO). */
  createdAt: string;
  /** La referencia que escribió el cliente en el checkout, si escribió. */
  typedReference: string | null;
  /** Los datos de cobro de la tienda para ese método (teléfono, cuenta...). */
  storeAccount: Record<string, string> | null;
}

/** Lo que se encontró en otros pedidos con la misma referencia o captura. */
export interface ProofDuplicates {
  /** Número del otro pedido de esta tienda con la misma referencia. */
  referenceOrderNumber: number | null;
  referenceElsewhere: boolean;
  /** Número del otro pedido de esta tienda con la misma captura. */
  imageOrderNumber: number | null;
  imageElsewhere: boolean;
}

export const NO_DUPLICATES: ProofDuplicates = {
  referenceOrderNumber: null,
  referenceElsewhere: false,
  imageOrderNumber: null,
  imageElsewhere: false,
};

/**
 * Cuántos caracteres tiene que tener una referencia para buscarla en otros
 * pedidos. Con menos, dos pagos distintos coinciden por casualidad (muchas
 * capturas muestran solo los últimos 4).
 */
export const MIN_REFERENCE_LENGTH = 6;
/** Para buscarla en OTRAS tiendas, más larga: ahí no hay pedido que mirar. */
export const MIN_REFERENCE_LENGTH_ELSEWHERE = 8;

/** Diferencia de monto que se deja pasar: el redondeo de la tasa y céntimos. */
const AMOUNT_TOLERANCE = 0.01;

/** Venezuela no cambia de hora: UTC-4 todo el año. */
const VE_OFFSET_MS = 4 * 60 * 60 * 1000;

/**
 * La referencia reducida a lo que se compara: sin espacios, guiones ni puntos.
 * Las de los bancos venezolanos son solo dígitos; la confirmación de Zelle y
 * las de Binance llevan letras, y se comparan con sus letras.
 */
export function referenceKey(ref: string | null | undefined): string | null {
  const key = (ref ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  return key.length >= 4 ? key : null;
}

/** La fecha en Venezuela (AAAA-MM-DD) de un instante. */
function veDate(iso: string | Date): string {
  const t = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  return new Date(t - VE_OFFSET_MS).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

/** "12 de octubre", para los mensajes. */
function dayLabel(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("es", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

const PAYS_IN_BS = new Set(["pago_movil", "transfer"]);

function money(amount: number, currency: "VES" | "USD"): string {
  return currency === "VES" ? formatBs(amount) : formatUSD(amount);
}

/**
 * Cuánto tenía que decir el comprobante, en la moneda en que está escrito.
 * Si la IA no supo la moneda, se supone la del método: Pago Móvil y
 * transferencia en bolívares; Zelle y Binance en dólares.
 */
function expectedAmount(
  reading: ProofReading,
  facts: ProofOrderFacts,
): { amount: number; currency: "VES" | "USD" } | null {
  let currency: "VES" | "USD";
  if (reading.currency === "VES") currency = "VES";
  else if (reading.currency === "USD" || reading.currency === "USDT" || reading.currency === "USDC") {
    currency = "USD";
  } else if (reading.currency === "other") {
    return null;
  } else {
    const method = reading.method !== "unknown" && reading.method !== "other" ? reading.method : facts.method;
    currency = method && PAYS_IN_BS.has(method) ? "VES" : "USD";
  }

  if (currency === "USD") return { amount: facts.total, currency };
  const bs =
    facts.totalBs ??
    (facts.exchangeRate && facts.exchangeRate > 0 ? facts.total * facts.exchangeRate : null);
  return bs === null ? null : { amount: bs, currency };
}

/** Lo que tapa dígitos en una captura: 0414***4567, ****4567, 0414xxx4567. */
const MASK_RE = /[*•·xX…]/;
/** En un correo la "x" es una letra, no una tapa. */
const EMAIL_MASK_RE = /[*•…]/;

function digitsOf(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Un teléfono venezolano reducido a sus últimos 10 dígitos (sin 58 ni el 0
 * de adelante): "+58 414-123.45.67" y "04141234567" dan lo mismo.
 */
function phoneKey(s: string): string {
  return digitsOf(s).slice(-10);
}

/**
 * ¿El destino que se ve en la captura es el de la tienda?
 *
 *  - "same": coincide.
 *  - "different": se ve completo y es otro. Es la señal más fuerte de una
 *    captura ajena: le pagaron a otra persona.
 *  - "partial": la captura lo muestra tapado (0414***4567) y lo que se ve no
 *    coincide. Puede ser otro, o la IA leyó mal la parte visible.
 *  - "unknown": no hay con qué comparar.
 */
type Match = "same" | "different" | "partial" | "unknown";

function compareDigits(seen: string, mine: string, minFull: number): Match {
  const visible = digitsOf(seen);
  const own = digitsOf(mine);
  if (visible.length < 3 || own.length < 3) return "unknown";
  if (MASK_RE.test(seen) || visible.length < minFull) {
    // Lo que se ve es el final del número (casi siempre los últimos 4).
    const tail = digitsOf(seen.split(MASK_RE).pop() ?? "");
    if (tail.length < 3) return "unknown";
    return own.endsWith(tail) ? "same" : "partial";
  }
  return visible.slice(-minFull) === own.slice(-minFull) ? "same" : "different";
}

function compareEmail(seen: string, mine: string): Match {
  const a = seen.trim().toLowerCase();
  const b = mine.trim().toLowerCase();
  if (!a.includes("@") || !b.includes("@")) return "unknown";
  if (EMAIL_MASK_RE.test(a)) {
    const [, domainA] = a.split("@");
    const [, domainB] = b.split("@");
    return domainA && domainB && domainA !== domainB ? "partial" : "unknown";
  }
  return a === b ? "same" : "different";
}

function destinationMatch(reading: ProofReading, facts: ProofOrderFacts): { match: Match; own: string | null } {
  const dest = reading.destination?.trim();
  const acc = facts.storeAccount;
  if (!dest || !acc) return { match: "unknown", own: null };

  if (dest.includes("@")) {
    const own = acc.email ?? acc.email_o_id ?? null;
    return { match: own ? compareEmail(dest, own) : "unknown", own };
  }
  switch (facts.method) {
    case "pago_movil": {
      const own = acc.telefono ?? null;
      if (!own) return { match: "unknown", own };
      // Se compara con los últimos 7: así "0414" contra "+58 414" no importa.
      const seenKey = MASK_RE.test(dest) ? dest : phoneKey(dest);
      return { match: compareDigits(seenKey, phoneKey(own), 7), own };
    }
    case "transfer": {
      const own = acc.cuenta ?? null;
      return { match: own ? compareDigits(dest, own, 20) : "unknown", own };
    }
    case "binance": {
      const own = acc.email_o_id ?? null;
      if (!own || own.includes("@")) return { match: "unknown", own };
      return { match: compareDigits(dest, own, Math.min(8, digitsOf(own).length)), own };
    }
    default:
      return { match: "unknown", own: null };
  }
}

const METHOD_LABEL: Record<ProofMethod, string> = {
  pago_movil: "Pago Móvil",
  transfer: "transferencia",
  zelle: "Zelle",
  binance: "Binance",
  other: "otro método",
  unknown: "otro método",
};

/** Pago Móvil y transferencia van al mismo banco: no es un cambio de método. */
function sameMethodFamily(a: string, b: string): boolean {
  if (a === b) return true;
  return PAYS_IN_BS.has(a) && PAYS_IN_BS.has(b);
}

/**
 * Compara la lectura con el pedido y devuelve el veredicto y las alertas,
 * de la más grave a la más leve.
 */
export function evaluateProof(
  reading: ProofReading,
  facts: ProofOrderFacts,
  dup: ProofDuplicates,
  now: Date = new Date(),
): { verdict: ProofVerdict; flags: ProofFlag[] } {
  const flags: ProofFlag[] = [];
  const add = (code: ProofFlagCode, severity: ProofFlagSeverity, message: string, extra?: Partial<ProofFlag>) =>
    flags.push({ code, severity, message, ...extra });

  // La misma captura en otro pedido no depende de lo que se leyó: va siempre.
  if (dup.imageOrderNumber !== null) {
    add("image_reused", "danger", `Esta misma captura ya se subió en el pedido #${dup.imageOrderNumber}.`);
  } else if (dup.imageElsewhere) {
    add("image_reused_elsewhere", "danger", "Esta misma captura ya se usó para pagar en otra tienda.");
  }

  if (!reading.isReceipt) {
    add("not_receipt", "danger", "La imagen no parece un comprobante de pago.");
    return finish(flags);
  }

  if (reading.status === "failed") {
    add("payment_failed", "danger", "El comprobante dice que el pago fue rechazado o no se completó.");
  } else if (reading.status === "pending") {
    add("payment_pending", "warning", "El comprobante dice que el pago está en proceso: puede no haber llegado.");
  }

  // Monto.
  const expected = expectedAmount(reading, facts);
  if (reading.amount === null || expected === null) {
    add("amount_unreadable", "warning", "No se pudo leer el monto: revísalo en la captura.");
  } else {
    const diff = reading.amount - expected.amount;
    const cents = expected.currency === "VES" ? 1 : 0.01;
    const within = Math.abs(diff) <= Math.max(expected.amount * AMOUNT_TOLERANCE, cents);
    if (!within && diff < 0) {
      add(
        "amount_low",
        "danger",
        `El comprobante dice ${money(reading.amount, expected.currency)} y el pedido es de ${money(expected.amount, expected.currency)}: faltan ${money(-diff, expected.currency)}.`,
        { paid: reading.amount, expected: expected.amount, currency: expected.currency },
      );
    } else if (!within) {
      add(
        "amount_high",
        "info",
        `El comprobante dice ${money(reading.amount, expected.currency)}, más que el pedido (${money(expected.amount, expected.currency)}).`,
      );
    }
  }

  // A quién se le pagó.
  const dest = destinationMatch(reading, facts);
  if (dest.match === "different") {
    add(
      "destination_mismatch",
      "danger",
      `El pago fue a ${reading.destination}, que no es ${dest.own ? `tu cuenta (${dest.own})` : "tu cuenta"}.`,
    );
  } else if (dest.match === "partial") {
    add(
      "destination_mismatch",
      "warning",
      `El destino que se ve (${reading.destination}) no parece ser ${dest.own ? `el tuyo (${dest.own})` : "el tuyo"}.`,
    );
  }
  const ownId = facts.storeAccount?.cedula;
  if (reading.recipientId && ownId) {
    const idMatch = compareDigits(reading.recipientId, ownId, Math.min(7, digitsOf(ownId).length));
    // Advertencia y no alarma: hay tiendas que cargan el RIF de la empresa y
    // cobran en la cuenta del dueño, o al revés.
    if (idMatch === "different") {
      add("recipient_id_mismatch", "warning", `Quien recibió tiene la cédula o RIF ${reading.recipientId}, no ${ownId}.`);
    }
  }

  if (
    facts.method &&
    reading.method !== "unknown" &&
    reading.method !== "other" &&
    !sameMethodFamily(reading.method, facts.method)
  ) {
    add(
      "method_mismatch",
      "warning",
      `El comprobante parece de ${METHOD_LABEL[reading.method]} y el cliente eligió ${METHOD_LABEL[facts.method as ProofMethod] ?? facts.method}.`,
    );
  }

  // Fecha. Una captura de hace días es la señal típica de un comprobante viejo
  // reciclado; el día anterior no, porque hay quien paga y después hace el
  // pedido, o paga pasada la medianoche.
  if (reading.date) {
    const orderDay = veDate(facts.createdAt);
    const today = veDate(now);
    if (daysBetween(reading.date, today) > 1) {
      add("date_future", "warning", `La fecha del comprobante (${dayLabel(reading.date)}) es posterior a hoy.`);
    } else if (daysBetween(orderDay, reading.date) >= 2) {
      add(
        "date_old",
        "warning",
        `El comprobante es del ${dayLabel(reading.date)} y el pedido es del ${dayLabel(orderDay)}.`,
      );
    }
  }

  // Referencia.
  const readRef = referenceKey(reading.reference);
  if (!readRef) {
    add("reference_unreadable", "info", "No se pudo leer la referencia.");
  } else {
    const typed = referenceKey(facts.typedReference);
    // El cliente suele escribir solo los últimos dígitos.
    if (typed && !readRef.endsWith(typed) && !typed.endsWith(readRef)) {
      add(
        "reference_mismatch",
        "warning",
        `El cliente escribió la referencia ${facts.typedReference}, y la captura dice ${reading.reference}.`,
      );
    }
    if (dup.referenceOrderNumber !== null) {
      add("reference_reused", "danger", `La misma referencia ya está en el pedido #${dup.referenceOrderNumber}.`);
    } else if (dup.referenceElsewhere) {
      add("reference_reused_elsewhere", "warning", "La misma referencia ya se usó para pagar en otra tienda.");
    }
  }

  if (reading.editSigns.length > 0) {
    add(
      "edit_signs",
      "warning",
      `Puede estar editada: ${reading.editSigns.slice(0, 3).join("; ")}.`,
    );
  }

  return finish(flags);
}

const SEVERITY_ORDER: Record<ProofFlagSeverity, number> = { danger: 0, warning: 1, info: 2 };

function finish(flags: ProofFlag[]): { verdict: ProofVerdict; flags: ProofFlag[] } {
  flags.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const verdict: ProofVerdict = flags.some((f) => f.severity === "danger")
    ? "suspicious"
    : flags.some((f) => f.severity === "warning")
      ? "review"
      : "ok";
  return { verdict, flags };
}

/**
 * Lo único que ve el CLIENTE de la lectura: lo que le sirve para corregir un
 * error honesto. Nunca las alertas de fraude (captura editada, repetida, otro
 * destino): decirle a quien hizo trampa qué regla lo atrapó solo le enseña a
 * esquivarla.
 */
export type BuyerProofNotice =
  | { kind: "amount_low"; paid: number; expected: number; currency: "VES" | "USD" }
  | { kind: "not_receipt" };

export function buyerNotice(flags: ProofFlag[]): BuyerProofNotice | null {
  const low = flags.find((f) => f.code === "amount_low");
  if (low && low.paid !== undefined && low.expected !== undefined && low.currency) {
    return { kind: "amount_low", paid: low.paid, expected: low.expected, currency: low.currency };
  }
  if (flags.some((f) => f.code === "not_receipt")) return { kind: "not_receipt" };
  return null;
}

/** Lo que el panel muestra de una lectura. */
export interface ProofCheckView {
  status: "reading" | "done" | "failed";
  verdict: ProofVerdict | null;
  reading: ProofReading | null;
  flags: ProofFlag[];
  /** Se puede volver a intentar (falló y no se agotaron los intentos). */
  canRetry: boolean;
}
