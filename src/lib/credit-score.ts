import { emailKey, groupByCustomer, phoneKey } from "@/lib/customer-identity";

/**
 * El puntaje interno de crédito: qué tan confiable es cada tienda para el día
 * que Tiendify financie. Lo ven solo los socios en /super/credito; ninguna
 * tienda ve el suyo, y nada se le ofrece sin que el comerciante lo pida y lo
 * acepte.
 *
 * Son dos productos con la misma base:
 *   · Cuotas  — la tienda vende en cuotas (tipo Cashea / Afterpay) y el fondo
 *               le adelanta lo que el comprador todavía no pagó.
 *   · Adelanto — el fondo le adelanta plata a la tienda y la recupera con un
 *               % de sus ventas (tipo Shopify Capital).
 *
 * Todo sale de los pedidos, y casi todos los confirma el propio comerciante
 * (Pago Móvil, efectivo, Zelle). Por eso las señales que más pesan son las
 * difíciles de inventar: constancia en el tiempo, muchos compradores
 * distintos, que vuelvan a comprar, y lo cobrado con tarjeta, que pasó por
 * Tiendify. Las compras hechas con el teléfono o el correo del dueño no
 * cuentan.
 *
 * Es una función pura de los pedidos y la fecha: el mismo cálculo "a la fecha
 * de hace 30 días" da el puntaje que la tienda tenía entonces, sin guardar
 * historia aparte.
 */

/**
 * Tiendas que no se evalúan: las de prueba de Tiendify. Desde la migración
 * 0038 llevan `stores.demo` y se excluyen por eso (credit-server.ts); la lista
 * queda de respaldo por si la columna todavía no existe.
 */
export const CREDIT_EXCLUDED_SLUGS = new Set([
  "alfa-electronic",
  "retro-mania",
  "ozzie-steaks",
  "abigaile",
  "ovejita",
  "mr-cleaner",
]);

const DAY_MS = 86_400_000;
/** Un "mes" del puntaje: ventanas de 30 días hacia atrás, no meses de calendario. */
const PERIOD_DAYS = 30;
/** Cuántas ventanas mira el puntaje (6 meses). */
const PERIODS = 6;

/** Las reglas, en un solo lugar para el cálculo, la pantalla y la doc. */
export const CREDIT_RULES = {
  installments: {
    minScore: 55,
    minDaysSelling: 90,
    minMonthsWithSales: 3,
    minBuyers: 10,
    /** Qué parte de lo que vende al mes podría venderse a cuotas. */
    capacityShare: 0.3,
    capacityCap: 1_500,
    /** Lo que paga el comprador al llevarse el producto. */
    downPayment: 0.5,
  },
  advance: {
    minScore: 70,
    minDaysSelling: 180,
    minMonthsWithSales: 5,
    minAvgMonthly: 300,
    /** Ventas de los últimos 3 meses contra los 3 anteriores. */
    minTrendRatio: 0.6,
    /** El adelanto: hasta un mes de ventas promedio. */
    monthsOfSales: 1,
    cap: 2_000,
    fee: 0.12,
    holdback: 0.15,
  },
  /** Sin ventas en este tiempo, la tienda no califica para nada. */
  maxDaysSinceSale: 45,
  /** Si un solo comprador hizo más que esto de lo vendido, no califica. */
  maxTopBuyerShare: 0.5,
} as const;

export interface CreditOrder {
  total: number;
  /** ms desde epoch. */
  createdAt: number;
  /** Cuenta como venta (mismo criterio que SALES_STATUSES). */
  sale: boolean;
  /** Se cobró y después se canceló: la tienda no cumplió. */
  cancelledAfterPaid: boolean;
  /** Pagado con tarjeta: el cobro pasó por Tiendify, no lo declara la tienda. */
  verified: boolean;
  customer_phone: string;
  customer_email: string | null;
}

export interface CreditStoreInput {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  createdAt: string;
  /** WhatsApp y teléfono de la tienda: un pedido con ellos es del dueño. */
  ownerPhones: (string | null)[];
  ownerEmail: string | null;
  /** Lo que le pagó a Tiendify en planes, en toda su vida. */
  paidTiendify: number;
  orders: CreditOrder[];
}

export interface ScorePart {
  key: string;
  label: string;
  points: number;
  max: number;
  /** El dato que lo explica, en una línea. */
  detail: string;
}

export interface Requirement {
  label: string;
  ok: boolean;
  detail: string;
}

export interface Eligibility {
  eligible: boolean;
  requirements: Requirement[];
}

export interface CreditMetrics {
  daysSelling: number;
  monthsWithSales: number;
  /** Vendido en cada ventana de 30 días, de la más reciente a la más vieja. */
  monthly: number[];
  avgMonthly: number;
  sales6m: number;
  salesCount6m: number;
  lastSaleAt: number | null;
  buyers: number;
  repeatBuyers: number;
  topBuyerShare: number;
  verifiedShare: number;
  cancelledAfterPaid: number;
  selfOrders: number;
}

export type CreditLevel = "observacion" | "construccion" | "confiable" | "solida";

export const LEVEL_LABEL: Record<CreditLevel, string> = {
  observacion: "En observación",
  construccion: "En construcción",
  confiable: "Confiable",
  solida: "Sólida",
};

export interface CreditScore {
  score: number;
  level: CreditLevel;
  parts: ScorePart[];
  metrics: CreditMetrics;
  /** Lo que impide calificar aunque el puntaje dé. */
  blockers: string[];
  /** Lo que conviene saber pero no bloquea. */
  notices: string[];
  installments: Eligibility & {
    /** Ventas al mes que podría vender a cuotas. */
    monthlyCapacity: number;
    /** Lo que pondría el fondo de esas ventas (lo que falta después de la inicial). */
    fundExposure: number;
  };
  advance: Eligibility & {
    amount: number;
    repay: number;
    /** Meses estimados para devolverlo con la retención, al ritmo actual. */
    months: number | null;
  };
}

function levelOf(score: number): CreditLevel {
  if (score >= 70) return "solida";
  if (score >= 55) return "confiable";
  if (score >= 40) return "construccion";
  return "observacion";
}

/** Dólares sin centavos, con el mismo formato que `formatUSD`. */
const WHOLE_USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
export const usd = (n: number) => WHOLE_USD.format(Math.round(n));
const pct = (n: number) => `${Math.round(n * 100)}%`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function step(value: number, table: [number, number][]): number {
  for (const [min, pts] of table) if (value >= min) return pts;
  return 0;
}

/** El puntaje de una tienda tal como estaba en `asOf`. */
export function scoreStore(store: CreditStoreInput, asOf: number): CreditScore {
  const ownPhones = new Set(store.ownerPhones.map(phoneKey).filter(Boolean));
  const ownEmail = emailKey(store.ownerEmail);
  const isSelf = (o: CreditOrder) =>
    ownPhones.has(phoneKey(o.customer_phone)) ||
    (ownEmail !== null && emailKey(o.customer_email) === ownEmail);

  const known = store.orders.filter((o) => o.createdAt < asOf);
  const selfOrders = known.filter((o) => o.sale && isSelf(o)).length;
  const orders = known.filter((o) => !isSelf(o));
  const sales = orders.filter((o) => o.sale);

  const since = asOf - PERIODS * PERIOD_DAYS * DAY_MS;
  const recent = sales.filter((o) => o.createdAt >= since);

  const monthly = Array.from({ length: PERIODS }, (_, i) => {
    const to = asOf - i * PERIOD_DAYS * DAY_MS;
    const from = to - PERIOD_DAYS * DAY_MS;
    return sales
      .filter((o) => o.createdAt >= from && o.createdAt < to)
      .reduce((s, o) => s + o.total, 0);
  });
  const monthsWithSales = monthly.filter((m) => m > 0).length;
  const sales6m = monthly.reduce((s, m) => s + m, 0);
  const avgMonthly = sales6m / PERIODS;
  const last3 = monthly.slice(0, 3).reduce((s, m) => s + m, 0);
  const prev3 = monthly.slice(3).reduce((s, m) => s + m, 0);

  const firstSale = sales.reduce<number | null>(
    (min, o) => (min === null || o.createdAt < min ? o.createdAt : min),
    null,
  );
  const lastSaleAt = sales.reduce<number | null>(
    (max, o) => (max === null || o.createdAt > max ? o.createdAt : max),
    null,
  );
  const daysSelling = firstSale === null ? 0 : Math.floor((asOf - firstSale) / DAY_MS);

  // Compradores del último año: un cliente que volvió a los 8 meses también cuenta.
  const yearAgo = asOf - 365 * DAY_MS;
  const groups = groupByCustomer(sales.filter((o) => o.createdAt >= yearAgo));
  const buyers = groups.length;
  const repeatBuyers = groups.filter((g) => g.length >= 2).length;

  const recentGroups = groupByCustomer(recent);
  const topBuyer = recentGroups.reduce(
    (max, g) => Math.max(max, g.reduce((s, o) => s + o.total, 0)),
    0,
  );
  const topBuyerShare = sales6m > 0 ? topBuyer / sales6m : 0;
  const verifiedShare =
    sales6m > 0 ? recent.filter((o) => o.verified).reduce((s, o) => s + o.total, 0) / sales6m : 0;

  const cancelled = orders.filter(
    (o) => o.cancelledAfterPaid && o.createdAt >= since,
  ).length;
  const settled = recent.length + cancelled;

  // ── Las partes del puntaje (suman 100) ─────────────────────────────────────
  const parts: ScorePart[] = [];

  parts.push({
    key: "tenure",
    label: "Antigüedad vendiendo",
    max: 15,
    points: Math.min(15, Math.floor((daysSelling / 365) * 15)),
    detail:
      firstSale === null
        ? "Todavía no tiene ventas"
        : `Vende hace ${plural(daysSelling, "día", "días")} (puntaje completo al año)`,
  });

  parts.push({
    key: "constancy",
    label: "Constancia",
    max: 20,
    points: Math.round((monthsWithSales / PERIODS) * 20),
    detail: `Vendió en ${monthsWithSales} de los últimos ${PERIODS} meses`,
  });

  parts.push({
    key: "volume",
    label: "Volumen",
    max: 20,
    points: step(avgMonthly, [
      [3_000, 20],
      [1_000, 15],
      [300, 10],
      [100, 5],
    ]),
    detail: `${usd(avgMonthly)} al mes en promedio (6 meses)`,
  });

  let trendPts = 0;
  let trendDetail: string;
  if (last3 === 0) {
    trendDetail = "Sin ventas en los últimos 3 meses";
  } else if (prev3 === 0) {
    trendPts = 4;
    trendDetail = "Empezando: no hay 3 meses anteriores para comparar";
  } else {
    const ratio = last3 / prev3;
    trendPts = step(ratio, [
      [1.1, 10],
      [0.9, 7],
      [0.6, 3],
    ]);
    trendDetail = `Últimos 3 meses: ${ratio >= 1 ? "+" : "−"}${pct(Math.abs(ratio - 1))} contra los 3 anteriores`;
  }
  parts.push({ key: "trend", label: "Tendencia", max: 10, points: trendPts, detail: trendDetail });

  // Con pocos pedidos "cero cancelaciones" no dice nada: el puntaje llega
  // completo recién con 10 pedidos cerrados.
  const cancelRate = settled > 0 ? cancelled / settled : 0;
  const fulfilment =
    settled === 0
      ? 0
      : Math.round(
          step(1 - cancelRate, [
            [0.95, 10],
            [0.9, 7],
            [0.8, 3],
          ]) * Math.min(1, settled / 10),
        );
  parts.push({
    key: "fulfilment",
    label: "Cumplimiento",
    max: 10,
    points: fulfilment,
    detail:
      settled === 0
        ? "Sin pedidos para medir"
        : cancelled === 0
          ? settled === 1
            ? "Su único pedido no se canceló después de cobrado"
            : `Ninguno de sus ${settled} pedidos se canceló después de cobrado`
          : `${cancelled} de ${settled} pedidos se cancelaron después de cobrados`,
  });

  const diversity = step(buyers, [
    [30, 8],
    [15, 6],
    [8, 4],
    [3, 2],
  ]);
  const repeatShare = buyers > 0 ? repeatBuyers / buyers : 0;
  const loyalty =
    buyers < 5
      ? 0
      : step(repeatShare, [
          [0.25, 7],
          [0.15, 5],
          [0.05, 3],
          [0.0001, 1],
        ]);
  parts.push({
    key: "customers",
    label: "Clientes",
    max: 15,
    points: diversity + loyalty,
    detail: `${plural(buyers, "comprador distinto", "compradores distintos")} en el año, ${plural(repeatBuyers, "volvió", "volvieron")} a comprar`,
  });

  parts.push({
    key: "verified",
    label: "Ventas verificadas",
    max: 5,
    points: step(verifiedShare, [
      [0.3, 5],
      [0.1, 3],
      [0.0001, 1],
    ]),
    detail: `${pct(verifiedShare)} de lo vendido se cobró con tarjeta por Tiendify`,
  });

  parts.push({
    key: "pays",
    label: "Le paga a Tiendify",
    max: 5,
    points: store.paidTiendify > 0 ? 5 : 0,
    detail:
      store.paidTiendify > 0
        ? `Ha pagado ${usd(store.paidTiendify)} en planes`
        : "Nunca ha pagado un plan",
  });

  const score = parts.reduce((s, p) => s + p.points, 0);

  // ── Lo que bloquea y lo que avisa ──────────────────────────────────────────
  const blockers: string[] = [];
  const notices: string[] = [];
  if (!store.active) blockers.push("La tienda está pausada o cerrada");
  const daysSinceSale =
    lastSaleAt === null ? null : Math.floor((asOf - lastSaleAt) / DAY_MS);
  if (daysSinceSale === null || daysSinceSale > CREDIT_RULES.maxDaysSinceSale) {
    blockers.push(
      daysSinceSale === null
        ? "Nunca ha vendido"
        : `No vende hace ${daysSinceSale} días`,
    );
  }
  if (recent.length > 0 && topBuyerShare > CREDIT_RULES.maxTopBuyerShare) {
    blockers.push(
      `Un solo comprador hizo el ${pct(topBuyerShare)} de lo vendido en 6 meses`,
    );
  }
  if (selfOrders > 0) {
    notices.push(
      `${plural(selfOrders, "venta", "ventas")} con el teléfono o el correo de la propia tienda: no ${selfOrders === 1 ? "cuenta" : "cuentan"}`,
    );
  }

  // ── Cuotas ─────────────────────────────────────────────────────────────────
  const ir = CREDIT_RULES.installments;
  const installmentsReqs: Requirement[] = [
    {
      label: `Puntaje de ${ir.minScore} o más`,
      ok: score >= ir.minScore,
      detail: `Tiene ${score}`,
    },
    {
      label: `${ir.minDaysSelling} días vendiendo`,
      ok: daysSelling >= ir.minDaysSelling,
      detail: `Lleva ${daysSelling}`,
    },
    {
      label: `Ventas en ${ir.minMonthsWithSales} de los últimos 6 meses`,
      ok: monthsWithSales >= ir.minMonthsWithSales,
      detail: `Vendió en ${monthsWithSales}`,
    },
    {
      label: `${ir.minBuyers} compradores distintos`,
      ok: buyers >= ir.minBuyers,
      detail: `Tiene ${buyers}`,
    },
  ];
  const installmentsOk = installmentsReqs.every((r) => r.ok) && blockers.length === 0;
  const monthlyCapacity = Math.min(
    ir.capacityCap,
    Math.floor((avgMonthly * ir.capacityShare) / 10) * 10,
  );

  // ── Adelanto ───────────────────────────────────────────────────────────────
  const ar = CREDIT_RULES.advance;
  const trendOk = prev3 > 0 && last3 >= prev3 * ar.minTrendRatio;
  const advanceReqs: Requirement[] = [
    {
      label: `Puntaje de ${ar.minScore} o más`,
      ok: score >= ar.minScore,
      detail: `Tiene ${score}`,
    },
    {
      label: `${ar.minDaysSelling} días vendiendo`,
      ok: daysSelling >= ar.minDaysSelling,
      detail: `Lleva ${daysSelling}`,
    },
    {
      label: `Ventas en ${ar.minMonthsWithSales} de los últimos 6 meses`,
      ok: monthsWithSales >= ar.minMonthsWithSales,
      detail: `Vendió en ${monthsWithSales}`,
    },
    {
      label: `${usd(ar.minAvgMonthly)} al mes en promedio`,
      ok: avgMonthly >= ar.minAvgMonthly,
      detail: `Vende ${usd(avgMonthly)}`,
    },
    {
      label: `Ventas sin caer más de ${pct(1 - ar.minTrendRatio)}`,
      ok: trendOk,
      detail: prev3 > 0 ? trendDetail : "Sin 6 meses para comparar",
    },
  ];
  const advanceOk = advanceReqs.every((r) => r.ok) && blockers.length === 0;
  const amount = Math.min(ar.cap, Math.floor((avgMonthly * ar.monthsOfSales) / 50) * 50);
  const repay = Math.round(amount * (1 + ar.fee));
  const monthlyHoldback = avgMonthly * ar.holdback;

  return {
    score,
    level: levelOf(score),
    parts,
    metrics: {
      daysSelling,
      monthsWithSales,
      monthly,
      avgMonthly,
      sales6m,
      salesCount6m: recent.length,
      lastSaleAt,
      buyers,
      repeatBuyers,
      topBuyerShare,
      verifiedShare,
      cancelledAfterPaid: cancelled,
      selfOrders,
    },
    blockers,
    notices,
    installments: {
      eligible: installmentsOk,
      requirements: installmentsReqs,
      monthlyCapacity,
      fundExposure: Math.round(monthlyCapacity * (1 - ir.downPayment)),
    },
    advance: {
      eligible: advanceOk,
      requirements: advanceReqs,
      amount,
      repay,
      months: monthlyHoldback > 0 && amount > 0 ? repay / monthlyHoldback : null,
    },
  };
}
