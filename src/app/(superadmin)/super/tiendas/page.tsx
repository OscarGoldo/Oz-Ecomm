import Link from "next/link";
import { Plus } from "lucide-react";

import {
  SuperStoresTable,
  type StoreRow,
} from "@/components/admin/super-stores-table";
import { requireSuperAdmin } from "@/lib/auth";
import { storeClosedByOwner } from "@/lib/store-status";
import { agoShort, fullDate, planBadge, shortDate } from "@/lib/super-format";
import { isStoreSegment, originLabel, segmentsOf } from "@/lib/super-segments";
import { getStoreStats } from "@/lib/super-stats";
import { whatsappUrl } from "@/lib/whatsapp";

export const metadata = { title: "Tiendas" };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * El directorio de clientes: todas las tiendas en una tabla que se busca, se
 * filtra y se ordena. Para ver o cambiar una (plan, pausa, contacto) se entra
 * a su ficha.
 *
 * `?q=` y `?f=` llegan desde el buscador de arriba y desde los enlaces de
 * Inicio ("ver las que vencen pronto").
 */
export default async function SuperStoresPage({
  searchParams,
}: {
  searchParams: { q?: string | string[]; f?: string | string[] };
}) {
  await requireSuperAdmin();
  const { stores, complete } = await getStoreStats();

  const q = first(searchParams.q) ?? "";
  const f = first(searchParams.f);
  const now = new Date();

  const rows: StoreRow[] = stores.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    whatsapp: s.whatsapp,
    waUrl: whatsappUrl(s.whatsapp),
    ownerName: s.owner_name,
    ownerEmail: s.owner_email,
    plan: planBadge(s, now),
    offlineLabel: s.active
      ? null
      : storeClosedByOwner(s)
        ? "cerrada por el dueño"
        : "pausada",
    // Sin la migración no se sabe la última actividad, y marcar a todas como
    // dormidas por eso sería una alarma falsa.
    segments: segmentsOf(s, now.getTime()).filter(
      (seg) => complete || seg !== "dormant",
    ),
    createdAt: s.created_at,
    createdLabel: shortDate(s.created_at, now),
    createdFull: fullDate(s.created_at),
    activityAt: s.last_activity_at,
    activityLabel: s.last_activity_at
      ? agoShort(s.last_activity_at, now)
      : complete
        ? "nunca"
        : "—",
    products: s.products,
    sales: s.sales,
    gmv: s.gmv,
    paidTotal: s.paid_total,
    owed: s.owed,
    origin: originLabel(s),
    note: s.plan_note,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tiendas</h1>
          <p className="text-sm text-muted-foreground">
            Todos los clientes de Tiendify. Entra a una para ver su ficha o
            cambiarle el plan.
          </p>
        </div>
        <Link
          href="/super/tiendas/nueva"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-4" />{" "}
          <span className="hidden sm:inline">Nueva tienda</span>
        </Link>
      </div>

      {!complete && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          La lista está completa, pero las ventas, el GMV, la última actividad
          y el origen de cada tienda aparecen recién al correr la migración{" "}
          <code className="font-mono text-xs">0030_super_admin_stats.sql</code>{" "}
          en Supabase.
        </p>
      )}

      {/* La `key` hace que la tabla arranque de cero cuando cambia la URL: sin
          ella, buscar desde arriba estando ya en esta pantalla no haría nada,
          porque el estado inicial solo se lee una vez. */}
      <SuperStoresTable
        key={`${q}|${f ?? ""}`}
        rows={rows}
        initialQuery={q}
        initialSegment={isStoreSegment(f) ? f : null}
        complete={complete}
      />
    </div>
  );
}
