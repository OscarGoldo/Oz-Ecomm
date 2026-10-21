import "server-only";

import { recordPlatformEvent } from "@/lib/platform-events";
import { reportError } from "@/lib/report-error";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lo que cuida la plata que se gasta en IA. El diseñador y la carga con fotos
 * llaman a Claude con la clave de Anthropic de Tiendify, y cada llamada cuesta
 * aunque falle.
 *
 * Tres frenos:
 *
 *  1. Los cupos de cada tienda se cumplen de verdad. Antes se contaba, se
 *     llamaba a la IA (unos 20 s) y recién al final se anotaba el uso: varios
 *     pedidos a la vez pasaban todos el conteo y se saltaban el cupo, incluso
 *     el "un diseño gratis". Ahora el intento se anota ANTES de llamar
 *     (`reserveAiCall`) y se cuentan los que hay hasta el propio: el que queda
 *     afuera del cupo borra su fila y no llama.
 *  2. Un tope de gasto para toda la plataforma cada 24 h, calculado con los
 *     tokens reales al precio de la API. Si una cuenta abusa o el día viene
 *     muy movido, la IA se apaga sola hasta que baje, y avisa por Telegram una
 *     vez por día.
 *  3. Un tope por mes calendario (en hora UTC), con la misma cuenta. Es el
 *     techo de la factura: el del día solo, todos los días en el tope, deja
 *     pasar US$300 en un mes. Avisa por Telegram al llegar al 80 %, para
 *     subirlo antes de que se apague, y otra vez si se apaga.
 *
 * Si además está puesto el límite mensual en la consola de Anthropic, ese
 * queda como la red de abajo de todo.
 */

export type AiKind = "design" | "product_photo";

/** Precio de Claude Opus 5.5 en US$ por millón de tokens (tarifa de la API). */
const PRICE_PER_MTOK = { input: 4, output: 20 } as const;

/**
 * Lo que se aparta por cada llamada en curso, mientras no se sabe su costo
 * real. Un poco por encima de lo medido: un diseño ronda US$0,08 y una foto
 * bastante menos.
 */
const PENDING_USD: Record<AiKind, number> = { design: 0.15, product_photo: 0.05 };

/**
 * Una reserva que sigue sin tokens después de esto se da por muerta (la
 * función se cortó antes de terminar): deja de apartar plata y no le gasta el
 * cupo a nadie. Las llamadas tienen techo de 100 s, así que sobra.
 */
const PENDING_TTL_MS = 5 * 60_000;

const DAY_MS = 86_400_000;

/** Topes por defecto para toda la plataforma, en US$. */
const DEFAULT_DAILY_BUDGET_USD = 10;
const DEFAULT_MONTHLY_BUDGET_USD = 50;

/** Pasada esta parte del tope del mes, avisa (una vez por mes). */
const MONTHLY_WARNING_SHARE = 0.8;

/**
 * Los topes vigentes. Se cambian con `AI_DAILY_BUDGET_USD` y
 * `AI_MONTHLY_BUDGET_USD` en Vercel (con un redeploy), sin tocar código.
 */
export function aiDailyBudgetUsd(): number {
  return budgetFromEnv(process.env.AI_DAILY_BUDGET_USD, DEFAULT_DAILY_BUDGET_USD);
}

export function aiMonthlyBudgetUsd(): number {
  return budgetFromEnv(process.env.AI_MONTHLY_BUDGET_USD, DEFAULT_MONTHLY_BUDGET_USD);
}

function budgetFromEnv(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Lo que costó una llamada, en US$. */
export function aiCallCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * PRICE_PER_MTOK.input + outputTokens * PRICE_PER_MTOK.output) / 1_000_000;
}

/**
 * Filtro de PostgREST (para `.or()`) de las filas que gastan cupo entre las
 * que salieron bien: las que terminaron (tienen tokens) y las que siguen en
 * curso. Una reserva muerta no cuenta.
 */
export function aiUsedFilter(now = Date.now()): string {
  return `input_tokens.gt.0,created_at.gte.${new Date(now - PENDING_TTL_MS).toISOString()}`;
}

/** Un cupo de la tienda: cuántos intentos caben en una ventana. */
export interface AiLimit {
  /** Hacia atrás desde ahora; null = desde siempre. */
  windowMs: number | null;
  max: number;
  /** Cuenta solo los que salieron bien (y los que siguen en curso). */
  okOnly?: boolean;
}

/** "platform" es el tope del día; "platform_month", el del mes. */
type PlatformRefusal = "platform" | "platform_month";

export type AiReservation =
  | { ok: true; id: string }
  | { ok: false; reason: "store" | PlatformRefusal | "error" };

type Db = ReturnType<typeof createAdminClient>;

/**
 * Anota el intento y verifica los cupos. Si devuelve `ok`, quien llama hace
 * la llamada a la IA y la cierra con `finishAiCall`; si no, no llama.
 */
export async function reserveAiCall(input: {
  storeId: string;
  kind: AiKind;
  model: string;
  limits: AiLimit[];
}): Promise<AiReservation> {
  const db = createAdminClient();
  const { data: row, error } = await db
    .from("ai_generations")
    .insert({
      store_id: input.storeId,
      kind: input.kind,
      model: input.model,
      ok: true,
      input_tokens: 0,
      output_tokens: 0,
    })
    .select("id, created_at")
    .single();
  if (error || !row) {
    reportError("reserveAiCall", new Error(error?.message ?? "sin fila"), {
      storeId: input.storeId,
      kind: input.kind,
    });
    return { ok: false, reason: "error" };
  }

  const refuse = async (reason: "store" | PlatformRefusal | "error"): Promise<AiReservation> => {
    await releaseAiCall(row.id);
    return { ok: false, reason };
  };

  const now = Date.now();

  // Cupos de la tienda: los intentos hasta el propio, este incluido. Contar
  // hasta `created_at` y no todos es lo que decide quién llegó primero cuando
  // dos pedidos entran a la vez: el segundo ve al primero, el primero no al
  // segundo.
  for (const limit of input.limits) {
    let query = db
      .from("ai_generations")
      .select("id", { count: "exact", head: true })
      .eq("store_id", input.storeId)
      .eq("kind", input.kind)
      .lte("created_at", row.created_at);
    if (limit.windowMs !== null) {
      query = query.gte("created_at", new Date(now - limit.windowMs).toISOString());
    }
    if (limit.okOnly) query = query.eq("ok", true).or(aiUsedFilter(now));
    const { count, error: countErr } = await query;
    if (countErr) {
      reportError("reserveAiCall:cupo", new Error(countErr.message), { storeId: input.storeId });
      return refuse("error");
    }
    if ((count ?? 0) > limit.max) return refuse("store");
  }

  // Topes de la plataforma, con este intento ya adentro.
  const budget = await checkPlatformBudget(db, now);
  if (budget !== "ok") return refuse(budget);

  return { ok: true, id: row.id };
}

/**
 * Para la IA que no pasa por `reserveAiCall`: la de las páginas ejemplo, que
 * es solo de los socios y tiene su propio techo por página. Igual cuenta para
 * los topes, y se frena con ellos. Si no se puede leer el gasto, deja pasar.
 */
export async function aiPlatformBudgetReached(): Promise<boolean> {
  const budget = await checkPlatformBudget(createAdminClient(), Date.now());
  return budget === "platform" || budget === "platform_month";
}

/** Revisa los topes del mes y del día, y avisa por Telegram si hace falta. */
async function checkPlatformBudget(db: Db, now: number): Promise<"ok" | PlatformRefusal | "error"> {
  const spent = await platformSpend(db, now);
  if (spent === null) return "error";
  const usd = (n: number) => Math.round(n * 100) / 100;
  const month = new Date(now).toISOString().slice(0, 7);

  // El del mes primero: si están pasados los dos, es el que dura más.
  const monthly = aiMonthlyBudgetUsd();
  if (spent.month > monthly) {
    await recordPlatformEvent({
      type: "ai.budget_reached",
      amount: usd(spent.month),
      title: "La IA llegó al tope de gasto del mes",
      detail: `El tope es US$${monthly} por mes. El diseñador, la carga con fotos y las páginas ejemplo quedan apagados hasta el 1 de ${nextMonthName(now)}. Se sube con AI_MONTHLY_BUDGET_USD en Vercel.`,
      url: "/super",
      dedupeKey: `ai-budget-month:${month}`,
    });
    return "platform_month";
  }
  if (spent.month > monthly * MONTHLY_WARNING_SHARE) {
    await recordPlatformEvent({
      type: "ai.budget_warning",
      amount: usd(spent.month),
      title: `La IA ya gastó el ${Math.round(MONTHLY_WARNING_SHARE * 100)} % del tope del mes`,
      detail: `El tope es US$${monthly} por mes. Si se pasa, la IA se apaga hasta el 1 de ${nextMonthName(now)}. Se sube con AI_MONTHLY_BUDGET_USD en Vercel.`,
      url: "/super",
      dedupeKey: `ai-budget-warning:${month}`,
    });
  }

  const daily = aiDailyBudgetUsd();
  if (spent.day > daily) {
    await recordPlatformEvent({
      type: "ai.budget_reached",
      amount: usd(spent.day),
      title: "La IA llegó al tope de gasto del día",
      detail: `El tope es US$${daily} cada 24 h. El diseñador, la carga con fotos y las páginas ejemplo quedan apagados hasta que baje. Se sube con AI_DAILY_BUDGET_USD en Vercel.`,
      url: "/super",
      dedupeKey: `ai-budget:${new Date(now).toISOString().slice(0, 10)}`,
    });
    return "platform";
  }

  return "ok";
}

/** El 1 del mes en curso, 00:00 UTC. */
function startOfMonthUtc(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** "noviembre": el mes en que vuelve la IA si se apagó por el tope del mes. */
function nextMonthName(now: number): string {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toLocaleDateString("es", {
    month: "long",
    timeZone: "UTC",
  });
}

/** Cierra la reserva con lo que de verdad pasó y costó. Nunca lanza. */
export async function finishAiCall(
  id: string,
  result: { ok: boolean; inputTokens: number; outputTokens: number },
): Promise<void> {
  const { error } = await createAdminClient()
    .from("ai_generations")
    .update({ ok: result.ok, input_tokens: result.inputTokens, output_tokens: result.outputTokens })
    .eq("id", id);
  if (error) reportError("finishAiCall", new Error(error.message), { id });
}

/** Devuelve la reserva sin usarla: no se llegó a llamar a la IA. Nunca lanza. */
export async function releaseAiCall(id: string): Promise<void> {
  const { error } = await createAdminClient().from("ai_generations").delete().eq("id", id);
  if (error) reportError("releaseAiCall", new Error(error.message), { id });
}

type SpendRow = {
  kind: string;
  ok: boolean;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
};

/**
 * Lo gastado en IA en toda la plataforma en las últimas 24 h y en el mes en
 * curso: lo terminado a precio real y lo que está en curso a precio estimado.
 * Una sola lectura para los dos. null = no se pudo leer, y entonces no se
 * llama (sin la cuenta no hay tope).
 */
async function platformSpend(db: Db, now: number): Promise<{ day: number; month: number } | null> {
  const dayStart = now - DAY_MS;
  const monthStart = startOfMonthUtc(now);
  const since = new Date(Math.min(dayStart, monthStart)).toISOString();
  try {
    const rows = await fetchAll<SpendRow>((from, to) =>
      db
        .from("ai_generations")
        .select("kind, ok, input_tokens, output_tokens, created_at")
        .gte("created_at", since)
        .order("id")
        .range(from, to),
    );
    let day = 0;
    let month = 0;
    for (const r of rows) {
      const at = new Date(r.created_at).getTime();
      let usd = 0;
      if (r.input_tokens > 0 || r.output_tokens > 0) {
        usd = aiCallCostUsd(r.input_tokens, r.output_tokens);
      } else if (r.ok && at >= now - PENDING_TTL_MS) {
        usd = PENDING_USD[r.kind as AiKind] ?? PENDING_USD.design;
      }
      if (at >= dayStart) day += usd;
      if (at >= monthStart) month += usd;
    }
    return { day, month };
  } catch (e) {
    reportError("platformSpend", e);
    return null;
  }
}

/** Todas las filas, de a mil (el tope de PostgREST por consulta). */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await page(rows.length, rows.length + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000 || rows.length >= 50_000) return rows;
  }
}
