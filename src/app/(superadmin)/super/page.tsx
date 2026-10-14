import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CircleCheck,
  CircleDollarSign,
  Gift,
  MessageCircle,
  MessageSquare,
  Receipt,
  Send,
  ShoppingBag,
  Store as StoreIcon,
  TrendingUp,
  TriangleAlert,
  UserPlus,
  Wallet,
} from "lucide-react";

import { StatCard } from "@/components/admin/stat-card";
import { TelegramTestButton } from "@/components/admin/telegram-test-button";
import { Badge } from "@/components/ui/badge";
import { requireSuperAdmin } from "@/lib/auth";
import { formatUSD } from "@/lib/format";
import type { Delta } from "@/lib/metrics";
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
import { getStoreStats, getSuperOverview } from "@/lib/super-stats";
import { telegramConfigured } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp";

export const metadata = { title: "Inicio" };

/** Los períodos que se pueden comparar. */
const PERIODS = [7, 30, 90] as const;
/** Cuántas tiendas entran en cada lista antes de mandar a la tabla. */
const LIST_LIMIT = 6;

function vsPrevious(
  current: number,
  previous: number,
  previousLabel: string,
  days: number,
): Delta {
  return {
    previousLabel,
    periodLabel: `los ${days} d previos`,
    // Desde cero no hay porcentaje: ver pctChange en metrics.ts.
    pct: previous > 0 ? ((current - previous) / previous) * 100 : null,
  };
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

/**
 * La portada del super admin. Responde, en este orden, lo que se pregunta
 * quien maneja Tiendify al abrirlo: qué me toca hacer, cómo vamos, y a quién
 * hay que escribirle antes de perderlo.
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
    { count: pendingSubs },
    { count: pendingReferrals },
    { count: unreadFeedback },
    events,
  ] = await Promise.all([
    getSuperOverview(days),
    getStoreStats(),
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

  const newest = stores.slice(0, LIST_LIMIT);
  const net = overview ? overview.collected - overview.fees : 0;
  const netPrev = overview ? overview.collectedPrev - overview.feesPrev : 0;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inicio</h1>
          <p className="text-sm text-muted-foreground">
            Lo que te toca hoy y cómo va Tiendify.
          </p>
        </div>
        <nav
          aria-label="Período"
          className="flex rounded-lg border border-border bg-card p-0.5"
        >
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={p === 30 ? "/super" : `/super?d=${p}`}
              aria-current={p === days ? "true" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1 text-[0.8125rem] font-medium transition-colors",
                p === days
                  ? "bg-foreground text-background"
                  : "text-ink-600 hover:text-foreground",
              )}
            >
              {p} días
            </Link>
          ))}
        </nav>
      </div>

      {!overview && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          Faltan los números del negocio (MRR, cobrado, embudo): aparecen al
          correr la migración{" "}
          <code className="font-mono text-xs">0030_super_admin_stats.sql</code>{" "}
          en Supabase. Los pendientes de abajo ya son los reales.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Por hacer</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={<Receipt className="size-4" />}
            label="Comprobantes por aprobar"
            value={String(pendingSubs ?? 0)}
            sub={
              overview && overview.pendingSubsUsd > 0
                ? `${formatUSD(overview.pendingSubsUsd)} esperando`
                : undefined
            }
            hint={pendingSubs ? "Revisar" : "Al día"}
            href="/super/suscripciones"
            highlight={Boolean(pendingSubs)}
          />
          <StatCard
            icon={<Wallet className="size-4" />}
            label="Por pagar a tiendas"
            value={overview ? formatUSD(overview.owed) : "—"}
            sub={
              overview && overview.owedStores > 0
                ? `${overview.owedStores} ${overview.owedStores === 1 ? "tienda espera" : "tiendas esperan"}`
                : undefined
            }
            hint={overview && overview.owed > 0 ? "Registrar pagos" : "Ver pagos"}
            href="/super/pagos"
            highlight={Boolean(overview && overview.owed > 0)}
          />
          <StatCard
            icon={<Gift className="size-4" />}
            label="Referidos por decidir"
            value={String(pendingReferrals ?? 0)}
            hint={pendingReferrals ? "Decidir" : "Al día"}
            href="/super/referidos"
            highlight={Boolean(pendingReferrals)}
          />
          <StatCard
            icon={<MessageSquare className="size-4" />}
            label="Comentarios sin leer"
            value={String(unreadFeedback ?? 0)}
            hint={unreadFeedback ? "Leer" : "Al día"}
            href="/super/comentarios"
            highlight={Boolean(unreadFeedback)}
          />
        </div>
      </section>

      {overview && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Cómo vamos</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={<TrendingUp className="size-4" />}
              label="MRR"
              value={formatUSD(overview.mrr)}
              sub={`${overview.paying} ${overview.paying === 1 ? "tienda paga" : "tiendas pagan"}${
                overview.comped > 0 ? ` · ${overview.comped} de cortesía` : ""
              }`}
            />
            <StatCard
              icon={<Wallet className="size-4" />}
              label={`Cobrado neto, ${days} días`}
              value={formatUSD(net)}
              sub={
                overview.fees > 0
                  ? `${formatUSD(overview.collected)} menos ${formatUSD(overview.fees)} de comisión`
                  : undefined
              }
              delta={vsPrevious(net, netPrev, formatUSD(netPrev), days)}
            />
            <StatCard
              icon={<UserPlus className="size-4" />}
              label={`Tiendas nuevas, ${days} días`}
              value={String(overview.newStores)}
              sub={`${overview.stores} en total`}
              delta={vsPrevious(
                overview.newStores,
                overview.newStoresPrev,
                String(overview.newStoresPrev),
                days,
              )}
            />
            <StatCard
              icon={<ShoppingBag className="size-4" />}
              label={`Vendido por las tiendas, ${days} días`}
              value={formatUSD(overview.gmv)}
              sub={`${formatUSD(overview.gmvTotal)} en ${overview.salesTotal} ventas, histórico`}
              delta={vsPrevious(
                overview.gmv,
                overview.gmvPrev,
                formatUSD(overview.gmvPrev),
                days,
              )}
            />
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-2 lg:gap-5">
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">En riesgo</h2>
            {risks.length > LIST_LIMIT && (
              <span className="text-xs text-muted-foreground">
                {LIST_LIMIT} de {risks.length}
              </span>
            )}
          </div>
          {risks.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
              <CircleCheck className="mb-2 size-7 text-muted-foreground" />
              <p className="text-sm font-medium">Nadie por perderse</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ningún Pro vence en {EXPIRING_DAYS} días sin cobro automático,
                tiene un cobro fallido o lleva {DORMANT_DAYS} días sin
                actividad.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {risks.slice(0, LIST_LIMIT).map(({ store, kind, reason }) => {
                const wa = whatsappUrl(store.whatsapp);
                return (
                  <li key={store.id} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/super/tiendas/${store.id}`}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {store.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {reason}
                      </p>
                    </div>
                    <Badge variant={RISK_BADGE[kind].variant}>
                      {RISK_BADGE[kind].label}
                    </Badge>
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-muted hover:text-foreground"
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
            <p className="text-xs text-muted-foreground">
              Ver en la tabla:{" "}
              <RiskLink segment="expiring">las que vencen</RiskLink>
              {" · "}
              <RiskLink segment="failed">cobros fallidos</RiskLink>
              {" · "}
              <RiskLink segment="dormant">dormidas</RiskLink>
            </p>
          )}
        </section>

        {overview && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">De registrarse a pagar</h2>
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <FunnelRow label="Se registraron" value={overview.stores} of={overview.stores} />
              <FunnelRow
                label="Subieron productos"
                value={overview.storesWithProducts}
                of={overview.stores}
              />
              <FunnelRow
                label="Tuvieron una venta"
                value={overview.storesWithSale}
                of={overview.stores}
              />
              <FunnelRow label="Pagan Pro" value={overview.paying} of={overview.stores} />
              <p className="border-t border-border pt-3 text-2xs text-ink-400">
                Sobre todas las tiendas creadas, no solo las del período.
              </p>
            </div>
          </section>
        )}
      </div>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-2 lg:gap-5">
        <section className="space-y-3">
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Actividad reciente</h2>
            {telegramOn ? (
              <TelegramTestButton />
            ) : (
              <span className="text-xs text-muted-foreground">
                Telegram sin conectar
              </span>
            )}
          </div>
          {events === null ? (
            <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
              La actividad aparece al correr la migración{" "}
              <code className="font-mono text-xs">0031_platform_events.sql</code>{" "}
              en Supabase.
            </p>
          ) : events.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
              <Activity className="mb-2 size-7 text-muted-foreground" />
              <p className="text-sm font-medium">Todavía no pasó nada</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Acá y en Telegram aparecen pagos, tiendas nuevas, comprobantes y
                alertas apenas pasan.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {events.map((e) => {
                const group = EVENT_GROUP[e.type] ?? "clientes";
                const Icon = EVENT_ICON[group];
                const body = (
                  <>
                    <span
                      className={cn(
                        "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg",
                        group === "alerta"
                          ? "bg-destructive-surface text-destructive-text"
                          : "bg-muted text-ink-500",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">{e.title}</span>
                        {e.amount != null && (
                          <span className="shrink-0 text-sm tabular-nums">
                            {formatUSD(e.amount)}
                          </span>
                        )}
                      </span>
                      {e.detail && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {e.detail}
                        </span>
                      )}
                      <span className="block text-2xs text-ink-400">
                        {agoTime(e.created_at, now)}
                      </span>
                    </span>
                  </>
                );
                const rowClass =
                  "flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/50";
                return (
                  <li key={e.id}>
                    {!e.url ? (
                      <div className={rowClass}>{body}</div>
                    ) : e.url.startsWith("/") ? (
                      <Link href={e.url} className={rowClass}>
                        {body}
                      </Link>
                    ) : (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={rowClass}
                      >
                        {body}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Últimas tiendas</h2>
            <Link
              href="/super/tiendas"
              className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Ver todas <ArrowUpRight className="size-3" />
            </Link>
          </div>
          {newest.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
              <StoreIcon className="mb-2 size-7 text-muted-foreground" />
              <p className="text-sm font-medium">Todavía no hay tiendas</p>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {newest.map((s) => {
                const plan = planBadge(s, now);
                const origin = originLabel(s);
                return (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/super/tiendas/${s.id}`}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {s.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.owner_name ?? "Sin dueño asignado"}
                        {origin ? ` · ${origin}` : ""}
                      </p>
                    </div>
                    <Badge variant={plan.variant}>{plan.label}</Badge>
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums text-ink-500">
                      {shortDate(s.created_at, now)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

const EVENT_ICON: Record<EventGroup, typeof StoreIcon> = {
  clientes: StoreIcon,
  dinero: CircleDollarSign,
  pagos: Send,
  crecimiento: Gift,
  alerta: TriangleAlert,
};

function RiskLink({
  segment,
  children,
}: {
  segment: StoreSegment;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/super/tiendas?f=${segment}`}
      className="font-medium hover:text-foreground hover:underline"
    >
      {children}
    </Link>
  );
}

/** Un escalón del embudo: cuántas tiendas llegaron y qué parte del total son. */
function FunnelRow({
  label,
  value,
  of,
}: {
  label: string;
  value: number;
  of: number;
}) {
  const pct = of > 0 ? Math.min(100, (value / of) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="tabular-nums">
          <span className="font-semibold">{value}</span>
          <span className="ml-1.5 text-xs text-ink-400">{Math.round(pct)}%</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
