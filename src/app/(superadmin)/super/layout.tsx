import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { SuperBottomNav, SuperSidebarNav } from "@/components/admin/super-nav";
import { SuperSearch } from "@/components/admin/super-search";
import { signOut } from "@/lib/auth-actions";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SuperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSuperAdmin();

  // Comprobantes esperando revisión: es plata que ya te pagaron pero que el
  // comerciante todavía no está recibiendo, así que va visible en el nav.
  const supabase = createClient();
  const { count: pendingSubs } = await supabase
    .from("subscription_payments")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  // Referidos que se activaron pero pasaron el tope automático: hasta que los
  // mires, hay un comerciante esperando su mes.
  const { count: pendingReferrals } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("status", "qualified");

  // Comentarios de comerciantes sin leer: alguien esperando respuesta. Si la
  // tabla todavía no existe (migración 0028 sin correr) esto da null y el
  // numerito simplemente no aparece.
  const { count: unreadFeedback } = await supabase
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  const navBadges: Record<string, number> = {
    ...(pendingSubs ? { "/super/suscripciones": pendingSubs } : {}),
    ...(pendingReferrals ? { "/super/referidos": pendingReferrals } : {}),
    ...(unreadFeedback ? { "/super/comentarios": unreadFeedback } : {}),
  };

  return (
    <div className="chrome-admin min-h-dvh bg-surface">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface-raised px-4">
        {/* En escritorio la marca ocupa el ancho del menú, así el buscador
            arranca donde arranca el contenido. */}
        <Link
          href="/super"
          className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-[-0.011em] md:w-[14rem]"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-ink-900 text-ink-25">
            <ShieldCheck className="size-4" />
          </span>
          <span className="hidden sm:inline">Tiendify</span>
          <span className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-[0.06em] text-ink-500 sm:inline">
            Super Admin
          </span>
        </Link>

        <div className="min-w-0 flex-1 md:max-w-md">
          <SuperSearch />
        </div>

        {/* El correo queda como ayuda del botón de salir, que es donde importa
            saber con qué cuenta se está. */}
        <form action={signOut} className="ml-auto">
          <button
            type="submit"
            title={`Salir (${user.email})`}
            className="shrink-0 rounded-md border border-input bg-background px-2.5 py-1.5 text-[0.8125rem] font-medium shadow-xs transition-colors hover:bg-muted"
          >
            Salir
          </button>
        </form>
      </header>

      <div className="flex w-full">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[15rem] shrink-0 self-start border-r border-border md:block">
          <div className="h-full overflow-y-auto">
            <SuperSidebarNav badges={navBadges} />
          </div>
        </aside>

        {/* Más ancho que el panel del comerciante (max-w-5xl): acá hay tablas
            con ocho columnas. */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-12 md:pt-7">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <SuperBottomNav badges={navBadges} />
    </div>
  );
}
