import Image from "next/image";
import { Store as StoreIcon } from "lucide-react";

import { PanelBottomNav, PanelSidebarNav } from "@/components/admin/panel-nav";
import { UserMenu } from "@/components/admin/user-menu";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hexToHslTriplet } from "@/lib/color";
import { getImageUrl } from "@/lib/storage";
import type { CSSProperties } from "react";

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
  const navBadges: Record<string, number> = unattended
    ? { "/panel/pedidos": unattended }
    : {};

  const logo = getImageUrl(store.logo_url);

  // Apply the store's brand color to the panel theme.
  const primaryHsl = hexToHslTriplet(store.primary_color);
  const brandStyle = primaryHsl
    ? ({ "--primary": primaryHsl, "--ring": primaryHsl } as CSSProperties)
    : undefined;

  return (
    <div style={brandStyle} className="min-h-dvh bg-muted/30">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4">
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

      <div className="mx-auto flex w-full max-w-6xl">
        {/* Desktop sidebar */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 border-r bg-background md:block">
          <PanelSidebarNav badges={navBadges} />
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">
          {children}
        </main>
      </div>

      <PanelBottomNav badges={navBadges} />
    </div>
  );
}
