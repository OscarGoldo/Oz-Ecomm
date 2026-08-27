import Image from "next/image";
import { Store as StoreIcon } from "lucide-react";

import { PanelBottomNav, PanelSidebarNav } from "@/components/admin/panel-nav";
import { PlanBanner } from "@/components/admin/plan-banner";
import { UserMenu } from "@/components/admin/user-menu";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { abandonedCartCutoff } from "@/lib/constants";
import { daysUntilExpiry, isPro } from "@/lib/plans";
import { getImageUrl } from "@/lib/storage";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, store } = await requireStoreUser();

  // Count orders awaiting payment confirmation (badge on the Pedidos nav).
  const { count: unattended } = await createClient()
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)
    .eq("status", "pending_confirmation");
  // Carritos abandonados pendientes (mismo criterio que /panel/carritos: solo
  // los que ya pasaron la ventana de gracia cuentan como abandonados).
  const { count: pendingCarts } = await createClient()
    .from("abandoned_carts")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)
    .is("recovered_at", null)
    .is("dismissed_at", null)
    .lt("updated_at", abandonedCartCutoff());

  const navBadges: Record<string, number> = {
    ...(unattended ? { "/panel/pedidos": unattended } : {}),
    ...(pendingCarts ? { "/panel/carritos": pendingCarts } : {}),
  };

  const logo = getImageUrl(store.logo_url);
  const pro = isPro(store);

  // Comprobante ya enviado y esperando revisión: el banner lo dice para que no
  // vuelva a pagar mientras tanto.
  const { count: pendingPayment } = await createClient()
    .from("subscription_payments")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)
    .eq("status", "pending");

  // El panel usa el azul de Tiendify (definido en globals.css), no el
  // primary_color de la tienda: ese es el color de la tienda pública, no el
  // de la plataforma. Antes se pisaba acá con un estilo inline por tienda.

  return (
    <div className="min-h-dvh bg-muted">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 print:hidden">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center overflow-hidden rounded-lg bg-primary/10">
            {logo ? (
              <Image
                src={logo}
                alt={store.name}
                width={36}
                height={36}
                className="size-9 object-cover"
              />
            ) : (
              <StoreIcon className="size-5 text-primary" />
            )}
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{store.name}</p>
            <p className="text-xs text-muted-foreground">Panel de gestión</p>
          </div>
        </div>
        <UserMenu
          fullName={user.full_name}
          email={user.email}
          storeSlug={store.slug}
        />
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-4 md:gap-6 md:px-6 md:py-4">
        {/* Desktop sidebar: tarjeta blanca separada del fondo gris. */}
        <aside className="sticky top-[4.5rem] hidden h-[calc(100dvh-5.5rem)] w-64 shrink-0 self-start md:block print:hidden">
          <div className="h-full overflow-y-auto rounded-2xl border bg-background shadow-sm">
            <PanelSidebarNav badges={navBadges} pro={pro} />
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-0 md:pb-10 md:pt-0">
          <PlanBanner
            pro={pro}
            daysLeft={daysUntilExpiry(store)}
            pendingReview={(pendingPayment ?? 0) > 0}
          />
          {children}
        </main>
      </div>

      <div className="print:hidden">
        <PanelBottomNav badges={navBadges} pro={pro} />
      </div>
    </div>
  );
}
