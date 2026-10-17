import Link from "next/link";
import { LogOut } from "lucide-react";

import { SuperBottomNav, SuperSidebarNav } from "@/components/admin/super-nav";
import { SuperSearch } from "@/components/admin/super-search";
import { landingFonts } from "@/components/landing/fonts";
import { TiendifyLogo, TiendifyLogoMark } from "@/components/landing/tiendify-logo";
import { signOut } from "@/lib/auth-actions";
import { requireSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/** La etiqueta que dice que esto es la vista de los socios, no el panel. */
function SociosTag() {
  return (
    <span className="rounded-[5px] bg-sol px-1.5 py-0.5 font-landing-mono text-[10px] font-semibold tracking-[0.08em] text-noche">
      SOCIOS
    </span>
  );
}

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

  // La plataforma en una línea, arriba del menú: cuántas tiendas hay y cuántas
  // pagan. Pro pagando con el mismo criterio que isPro() y super_overview.
  const db = createAdminClient();
  const nowIso = new Date().toISOString();
  const [{ count: storesCount }, { count: payingCount }] = await Promise.all([
    db.from("stores").select("id", { count: "exact", head: true }),
    db
      .from("stores")
      .select("id", { count: "exact", head: true })
      .eq("plan", "pro")
      .eq("plan_source", "paid")
      .or(`plan_expires_at.is.null,plan_expires_at.gt.${nowIso}`),
  ]);
  const stores = storesCount ?? 0;
  const paying = payingCount ?? 0;
  const payingPct = stores > 0 ? Math.max(2, Math.round((paying / stores) * 100)) : 0;

  const navBadges: Record<string, number> = {
    ...(pendingSubs ? { "/super/suscripciones": pendingSubs } : {}),
    ...(pendingReferrals ? { "/super/referidos": pendingReferrals } : {}),
    ...(unreadFeedback ? { "/super/comentarios": unreadFeedback } : {}),
  };

  /**
   * La vista de los socios, con el mismo marco que el panel del comerciante:
   * barra lateral noche, fondo claro frío y las letras de la portada
   * (`chrome-panel` cambia la tinta cálida por los neutros fríos; ver
   * globals.css). Así todas las pantallas del super admin quedan en la misma
   * paleta, aunque solo Inicio tenga gráficos nuevos.
   */
  return (
    <div
      className={cn(
        landingFonts,
        "chrome-admin chrome-panel min-h-dvh bg-surface font-landing-body text-foreground antialiased",
      )}
    >
      {/* Teléfono: la barra noche con el buscador. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 bg-noche px-3 text-white md:hidden">
        <Link href="/super" className="flex shrink-0 items-center gap-2" aria-label="Super admin, inicio">
          <TiendifyLogoMark className="h-7 w-auto" />
          <SociosTag />
        </Link>
        <div className="min-w-0 flex-1">
          <SuperSearch />
        </div>
        <form action={signOut}>
          <button
            type="submit"
            title={`Salir (${user.email})`}
            aria-label="Salir"
            className="grid size-10 place-items-center rounded-lg bg-white/[0.08] text-white"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </header>

      <div className="flex w-full">
        <aside className="sticky top-0 hidden h-dvh w-[15.5rem] shrink-0 self-start bg-noche text-white md:block">
          <div className="flex h-full flex-col gap-3.5 overflow-y-auto px-3 py-3.5">
            <Link
              href="/super"
              className="flex items-center justify-between gap-2 px-2 pt-0.5"
              aria-label="Super admin, inicio"
            >
              <TiendifyLogo variant="white" className="h-7 w-auto" />
              <SociosTag />
            </Link>

            <div className="rounded-xl border border-white/[0.08] bg-noche-suave p-3">
              <p className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-niebla">
                La plataforma hoy
              </p>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.18]">
                <div className="h-2 rounded-full bg-brand-400" style={{ width: `${payingPct}%` }} />
              </div>
              <p className="mt-2 text-[13px] text-white/[0.78]">
                <span className="font-landing-mono font-semibold text-white">{stores}</span>{" "}
                {stores === 1 ? "tienda" : "tiendas"} ·{" "}
                <span className="font-landing-mono font-semibold text-white">{paying}</span>{" "}
                {paying === 1 ? "paga" : "pagan"} Pro
              </p>
            </div>

            <SuperSidebarNav badges={navBadges} />

            <div className="mt-auto flex items-center gap-2.5 rounded-xl border border-white/[0.08] p-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold">
                {(user.full_name || user.email).trim().charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13.5px] font-semibold">
                  {user.full_name || "Socio"}
                </span>
                <span className="block truncate font-landing-mono text-[11px] text-niebla">
                  {user.email}
                </span>
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label="Salir"
                  title="Salir"
                  className="grid size-8 place-items-center rounded-lg text-niebla transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <LogOut className="size-4" />
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Escritorio: el buscador de tiendas, siempre a mano. */}
          <header className="sticky top-0 z-30 hidden h-16 items-center gap-4 border-b border-border bg-card px-8 md:flex">
            <div className="w-full max-w-[28rem]">
              <SuperSearch />
            </div>
          </header>

          {/* Más ancho que el panel del comerciante: acá hay tablas con ocho
              columnas y gráficos lado a lado. */}
          <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-14 md:pt-8">
            <div className="mx-auto w-full max-w-[1240px]">{children}</div>
          </main>
        </div>
      </div>

      <SuperBottomNav badges={navBadges} />
    </div>
  );
}
