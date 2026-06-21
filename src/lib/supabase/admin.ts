import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 *
 * Use ONLY on the server for trusted operations that legitimately need to act
 * across tenants or write data the anon/auth roles cannot (e.g. the seed
 * script, creating orders + decrementing stock atomically, reading payment
 * proofs). Never import this into a Client Component.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
