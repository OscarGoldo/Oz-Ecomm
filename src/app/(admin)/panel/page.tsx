import type { Metadata } from "next";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Bitcoin,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Landmark,
  PackageX,
  Plus,
  Receipt,
  ShoppingCart,
  Smartphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { DashboardMetrics, Delta } from "@/lib/metrics";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import type { PaymentMethodType } from "@/types/database";
import { DeltaChip } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ExchangeRateCard } from "@/components/admin/exchange-rate-card";
import { OrderStatusBadge } from "@/components/admin/status-badge";
import {
  WelcomeChecklist,
  type ChecklistStep,
} from "@/components/admin/welcome-checklist";
import { DismissibleTask, ShowHiddenTasks } from "@/components/admin/dismissible-task";
import { PushNotifications } from "@/components/admin/push-notifications";
import { aiProductsAvailable } from "@/lib/ai-products";
import { isTaskHidden, readHiddenTasks, type TaskId } from "@/lib/dashboard-tasks";
import { pushConfigured, storePushDeviceCount } from "@/lib/push";
import { requireStoreUser } from "@/lib/auth";
import { getCachedBcvRates } from "@/lib/bcv";
import { bcvReference } from "@/lib/exchange-rate";
import { storeUrl } from "@/lib/store-url";
import { createClient } from "@/lib/supabase/server";
import { getDashboardMetrics } from "@/lib/metrics";
import { formatBs, formatUSD } from "@/lib/format";

export const metadata: Metadata = { title: "Resumen" };

export default async function DashboardPage() {
  const { user, store, metadata } = await requireStoreUser();
  const firstName = user.full_name.split(" ")[0] ?? user.full_name;
  const pushOn = pushConfigured();
  const [m, pushDevices] = await Promise.all([
    getDashboardMetrics(store.id),
    pushOn ? storePushDeviceCount(store.id) : Promise.resolve(0),
  ]);

  // Setup checklist for new stores.
  const supabase = createClient();
  const [{ count: productCount }, { count: paymentCount }, bcvRates] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
    supabase
      .from("payment_methods")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
    store.show_bs_prices ? getCachedBcvRates() : null,
  ]);
  const steps: ChecklistStep[] = [
    {
      label: "Dale tu estilo a la tienda",
      // Una tienda que nunca guardó un diseño sigue en la plantilla de fábrica.
      done: store.customization != null,
      href: "/panel/personalizar",
    },
    { label: "Sube el logo de tu tienda", done: Boolean(store.logo_url), href: "/panel/configuracion" },
    {
      label: "Carga tu primer producto",
      done: (productCount ?? 0) > 0,
      // Con IA, desde fotos: es el paso donde más tiendas nuevas se quedan.
      href: aiProductsAvailable() ? "/panel/productos/fotos" : "/panel/productos/nuevo",
    },
    { label: "Configura un método de pago", done: (paymentCount ?? 0) > 0, href: "/panel/configuracion/pagos" },
    { label: "Define la tasa del día (Bs)", done: store.exchange_rate != null, href: "/panel/configuracion" },
  ];

  // Las que el comerciante ocultó no salen, hasta que tengan algo nuevo.
  const allTasks = buildTasks(m);
  const hiddenTasks = readHiddenTasks(metadata);
  const tasks = allTasks.filter((t) => !isTaskHidden(hiddenTasks, t.id, t.itemIds));
  const hiddenCount = allTasks.length - tasks.length;
  const lowStockOnly = m.lowStock.filter((p) => p.stock > 0);
  const outOfStock = m.lowStock.filter((p) => p.stock <= 0);
  const ticket = m.monthOrders > 0 ? m.monthSalesUsd / m.monthOrders : null;

  /**
   * El Resumen arranca por lo que hay que hacer, no por los números: los
   * comprobantes por revisar, los pedidos que esperan pago, los carritos que
   * se pueden recuperar y lo que se agotó. Después vienen las cifras del mes,
   * las ventas por día y cómo le pagan, y al final los últimos pedidos con la
   * tasa y el stock.
   */
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-landing-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <h1 className="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.028em]">
            Hola, {firstName}
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-600">Así va {store.name} hoy.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href={storeUrl(store)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalLink /> Ver tienda
          </Link>
          <Link href="/panel/productos/nuevo" className={buttonVariants()}>
            <Plus /> Nuevo producto
          </Link>
        </div>
      </header>

      <WelcomeChecklist steps={steps} />

      {/* Solo mientras ningún teléfono de la tienda los tenga: si ya le suenan
          en el teléfono, ofrecerlos en la computadora cada día es ruido. En
          Ajustes sigue la opción para activarlos en este equipo. */}
      {pushOn && pushDevices === 0 && (
        <PushNotifications variant="prompt" publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!} />
      )}

      <section aria-labelledby="para-hoy">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="para-hoy" className="font-display text-xl font-bold tracking-[-0.02em]">
            Para atender hoy
          </h2>
          {tasks.length > 0 && (
            <p className="hidden text-[13px] text-ink-600 sm:block">Lo más urgente primero</p>
          )}
        </div>
        {allTasks.length === 0 ? (
          <div className="flex items-center gap-3.5 rounded-2xl border bg-card p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-success-surface text-success-text">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <p className="font-semibold">Todo al día</p>
              <p className="text-sm text-ink-600">
                No hay pagos por revisar, pedidos esperando ni productos agotados.
              </p>
            </div>
          </div>
        ) : (
          <>
            {tasks.length > 0 && (
              <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                {tasks.map((t) => (
                  <DismissibleTask key={t.id} taskId={t.id} itemIds={t.itemIds} label={t.title}>
                    <TaskCard task={t} />
                  </DismissibleTask>
                ))}
              </div>
            )}
            {hiddenCount > 0 && <ShowHiddenTasks count={hiddenCount} />}
          </>
        )}
      </section>

      <section
        aria-label="Números del mes"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border lg:grid-cols-4"
      >
        <Kpi
          label="Ventas del mes"
          value={formatUSD(m.monthSalesUsd)}
          sub={store.show_bs_prices && m.monthSalesBs ? formatBs(m.monthSalesBs) : undefined}
          delta={m.monthSalesDelta}
        />
        <Kpi label="Pedidos del mes" value={String(m.monthOrders)} delta={m.monthOrdersDelta} />
        <Kpi label="Ticket promedio" value={ticket === null ? "—" : formatUSD(ticket)} />
        <Kpi label="Pedidos de hoy" value={String(m.todayOrders)} delta={m.todayOrdersDelta} />
      </section>

      {/* Solo si ya hubo alguna venta este mes, para no mostrarle al dueño
          un gráfico vacío el día 1. */}
      {m.monthOrders > 0 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section aria-labelledby="ventas-dia" className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="ventas-dia" className="font-display text-lg font-bold tracking-[-0.02em]">
                Ventas por día
              </h2>
              <span className="text-[13px] text-ink-600">Este mes, en dólares</span>
            </div>
            <SalesByDayChart data={m.salesByDay} />
          </section>
          {m.salesByMethod.length > 0 && (
            <section aria-labelledby="como-pagan" className="rounded-2xl border bg-card p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id="como-pagan" className="font-display text-lg font-bold tracking-[-0.02em]">
                  Cómo te pagan
                </h2>
                <span className="text-[13px] text-ink-600">Este mes</span>
              </div>
              <PaymentMethodBreakdown data={m.salesByMethod} />
            </section>
          )}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="ultimos" className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <h2 id="ultimos" className="font-display text-lg font-bold tracking-[-0.02em]">
              Últimos pedidos
            </h2>
            <Link
              href="/panel/pedidos"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
            >
              Ver todos <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {m.recentOrders.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-600">
              Todavía no hay pedidos. Cuando entre el primero, aparece aquí.
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {m.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/panel/pedidos/${o.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-ink-25 sm:grid-cols-[minmax(0,1fr)_auto_7rem]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        <span className="font-landing-mono">#{o.order_number}</span>
                        <span className="text-ink-500"> · </span>
                        {o.customer_name}
                      </span>
                      <span className="block text-[13px] text-ink-500">
                        {formatDistanceToNow(new Date(o.created_at), { addSuffix: true, locale: es })}
                        {o.payment_method_type &&
                          ` · ${PAYMENT_METHOD_META[o.payment_method_type as PaymentMethodType]?.label ?? o.payment_method_type}`}
                      </span>
                    </span>
                    <span className="order-last col-span-2 sm:order-none sm:col-span-1">
                      <OrderStatusBadge status={o.status} />
                    </span>
                    <span className="text-right font-landing-mono text-sm font-semibold tabular-nums">
                      {formatUSD(o.total)}
                      {o.total_bs ? (
                        <span className="block text-xs font-normal text-ink-500">
                          {formatBs(o.total_bs)}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <ExchangeRateCard
            rate={store.exchange_rate}
            updatedAt={store.exchange_rate_updated_at}
            auto={store.auto_exchange_rate}
            showBs={store.show_bs_prices}
            bcv={bcvReference(store.currency_primary, bcvRates)}
          />

          {m.lowStock.length > 0 && (
            <section aria-labelledby="poco-stock" className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                <h2 id="poco-stock" className="font-display text-lg font-bold tracking-[-0.02em]">
                  Poco stock
                </h2>
                <Link
                  href="/panel/productos"
                  className="text-sm font-semibold text-brand-700 hover:underline"
                >
                  Ver productos
                </Link>
              </div>
              <ul className="divide-y divide-ink-100">
                {[...outOfStock, ...lowStockOnly].slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/panel/productos/${p.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-ink-25"
                    >
                      <span className="truncate text-sm font-semibold">{p.name}</span>
                      <Badge variant={p.stock <= 0 ? "danger" : "warning"}>
                        {p.stock <= 0 ? "Agotado" : `Quedan ${p.stock}`}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Para atender hoy ------------------------------------------------------ */

interface Task {
  /** Para ocultarla (ver lib/dashboard-tasks.ts). */
  id: TaskId;
  /** Lo que hay detrás de la tarea; si aparece uno nuevo, vuelve aunque esté oculta. */
  itemIds: string[];
  icon: LucideIcon;
  /** El único que va en amarillo: hay plata esperando que la confirmen. */
  urgent?: boolean;
  title: string;
  text: string;
  cta: string;
  href: string;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Lo que espera algo del dueño, en orden de urgencia. Vacío = todo al día. */
function buildTasks(m: DashboardMetrics): Task[] {
  const tasks: Task[] = [];

  if (m.pendingConfirmation > 0) {
    tasks.push({
      id: "comprobantes",
      itemIds: m.pendingConfirmationIds,
      icon: Receipt,
      urgent: true,
      title: plural(m.pendingConfirmation, "comprobante por revisar", "comprobantes por revisar"),
      text: m.oldestPendingAt
        ? `Compara el monto con tu banco y confírmalo. El más viejo llegó ${formatDistanceToNow(
            new Date(m.oldestPendingAt),
            { addSuffix: true, locale: es },
          )}.`
        : "Compara el monto con tu banco y confírmalo.",
      cta: "Revisar pagos",
      href: "/panel/pedidos?status=pending_confirmation",
    });
  }

  if (m.pendingPayment > 0) {
    tasks.push({
      id: "esperan-pago",
      itemIds: m.pendingPaymentIds,
      icon: Clock,
      title: plural(m.pendingPayment, "pedido espera el pago", "pedidos esperan el pago"),
      text: "Eligieron pagar por fuera y no mandaron el comprobante. El producto queda apartado mientras tanto.",
      cta: "Ver pedidos",
      href: "/panel/pedidos?status=pending_payment",
    });
  }

  if (m.abandonedCarts.count > 0) {
    tasks.push({
      id: "carritos",
      itemIds: m.abandonedCarts.ids,
      icon: ShoppingCart,
      title: plural(m.abandonedCarts.count, "carrito sin terminar", "carritos sin terminar"),
      text: `${formatUSD(m.abandonedCarts.usd)} que se quedaron sin pagar. Un mensaje a tiempo los recupera.`,
      cta: "Ver carritos",
      href: "/panel/carritos",
    });
  }

  const out = m.lowStock.filter((p) => p.stock <= 0);
  const low = m.lowStock.filter((p) => p.stock > 0);
  if (out.length > 0 || low.length > 0) {
    const names = (out.length > 0 ? out : low).slice(0, 2).map((p) => p.name).join(", ");
    tasks.push({
      id: "stock",
      itemIds: m.lowStock.map((p) => p.id),
      icon: out.length > 0 ? PackageX : AlertTriangle,
      title:
        out.length > 0
          ? plural(out.length, "producto agotado", "productos agotados")
          : plural(low.length, "producto con poco stock", "productos con poco stock"),
      text:
        out.length > 0 && low.length > 0
          ? `${names}. Y quedan pocos de otros ${low.length}.`
          : `${names}.`,
      cta: "Reponer stock",
      href: "/panel/productos",
    });
  }

  return tasks;
}

function TaskCard({ task }: { task: Task }) {
  const Icon = task.icon;
  return (
    <Link
      href={task.href}
      className="group flex flex-col gap-3.5 rounded-2xl border bg-card p-5 transition-[border-color,box-shadow] duration-150 hover:border-ink-300 hover:shadow-md"
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-[10px]",
          task.urgent ? "bg-sol text-noche" : "bg-ink-100 text-foreground",
        )}
      >
        <Icon className="size-[1.125rem]" />
      </span>
      <span>
        <span className="block font-display text-lg font-bold leading-tight tracking-[-0.02em]">
          {task.title}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-ink-600">{task.text}</span>
      </span>
      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold text-brand-700">
        {task.cta}
        <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/* --- Números del mes -------------------------------------------------------- */

function Kpi({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: Delta;
}) {
  return (
    <div className="flex flex-col bg-card px-5 py-4">
      <p className="text-[13px] text-ink-600">{label}</p>
      <p className="mt-2 font-display text-[1.65rem] font-bold leading-none tracking-[-0.03em] tabular-nums sm:text-[1.9rem]">
        {value}
      </p>
      {sub && (
        <p className="mt-1.5 truncate font-landing-mono text-xs tabular-nums text-ink-500">{sub}</p>
      )}
      {delta && (
        <p className="mt-auto flex flex-wrap items-center gap-1.5 pt-3 text-xs text-ink-500">
          {delta.pct != null ? (
            <>
              <DeltaChip pct={delta.pct} /> vs. {delta.periodLabel}
            </>
          ) : (
            <>
              {delta.periodLabel === "ayer" ? "Ayer" : "El mes anterior"}: {delta.previousLabel}
            </>
          )}
        </p>
      )}
    </div>
  );
}

/* --- Gráficos ---------------------------------------------------------------- */

/**
 * Una barra por día del mes en curso. Hoy va en noche y el resto en el azul
 * de marca: así se ve de un vistazo dónde está parado el mes.
 */
function SalesByDayChart({ data }: { data: DashboardMetrics["salesByDay"] }) {
  const slot = 40;
  const bar = 26;
  const top = 12;
  const base = 172;
  const width = Math.max(1, data.length) * slot;
  const max = Math.max(1, ...data.map((d) => d.usd));
  const best = data.reduce((b, d) => (d.usd > b.usd ? d : b), data[0] ?? { label: "", usd: 0 });
  // Etiquetas abajo: la primera, una cada cinco y la de hoy.
  const labelled = (i: number) => i === 0 || i === data.length - 1 || (i + 1) % 5 === 0;

  return (
    <svg
      viewBox={`0 0 ${width} 196`}
      role="img"
      aria-label={
        best.usd > 0
          ? `Ventas por día de este mes. El mejor día fue el ${best.label}, con ${formatUSD(best.usd)}.`
          : "Ventas por día de este mes."
      }
      className="mt-4 block h-auto w-full"
    >
      {[0, 0.5, 1].map((f) => (
        <line
          key={f}
          x1={0}
          x2={width}
          y1={top + (base - top) * f}
          y2={top + (base - top) * f}
          stroke={f === 1 ? "hsl(var(--border))" : "hsl(var(--ink-100))"}
          strokeWidth={1}
        />
      ))}
      {data.map((d, i) => {
        const h = d.usd > 0 ? Math.max(3, (d.usd / max) * (base - top)) : 0;
        const today = i === data.length - 1;
        return (
          <g key={d.key}>
            <rect
              x={i * slot + (slot - bar) / 2}
              y={base - h}
              width={bar}
              height={h}
              rx={4}
              fill={today ? "hsl(var(--ink-900))" : "hsl(var(--brand-500))"}
            >
              <title>{`${d.label}: ${formatUSD(d.usd)}`}</title>
            </rect>
            {labelled(i) && (
              <text
                x={i * slot + slot / 2}
                y={192}
                textAnchor="middle"
                fontSize={11}
                className="font-landing-mono"
                fill={today ? "hsl(var(--ink-900))" : "hsl(var(--ink-500))"}
                fontWeight={today ? 600 : 400}
              >
                {today ? "Hoy" : d.label.split(" ")[0]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const METHOD_ICONS: Record<string, LucideIcon> = {
  pago_movil: Smartphone,
  zelle: Landmark,
  binance: Bitcoin,
  cash: Banknote,
  transfer: Building2,
  stripe: CreditCard,
  paypal: CreditCard,
};

/** Un renglón por método de pago, con su parte de las ventas del mes. */
function PaymentMethodBreakdown({
  data,
}: {
  data: DashboardMetrics["salesByMethod"];
}) {
  const total = data.reduce((s, d) => s + d.usd, 0) || 1;
  return (
    <ul className="mt-5 space-y-4">
      {data.slice(0, 5).map((d) => {
        const Icon = METHOD_ICONS[d.type] ?? CreditCard;
        const pct = Math.round((d.usd / total) * 100);
        return (
          <li key={d.type}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-semibold">
                <Icon className="size-4 shrink-0 text-ink-500" />
                <span className="truncate">{d.label}</span>
              </span>
              <span className="shrink-0 font-landing-mono text-[13px] tabular-nums">
                {formatUSD(d.usd)} · {pct}%
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-ink-100">
              <div className="h-2 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
