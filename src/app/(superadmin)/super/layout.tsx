import Link from "next/link";
import { ShieldCheck } from "lucide-react";

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

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/super" className="flex items-center gap-2 font-bold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </span>
            Tiendify
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Super Admin
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1">
              <Link
                href="/super"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Tiendas
              </Link>
              <Link
                href="/super/pagos"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Pagos
              </Link>
              <Link
                href="/super/suscripciones"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Suscripciones
                {pendingSubs ? (
                  <span className="grid min-w-5 place-items-center rounded-full bg-warning px-1 text-[11px] font-bold leading-5 text-warning-foreground">
                    {pendingSubs > 99 ? "99+" : pendingSubs}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/super/referidos"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Referidos
                {pendingReferrals ? (
                  <span className="grid min-w-5 place-items-center rounded-full bg-warning px-1 text-[11px] font-bold leading-5 text-warning-foreground">
                    {pendingReferrals > 99 ? "99+" : pendingReferrals}
                  </span>
                ) : null}
              </Link>
            </nav>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
