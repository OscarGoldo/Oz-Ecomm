import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase auth session on every request and returns both the
 * (possibly mutated) response and the current user. The caller (middleware)
 * decides what to do with the user for routing/guards.
 *
 * IMPORTANT: the returned `response` carries refreshed auth cookies. If the
 * caller builds its own response (redirect/rewrite), it must copy these
 * cookies over, otherwise the session can get out of sync.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser(); it must run to
  // refresh the token. getUser() revalidates the JWT against Supabase Auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, supabase };
}
