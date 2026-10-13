import { cache } from "react";
import { redirect } from "next/navigation";

import { storeClosedByOwner } from "@/lib/store-status";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, Store } from "@/types/database";

export interface SessionContext {
  user: AppUser;
  store: Store | null;
  /**
   * Supabase Auth `user_metadata`. The user can write it themselves, so it is
   * only good for their own preferences (e.g. which notices they dismissed),
   * never for anything that grants access.
   */
  metadata: Record<string, unknown>;
}

/**
 * Resolve the authenticated app user (row in public.users) and their store.
 * Returns null when there is no valid session or no matching profile row.
 * `cache`d per request so multiple callers don't re-query.
 */
export const getSessionContext = cache(
  async (): Promise<SessionContext | null> => {
    const supabase = createClient();

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return null;

    const { data: appUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();
    if (!appUser || !appUser.active) return null;

    let store: Store | null = null;
    if (appUser.store_id) {
      const { data } = await supabase
        .from("stores")
        .select("*")
        .eq("id", appUser.store_id)
        .single();
      store = data ?? null;
    }

    return { user: appUser, store, metadata: authUser.user_metadata ?? {} };
  },
);

/** Guard for panel routes: redirect to /login when not an authenticated owner. */
export async function requireStoreUser(): Promise<SessionContext & { store: Store }> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (ctx.user.role === "super_admin") redirect("/super");
  if (!ctx.store) redirect("/login?error=no-store");
  // A store its owner closed has no panel to work in, only the way back.
  if (storeClosedByOwner(ctx.store)) redirect("/tienda-cerrada");
  return { ...ctx, store: ctx.store };
}

/** Guard for super-admin routes. */
export async function requireSuperAdmin(): Promise<AppUser> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (ctx.user.role !== "super_admin") redirect("/panel");
  return ctx.user;
}
