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

  /**
   * `chrome-admin` es lo que cambia el carácter del panel: dentro de esa clase
   * `--primary` deja de ser el azul de marca y pasa a tinta. El azul se
   * reserva para el logo y el anillo de foco. Repartir el color de marca por
   * cada botón, cada badge y cada sección activa es lo que hace que un panel
   * se lea como plantilla; quitarlo es lo que lo hace parecer una herramienta.
   */
  return (
    <div className="chrome-admin min-h-dvh bg-surface">
      {/* Marca de la tienda + cuenta. En escritorio ocupa el ancho completo y
          se apoya sobre el sidebar; en móvil es la única identidad visible. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface-raised px-4 print:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-ink-50">
            {logo ? (
              <Image
                src={logo}
                alt={store.name}
                width={32}
                height={32}
                className="size-8 object-cover"
              />
            ) : (
              <StoreIcon className="size-4 text-ink-500" />
            )}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold tracking-[-0.011em]">
              {store.name}
            </p>
            <p className="truncate text-2xs text-ink-500">Panel de gestión</p>
          </div>
        </div>
        <div className="ml-auto">
          <UserMenu
            fullName={user.full_name}
            email={user.email}
            storeSlug={store.slug}
          />
        </div>
      </header>

      <div className="flex w-full">
        {/* Sidebar al ras, no una tarjeta flotando sobre gris: la tarjeta
            dentro de la tarjeta suma un borde y una sombra que no informan
            nada y le quitan altura útil a la navegación. */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[15rem] shrink-0 self-start border-r border-border md:block print:hidden">
          <div className="h-full overflow-y-auto">
            <PanelSidebarNav badges={navBadges} pro={pro} />
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-12 md:pt-7">
          <div className="mx-auto w-full max-w-5xl">
            <PlanBanner
              pro={pro}
              daysLeft={daysUntilExpiry(store)}
              pendingReview={(pendingPayment ?? 0) > 0}
            />
            {children}
          </div>
        </main>
      </div>

      <div className="print:hidden">
        <PanelBottomNav badges={navBadges} pro={pro} />
      </div>
    </div>
  );
}
