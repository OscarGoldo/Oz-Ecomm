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
    <div className="chrome-admin min-h-dvh bg-surface">
      <header className="sticky top-0 z-30 border-b border-border bg-surface-raised">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link
            href="/super"
            className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-[-0.011em]"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-ink-900 text-ink-25">
              <ShieldCheck className="size-4" />
            </span>
            Tiendify
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-[0.06em] text-ink-500">
              Super Admin
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1">
              <Link
                href="/super"
                className="rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-foreground"
              >
                Tiendas
              </Link>
              <Link
                href="/super/pagos"
                className="rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-foreground"
              >
                Pagos
              </Link>
              <Link
                href="/super/suscripciones"
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-foreground"
              >
                Suscripciones
                {pendingSubs ? (
                  <span className="grid min-w-[1.125rem] place-items-center rounded bg-warning px-1 text-3xs font-bold leading-[1.125rem] tabular-nums text-warning-foreground">
                    {pendingSubs > 99 ? "99+" : pendingSubs}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/super/referidos"
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-foreground"
              >
                Referidos
                {pendingReferrals ? (
                  <span className="grid min-w-[1.125rem] place-items-center rounded bg-warning px-1 text-3xs font-bold leading-[1.125rem] tabular-nums text-warning-foreground">
                    {pendingReferrals > 99 ? "99+" : pendingReferrals}
                  </span>
                ) : null}
              </Link>
            </nav>
            <span className="hidden text-xs text-ink-500 sm:inline">
              {user.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-input bg-background px-2.5 py-1.5 text-[0.8125rem] font-medium shadow-xs transition-colors hover:bg-muted"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-7">{children}</main>
    </div>
  );
}
