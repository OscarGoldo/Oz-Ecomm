import Link from "next/link";
import { ExternalLink, Plus, ShoppingBag, Store as StoreIcon, Wallet } from "lucide-react";

import { StoreActiveSwitch } from "@/components/admin/store-active-switch";
import { createClient } from "@/lib/supabase/server";
import { SALES_STATUSES } from "@/lib/metrics";
import { formatUSD } from "@/lib/format";
import type { Store } from "@/types/database";

export const metadata = { title: "Tiendas" };

export default async function SuperDashboardPage() {
  const supabase = createClient();

  const [{ data: stores }, { data: sales }, { data: products }] =
    await Promise.all([
      supabase.from("stores").select("*").order("created_at"),
      supabase.from("orders").select("store_id, total").in("status", SALES_STATUSES),
      supabase.from("products").select("store_id"),
    ]);

  const gmvByStore = new Map<string, number>();
  const salesByStore = new Map<string, number>();
  for (const o of sales ?? []) {
    gmvByStore.set(o.store_id, (gmvByStore.get(o.store_id) ?? 0) + Number(o.total));
    salesByStore.set(o.store_id, (salesByStore.get(o.store_id) ?? 0) + 1);
  }
  const productsByStore = new Map<string, number>();
  for (const p of products ?? []) {
    productsByStore.set(p.store_id, (productsByStore.get(p.store_id) ?? 0) + 1);
  }

  const storeList = (stores ?? []) as Store[];
  const totalGmv = [...gmvByStore.values()].reduce((s, v) => s + v, 0);
  const activeCount = storeList.filter((s) => s.active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tiendas</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de todos los tenants de OzShop.
          </p>
        </div>
        <Link
          href="/super/tiendas/nueva"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-4" /> <span className="hidden sm:inline">Nueva tienda</span>
        </Link>
      </div>

      {/* Global metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={<StoreIcon className="size-4" />} label="Tiendas activas" value={`${activeCount}/${storeList.length}`} />
        <Metric icon={<ShoppingBag className="size-4" />} label="Ventas totales" value={String((sales ?? []).length)} />
        <Metric icon={<Wallet className="size-4" />} label="GMV total" value={formatUSD(totalGmv)} />
        <Metric icon={<StoreIcon className="size-4" />} label="Productos" value={String((products ?? []).length)} />
      </div>

      {/* Stores */}
      {storeList.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-12 text-center">
          <StoreIcon className="mb-3 size-9 text-muted-foreground" />
          <p className="font-medium">Todavía no hay tiendas</p>
          <Link
            href="/super/tiendas/nueva"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="size-4" /> Crear la primera
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {storeList.map((store) => (
            <li
              key={store.id}
              className="flex items-center gap-3 rounded-xl border bg-card p-3"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                {store.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{store.name}</span>
                  {!store.active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      pausada
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  /{store.slug} · {productsByStore.get(store.id) ?? 0} prod ·{" "}
                  {salesByStore.get(store.id) ?? 0} ventas ·{" "}
                  {formatUSD(gmvByStore.get(store.id) ?? 0)}
                </p>
              </div>
              <Link
                href={`/${store.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Ver tienda"
              >
                <ExternalLink className="size-4" />
              </Link>
              <StoreActiveSwitch storeId={store.id} active={store.active} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
