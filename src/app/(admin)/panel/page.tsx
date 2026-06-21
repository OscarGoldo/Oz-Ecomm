import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  DollarSign,
  ExternalLink,
  ShoppingBag,
} from "lucide-react";

import { OrderStatusBadge } from "@/components/admin/status-badge";
import {
  WelcomeChecklist,
  type ChecklistStep,
} from "@/components/admin/welcome-checklist";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDashboardMetrics } from "@/lib/metrics";
import { formatBs, formatUSD } from "@/lib/format";

export const metadata: Metadata = { title: "Resumen" };

export default async function DashboardPage() {
  const { user, store } = await requireStoreUser();
  const firstName = user.full_name.split(" ")[0] ?? user.full_name;
  const m = await getDashboardMetrics(store.id);

  // Setup checklist for new stores.
  const supabase = createClient();
  const [{ count: productCount }, { count: paymentCount }] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
    supabase
      .from("payment_methods")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
  ]);
  const steps: ChecklistStep[] = [
    { label: "Subí el logo de tu tienda", done: Boolean(store.logo_url), href: "/panel/configuracion" },
    { label: "Cargá tu primer producto", done: (productCount ?? 0) > 0, href: "/panel/productos/nuevo" },
    { label: "Configurá un método de pago", done: (paymentCount ?? 0) > 0, href: "/panel/configuracion/pagos" },
    { label: "Definí la tasa del día (Bs)", done: store.exchange_rate != null, href: "/panel/configuracion" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hola, {firstName} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumen de {store.name}
          </p>
        </div>
        <Link
          href={`/${store.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Ver tienda <ExternalLink className="size-4" />
        </Link>
      </div>

      <WelcomeChecklist steps={steps} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<ShoppingBag className="size-4" />}
          label="Pedidos de hoy"
          value={String(m.todayOrders)}
        />
        <Link href="/panel/pedidos?status=pending_confirmation">
          <StatCard
            icon={<ClipboardList className="size-4" />}
            label="Por confirmar"
            value={String(m.pendingConfirmation)}
            highlight={m.pendingConfirmation > 0}
          />
        </Link>
        <StatCard
          icon={<DollarSign className="size-4" />}
          label="Ventas del mes"
          value={formatUSD(m.monthSalesUsd)}
          sub={store.show_bs_prices && m.monthSalesBs ? formatBs(m.monthSalesBs) : undefined}
        />
        <Link href="/panel/productos">
          <StatCard
            icon={<AlertTriangle className="size-4" />}
            label="Bajo stock"
            value={String(m.lowStock.length)}
            highlight={m.lowStock.length > 0}
          />
        </Link>
      </div>

      {/* Recent orders */}
      <section className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-sm font-semibold">Últimos pedidos</h2>
          <Link
            href="/panel/pedidos"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Ver todos <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {m.recentOrders.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Todavía no hay pedidos.
          </p>
        ) : (
          <ul className="divide-y">
            {m.recentOrders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/panel/pedidos/${o.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">#{o.order_number}</span>
                      <OrderStatusBadge status={o.status} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {o.customer_name} ·{" "}
                      {format(new Date(o.created_at), "d MMM, HH:mm", { locale: es })}
                    </p>
                  </div>
                  <span className="font-semibold">{formatUSD(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Low stock */}
      {m.lowStock.length > 0 && (
        <section className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-4">
            <AlertTriangle className="size-4 text-warning-foreground" />
            <h2 className="text-sm font-semibold">Productos con bajo stock</h2>
          </div>
          <ul className="divide-y">
            {m.lowStock.slice(0, 6).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/panel/productos/${p.id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted/40"
                >
                  <span className="truncate text-sm font-medium">{p.name}</span>
                  <span
                    className={
                      p.stock <= 0
                        ? "text-sm font-semibold text-destructive"
                        : "text-sm font-semibold text-warning-foreground"
                    }
                  >
                    {p.stock <= 0 ? "Agotado" : `Quedan ${p.stock}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-4 ${
        highlight ? "border-warning/50 bg-warning/5" : ""
      }`}
    >
      <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
