import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Activity,
  ArrowRight,
  CircleCheck,
  CircleDollarSign,
  Gift,
  MessageCircle,
  MessageSquare,
  Receipt,
  Send,
  Store as StoreIcon,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import {
  ChartScroll,
  Funnel,
  MethodBars,
  MrrChart,
  PlanDonut,
  SERIES,
  ShareBar,
  SignupsChart,
  Sparkline,
  type SignupWeek,
} from "@/components/admin/super-charts";
import { TelegramTestButton } from "@/components/admin/telegram-test-button";
import { Badge } from "@/components/ui/badge";
import { requireSuperAdmin } from "@/lib/auth";
import { formatUSD } from "@/lib/format";
import { isPro } from "@/lib/plans";
import {
  EVENT_GROUP,
  getRecentEvents,
  type EventGroup,
} from "@/lib/platform-events";
import { createClient } from "@/lib/supabase/server";
import { agoShort, agoTime, planBadge, shortDate } from "@/lib/super-format";
import {
  DORMANT_DAYS,
  EXPIRING_DAYS,
  originLabel,
  segmentsOf,
  type StoreSegment,
  type StoreStat,
} from "@/lib/super-segments";
import { getStoreStats, getSuperCharts, getSuperOverview } from "@/lib/super-stats";
import { telegramConfigured } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp";

export const metadata = { title: "Inicio" };

/** Los períodos que se pueden comparar. */
const PERIODS = [7, 30, 90, 365] as const;
const PERIOD_LABEL: Record<(typeof PERIODS)[number], string> = {
  7: "7 d",
  30: "30 d",
  90: "90 d",
  365: "12 m",
};
/** Cuántas tiendas entran en cada lista antes de mandar a la tabla. */
const LIST_LIMIT = 6;
/** Semanas del gráfico de tiendas nuevas. */
const SIGNUP_WEEKS = 12;

/** Variación contra el período anterior. null si antes fue cero. */
function pct(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

interface Risk {
  store: StoreStat;
  kind: Extract<StoreSegment, "failed" | "expiring" | "dormant">;
  reason: string;
}

const RISK_BADGE: Record<
  Risk["kind"],
  { label: string; variant: "danger" | "warning" }
> = {
  failed: { label: "Cobro fallido", variant: "danger" },
  expiring: { label: "Vence", variant: "danger" },
  dormant: { label: "Dormida", variant: "warning" },
};

/** Cada grupo de la actividad con su color: el mismo en el ícono y la leyenda. */
const EVENT_STYLE: Record<EventGroup, { icon: LucideIcon; label: string; tint: string }> = {
  clientes: { icon: StoreIcon, label: "Clientes", tint: "bg-brand-50 text-brand-700" },
  dinero: { icon: CircleDollarSign, label: "Dinero", tint: "bg-[#DDF5EC] text-[#0F6B4A]" },
  pagos: { icon: Send, label: "Pagos", tint: "bg-[#FDEBDF] text-[#9A3412]" },
  crecimiento: { icon: Gift, label: "Crecimiento", tint: "bg-[#ECE9FB] text-[#4A3AA7]" },
  alerta: { icon: TriangleAlert, label: "Alertas", tint: "bg-destructive-surface text-destructive-text" },
};

/**
 * La portada del super admin, la vista de los socios. Responde, en este orden:
 * qué nos toca hacer, cómo vamos (MRR, ingreso, tiendas que pagan, lo que
 * venden), de dónde salen las tiendas y dónde se traban, cómo entra la plata,
 * y a quién hay que escribirle antes de perderlo.
 */
export default async function SuperHomePage({
  searchParams,
}: {
  searchParams: { d?: string | string[] };
}) {
  await requireSuperAdmin();

  const requested = Number(
    Array.isArray(searchParams.d) ? searchParams.d[0] : searchParams.d,
  );
  const days = PERIODS.find((p) => p === requested) ?? 30;

  const supabase = createClient();
  const [
    overview,
    { stores, complete },
    charts,
    { count: pendingSubs },
    { count: pendingReferrals },
    { count: unreadFeedback },
    events,
  ] = await Promise.all([
    getSuperOverview(days),
    getStoreStats(),
    getSuperCharts(days),
    supabase
      .from("subscription_payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("status", "qualified"),
    supabase
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
    getRecentEvents(10),
  ]);

  const now = new Date();
  const telegramOn = telegramConfigured();

  // El punto de hoy del MRR es el exacto de super_overview.
  const mrrPoints = charts.mrrByMonth.map((p, i, all) =>
    i === all.length - 1 && overview ? { ...p, mrr: overview.mrr } : p,
  );
  const mrrPrevMonth = mrrPoints.length > 1 ? mrrPoints[mrrPoints.length - 2].mrr : 0;

  // A quién hay que escribirle. Cada tienda entra una sola vez, por su motivo
  // más urgente: un cobro fallido pesa más que un vencimiento, y los dos más
  // que estar dormida.
  const risks: Risk[] = [];
  for (const s of stores) {
    const seg = segmentsOf(s, now.getTime());
    const plan = planBadge(s, now);
    if (seg.includes("failed")) {
      risks.push({ store: s, kind: "failed", reason: "El cobro automático no pasó" });
    } else if (seg.includes("expiring")) {
      risks.push({
        store: s,
        kind: "expiring",
        reason: `${plan.label} · ${plan.sub ?? "vence pronto"}`,
      });
    } else if (complete && isPro(s) && seg.includes("dormant")) {
      risks.push({
        store: s,
        kind: "dormant",
        reason: s.last_activity_at
          ? `${plan.label} · sin actividad ${agoShort(s.last_activity_at, now)}`
          : `${plan.label} · nunca tuvo actividad`,
      });
    }
  }
  const riskOrder: Record<Risk["kind"], number> = { failed: 0, expiring: 1, dormant: 2 };
  risks.sort(
    (a, b) =>
      riskOrder[a.kind] - riskOrder[b.kind] ||
      // Dentro de cada grupo, primero la que vence antes o lleva más dormida.
      (a.kind === "expiring"
        ? Date.parse(a.store.plan_expires_at ?? "") -
          Date.parse(b.store.plan_expires_at ?? "")
        : Date.parse(a.store.last_activity_at ?? a.store.created_at) -
          Date.parse(b.store.last_activity_at ?? b.store.created_at)),
  );

  // Activas: se movieron (ingreso, pedido o producto) en los últimos 14 días.
  const activeCutoff = now.getTime() - DORMANT_DAYS * 86_400_000;
  const active = stores.filter(
    (s) => s.last_activity_at && Date.parse(s.last_activity_at) >= activeCutoff,
  ).length;

  // Tiendas nuevas por semana (lunes a domingo), según cómo llegaron. Una
  // referida que además trajo código cuenta como referida.
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weeks: SignupWeek[] = Array.from({ length: SIGNUP_WEEKS }, (_, i) => {
    const from = new Date(weekStart);
    from.setDate(from.getDate() - (SIGNUP_WEEKS - 1 - i) * 7);
    return {
      key: from.toISOString(),
      label: format(from, "d MMM", { locale: es }),
      organic: 0,
      promo: 0,
      referral: 0,
    };
  });
  const firstWeek = Date.parse(weeks[0].key);
  for (const s of stores) {
    const at = Date.parse(s.created_at);
    if (at < firstWeek) continue;
    const idx = Math.min(SIGNUP_WEEKS - 1, Math.floor((at - firstWeek) / (7 * 86_400_000)));
    const w = weeks[idx];
    if (s.referred_by) w.referral += 1;
    else if (s.promo_code) w.promo += 1;
    else w.organic += 1;
  }

  const storeById = new Map(stores.map((s) => [s.id, s]));
  const top = charts.topStores.flatMap((t) => {
    const s = storeById.get(t.storeId);
    return s ? [{ ...t, store: s }] : [];
  });
  const topMax = Math.max(1, ...top.map((t) => t.usd));
  const topShare =
    overview && overview.gmv > 0 ? (top.reduce((sum, t) => sum + t.usd, 0) / overview.gmv) * 100 : null;

  const newest = stores.slice(0, LIST_LIMIT);
  const net = overview ? overview.collected - overview.fees : 0;
  const netPrev = overview ? overview.collectedPrev - overview.feesPrev : 0;
  const free = overview ? Math.max(0, overview.stores - overview.paying - overview.comped) : 0;
  const prevLabel = days === 365 ? "los 12 meses previos" : `los ${days} d previos`;
  const collectedTotal = charts.collectedByMethod.reduce((s, m) => s + m.usd, 0);
  const gmvTotal = charts.gmvByMethod.reduce((s, m) => s + m.usd, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-landing-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            {format(now, "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <h1 className="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.028em]">
            Cómo va Tiendify
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-600">
            {days === 365
              ? "Últimos 12 meses frente a los 12 anteriores."
              : `Últimos ${days} días frente a los ${days} anteriores.`}
          </p>
        </div>
        <nav aria-label="Período" className="inline-flex rounded-[10px] border bg-card p-[3px]">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={p === 30 ? "/super" : `/super?d=${p}`}
              aria-current={p === days ? "true" : undefined}
              className={cn(
                "grid h-8 place-items-center rounded-lg px-3 text-[13px] font-semibold transition-colors",
                p === days ? "bg-noche text-white" : "text-ink-600 hover:text-foreground",
              )}
            >
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </nav>
      </header>

      {!overview && (
        <p className="rounded-xl border border-warning-border bg-warning-surface p-4 text-sm text-warning-text">
          Faltan los números del negocio (MRR, cobrado, embudo): aparecen al
          correr la migración{" "}
          <code className="font-landing-mono text-xs">0030_super_admin_stats.sql</code>{" "}
          en Supabase. Los pendientes de abajo ya son los reales.
        </p>
      )}

      <section aria-labelledby="por-hacer" className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-baseline justify-between gap-3 px-5 pb-1 pt-4">
          <h2 id="por-hacer" className="font-display text-lg font-bold tracking-[-0.02em]">
            Por hacer
          </h2>
          <span className="hidden text-[13px] text-ink-600 sm:inline">Lo que espera por un socio</span>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          <Todo
            href="/super/suscripciones"
            icon={Receipt}
            tint={pendingSubs ? "bg-sol text-noche" : "bg-ink-100 text-ink-600"}
            value={String(pendingSubs ?? 0)}
            label={
              pendingSubs
                ? `${pendingSubs === 1 ? "comprobante por aprobar" : "comprobantes por aprobar"}${
                    overview && overview.pendingSubsUsd > 0 ? ` · ${formatUSD(overview.pendingSubsUsd)}` : ""
                  }`
                : "comprobantes: al día"
            }
          />
          <Todo
            href="/super/pagos"
            icon={Send}
            tint="bg-[#FDEBDF] text-[#9A3412]"
            value={overview ? formatUSD(overview.owed) : "—"}
            label={
              overview && overview.owedStores > 0
                ? `por pagar a ${overview.owedStores} ${overview.owedStores === 1 ? "tienda" : "tiendas"}`
                : "por pagar a tiendas"
            }
          />
          <Todo
            href="/super/referidos"
            icon={Gift}
            tint="bg-[#ECE9FB] text-[#4A3AA7]"
            value={String(pendingReferrals ?? 0)}
            label={pendingReferrals ? "referidos por decidir" : "referidos: al día"}
          />
          <Todo
            href="/super/comentarios"
            icon={MessageSquare}
            tint="bg-brand-50 text-brand-700"
            value={String(unreadFeedback ?? 0)}
            label={unreadFeedback ? "comentarios sin leer" : "comentarios: al día"}
          />
        </div>
      </section>

      {overview && (
        <section
          aria-label="Números del período"
          className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        >
          <Kpi
            label="MRR"
            color={SERIES.blue}
            value={formatUSD(overview.mrr)}
            delta={pct(overview.mrr, mrrPrevMonth)}
            sub={
              pct(overview.mrr, mrrPrevMonth) === null
                ? `al cierre del mes pasado: ${formatUSD(mrrPrevMonth)}`
                : "vs. el cierre del mes pasado"
            }
            spark={mrrPoints.map((p) => p.mrr)}
            sparkLabel="MRR de los últimos 12 meses"
          />
          <Kpi
            label="Ingreso neto"
            color={SERIES.aqua}
            value={formatUSD(net)}
            delta={pct(net, netPrev)}
            sub={
              overview.fees > 0
                ? `${formatUSD(overview.collected)} menos ${formatUSD(overview.fees)} de comisión`
                : pct(net, netPrev) === null
                  ? `${prevLabel}: ${formatUSD(netPrev)}`
                  : `vs. ${prevLabel}`
            }
          />
          <Kpi
            label="Tiendas pagando"
            color={SERIES.violet}
            value={String(overview.paying)}
            sub={`${overview.stores > 0 ? ((overview.paying / overview.stores) * 100).toFixed(1).replace(".", ",") : "0"}% del total${
              overview.comped > 0 ? ` · ${overview.comped} de cortesía` : ""
            }`}
          />
          <Kpi
            label="Vendido por las tiendas"
            color={SERIES.orange}
            value={formatUSD(overview.gmv)}
            delta={pct(overview.gmv, overview.gmvPrev)}
            sub={`${charts.salesCount} ${charts.salesCount === 1 ? "venta" : "ventas"}`}
          />
          <Kpi
            label="Tiendas activas"
            color={SERIES.magenta}
            value={complete ? String(active) : "—"}
            sub={
              complete && overview.stores > 0
                ? `${Math.round((active / overview.stores) * 100)}% se movió en ${DORMANT_DAYS} días`
                : "falta la migración 0030"
            }
          />
        </section>
      )}

      {overview && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card
            title="Ingreso recurrente mensual (MRR)"
            sub="Al cierre de cada mes: los mensuales más la doceava parte de los anuales."
          >
            <ChartScroll>
              <MrrChart points={mrrPoints} />
            </ChartScroll>
          </Card>
          <Card title="Tiendas por plan" sub="Cuántas pagan, cuántas tienen cortesía y cuántas siguen en Gratis.">
            <PlanDonut paying={overview.paying} comped={overview.comped} free={free} />
          </Card>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card
          title="Tiendas nuevas por semana"
          sub={`Últimas ${SIGNUP_WEEKS} semanas, según cómo llegaron.`}
          aside={
            <Legend
              items={[
                { label: "Llegaron solas", color: SERIES.blue },
                { label: "Con código", color: SERIES.orange },
                { label: "Referidas", color: SERIES.aqua },
              ]}
            />
          }
        >
          <ChartScroll>
            <SignupsChart weeks={weeks} />
          </ChartScroll>
        </Card>
        {overview && (
          <Card title="De registrarse a pagar" sub="Todas las tiendas, desde el lanzamiento.">
            <Funnel
              steps={[
                { label: "Se registraron", value: overview.stores },
                { label: "Subieron productos", value: overview.storesWithProducts },
                { label: "Tuvieron una venta", value: overview.storesWithSale },
                { label: "Pagan Pro", value: overview.paying },
              ]}
            />
          </Card>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Cómo nos pagan las tiendas"
          sub="Planes cobrados en el período, por método."
          aside={<span className="font-landing-mono font-semibold tabular-nums">{formatUSD(collectedTotal)}</span>}
        >
          <ShareBar items={charts.collectedByMethod} />
        </Card>
        <Card
          title="Cómo les pagan a las tiendas"
          sub="Ventas de todas las tiendas en el período, por método del cliente."
          aside={<span className="font-landing-mono font-semibold tabular-nums">{formatUSD(gmvTotal)}</span>}
        >
          <MethodBars items={charts.gmvByMethod} />
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ListCard
          title="En riesgo"
          sub="A quién escribirle antes de perderlo."
          link={risks.length > LIST_LIMIT ? { href: "/super/tiendas?f=expiring", label: `Ver las ${risks.length}` } : undefined}
        >
          {risks.length === 0 ? (
            <Empty icon={CircleCheck} title="Nadie por perderse">
              Ningún Pro vence en {EXPIRING_DAYS} días sin cobro automático,
              tiene un cobro fallido o lleva {DORMANT_DAYS} días sin actividad.
            </Empty>
          ) : (
            <ul className="divide-y divide-ink-100">
              {risks.slice(0, LIST_LIMIT).map(({ store, kind, reason }) => {
                const wa = whatsappUrl(store.whatsapp);
                return (
                  <li key={store.id} className="flex items-center gap-3 px-5 py-3">
                    <StoreAvatar name={store.name} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/super/tiendas/${store.id}`} className="block truncate font-semibold hover:underline">
                        {store.name}
                      </Link>
                      <p className="truncate text-[13px] text-ink-600">{reason}</p>
                    </div>
                    <Badge variant={RISK_BADGE[kind].variant}>{RISK_BADGE[kind].label}</Badge>
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid size-9 shrink-0 place-items-center rounded-lg border border-input text-ink-600 transition-colors hover:bg-ink-50 hover:text-foreground"
                        aria-label={`Escribirle a ${store.name} por WhatsApp`}
                      >
                        <MessageCircle className="size-4" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {risks.length > 0 && (
            <p className="border-t px-5 py-3 text-[13px] text-ink-600">
              En la tabla: <RiskLink segment="expiring">las que vencen</RiskLink>
              {" · "}
              <RiskLink segment="failed">cobros fallidos</RiskLink>
              {" · "}
              <RiskLink segment="dormant">dormidas</RiskLink>
            </p>
          )}
        </ListCard>

        <ListCard
          title="Las que más venden"
          sub={
            topShare !== null && top.length > 0
              ? `En el período. Estas ${top.length} hacen el ${Math.round(topShare)}% de lo vendido.`
              : "En el período."
          }
          link={{ href: "/super/tiendas", label: "Ver tiendas" }}
        >
          {top.length === 0 ? (
            <Empty icon={Activity} title="Sin ventas en el período">
              Cuando las tiendas vendan, acá aparecen las que más.
            </Empty>
          ) : (
            <ol className="divide-y divide-ink-100">
              {top.map((t, i) => {
                const plan = planBadge(t.store, now);
                return (
                  <li key={t.storeId} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-4 font-landing-mono text-[13px] text-ink-500">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <Link href={`/super/tiendas/${t.storeId}`} className="truncate font-semibold hover:underline">
                          {t.store.name}
                        </Link>
                        <span className="font-landing-mono text-sm font-semibold tabular-nums">{formatUSD(t.usd)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="h-1.5 flex-1 rounded-full bg-surface">
                          <span
                            className="block h-1.5 rounded-full"
                            style={{ width: `${(t.usd / topMax) * 100}%`, background: SERIES.blue }}
                          />
                        </span>
                        <span className="w-20 text-right text-xs text-ink-600">
                          {t.orders} {t.orders === 1 ? "venta" : "ventas"}
                        </span>
                      </div>
                    </div>
                    <Badge variant={plan.variant}>{plan.label}</Badge>
                  </li>
                );
              })}
            </ol>
          )}
        </ListCard>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ListCard
          title="Actividad reciente"
          aside={
            telegramOn ? (
              <TelegramTestButton />
            ) : (
              <span className="text-xs text-ink-600">Telegram sin conectar</span>
            )
          }
        >
          {events === null ? (
            <p className="m-5 rounded-xl border border-warning-border bg-warning-surface p-4 text-sm text-warning-text">
              La actividad aparece al correr la migración{" "}
              <code className="font-landing-mono text-xs">0031_platform_events.sql</code>{" "}
              en Supabase.
            </p>
          ) : events.length === 0 ? (
            <Empty icon={Activity} title="Todavía no pasó nada">
              Acá y en Telegram aparecen pagos, tiendas nuevas, comprobantes y
              alertas apenas pasan.
            </Empty>
          ) : (
            <ul className="divide-y divide-ink-100">
              {events.map((e) => {
                const group = EVENT_GROUP[e.type] ?? "clientes";
                const style = EVENT_STYLE[group];
                const Icon = style.icon;
                const body = (
                  <>
                    <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", style.tint)}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{e.title}</span>
                        {e.amount != null && (
                          <span className="shrink-0 font-landing-mono text-sm tabular-nums">
                            {formatUSD(e.amount)}
                          </span>
                        )}
                      </span>
                      {e.detail && (
                        <span className="block truncate text-[13px] text-ink-600">{e.detail}</span>
                      )}
                      <span className="block text-xs text-ink-500">
                        {style.label} · {agoTime(e.created_at, now)}
                      </span>
                    </span>
                  </>
                );
                const rowClass = "flex items-start gap-3 px-5 py-3 transition-colors hover:bg-ink-25";
                return (
                  <li key={e.id}>
                    {!e.url ? (
                      <div className={rowClass}>{body}</div>
                    ) : e.url.startsWith("/") ? (
                      <Link href={e.url} className={rowClass}>
                        {body}
                      </Link>
                    ) : (
                      <a href={e.url} target="_blank" rel="noopener noreferrer" className={rowClass}>
                        {body}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ListCard>

        <ListCard
          title="Últimas tiendas"
          sub="Cuánto llevan andado: productos, primera venta, Pro."
          link={{ href: "/super/tiendas", label: "Ver todas" }}
        >
          {newest.length === 0 ? (
            <Empty icon={StoreIcon} title="Todavía no hay tiendas" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {newest.map((s) => {
                const origin = originLabel(s);
                const steps = [s.products > 0, s.sales > 0, isPro(s)];
                return (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <StoreAvatar name={s.name} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/super/tiendas/${s.id}`} className="block truncate font-semibold hover:underline">
                        {s.name}
                      </Link>
                      <p className="truncate text-[13px] text-ink-600">
                        {shortDate(s.created_at, now)} · {origin ?? "llegó sola"}
                      </p>
                    </div>
                    <span
                      className="flex gap-1"
                      title={`${steps[0] ? "Con productos" : "Sin productos"} · ${steps[1] ? "con ventas" : "sin ventas"} · ${steps[2] ? "en Pro" : "en Gratis"}`}
                      aria-label={`${steps[0] ? "con productos" : "sin productos"}, ${steps[1] ? "con ventas" : "sin ventas"}, ${steps[2] ? "en Pro" : "en Gratis"}`}
                    >
                      {steps.map((done, i) => (
                        <span key={i} className={cn("h-1.5 w-4 rounded-full", done ? "bg-brand-600" : "bg-ink-100")} />
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </ListCard>
      </div>
    </div>
  );
}

/* --- Piezas ------------------------------------------------------------------- */

function Todo({
  href,
  icon: Icon,
  tint,
  value,
  label,
}: {
  href: string;
  icon: LucideIcon;
  tint: string;
  value: string;
  label: string;
}) {
  return (
    <Link href={href} className="group flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-ink-25">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-[10px]", tint)}>
        <Icon className="size-[1.125rem]" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[1.4rem] font-bold leading-none tracking-[-0.02em] tabular-nums">
          {value}
        </span>
        <span className="mt-1 block truncate text-[13px] text-ink-600">{label}</span>
      </span>
      <ArrowRight className="ml-auto size-4 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Kpi({
  label,
  color,
  value,
  delta,
  sub,
  spark,
  sparkLabel,
}: {
  label: string;
  color: string;
  value: string;
  delta?: number | null;
  sub: string;
  spark?: number[];
  sparkLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border bg-card px-[18px] py-4">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-600">
        <span className="size-2 shrink-0 rounded-[3px]" style={{ background: color }} />
        {label}
      </p>
      <div className="flex items-end justify-between gap-2">
        <p className="font-display text-[1.75rem] font-bold leading-none tracking-[-0.03em] tabular-nums">{value}</p>
        {spark && spark.length > 1 && <Sparkline values={spark} color={color} label={sparkLabel ?? label} />}
      </div>
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-600">
        {delta != null && (
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-md px-1.5 font-landing-mono text-[11.5px] font-semibold tabular-nums",
              delta >= 0 ? "bg-success-surface text-success-text" : "bg-destructive-surface text-destructive-text",
            )}
          >
            {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1).replace(".", ",")}%
          </span>
        )}
        <span className="truncate">{sub}</span>
      </p>
    </div>
  );
}

function Card({
  title,
  sub,
  aside,
  children,
}: {
  title: string;
  sub?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold tracking-[-0.02em]">{title}</h2>
          {sub && <p className="mt-0.5 text-[13px] text-ink-600">{sub}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ListCard({
  title,
  sub,
  aside,
  link,
  children,
}: {
  title: string;
  sub?: string;
  aside?: React.ReactNode;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold tracking-[-0.02em]">{title}</h2>
          {sub && <p className="mt-0.5 text-[13px] text-ink-600">{sub}</p>}
        </div>
        {aside}
        {link && (
          <Link href={link.href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            {link.label} <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-600">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function Empty({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid place-items-center px-6 py-10 text-center">
      <Icon className="mb-2 size-7 text-ink-400" />
      <p className="text-sm font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-[40ch] text-[13px] text-ink-600">{children}</p>}
    </div>
  );
}

/** La inicial de la tienda en un cuadrado de color estable por nombre. */
const AVATAR_TONES = ["#0369A1", "#B45309", "#0F766E", "#BE185D", "#4D5B6B"];
function StoreAvatar({ name }: { name: string }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-[9px] text-[13px] font-extrabold text-white"
      style={{ background: AVATAR_TONES[h % AVATAR_TONES.length] }}
    >
      {name.trim().charAt(0).toUpperCase() || "T"}
    </span>
  );
}

function RiskLink({
  segment,
  children,
}: {
  segment: StoreSegment;
  children: React.ReactNode;
}) {
  return (
    <Link href={`/super/tiendas?f=${segment}`} className="font-semibold text-brand-700 hover:underline">
      {children}
    </Link>
  );
}
