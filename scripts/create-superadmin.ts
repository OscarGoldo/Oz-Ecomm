/**
 * Create (or promote) a super_admin user — the platform owner who manages all
 * tenants at /super. Idempotent.
 *
 * Usage:
 *   SUPERADMIN_EMAIL=tu+super@gmail.com npm run create-superadmin
 *   # or: npm run create-superadmin -- tu+super@gmail.com
 *
 * Tip: use a Gmail "+alias" (e.g. ovalery1903+super@gmail.com) so it's a
 * distinct account from your store-owner login but lands in the same inbox.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.SUPERADMIN_EMAIL ?? process.argv[2];

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!EMAIL) {
  console.error("✗ Provide an email: SUPERADMIN_EMAIL=you@mail.com npm run create-superadmin");
  process.exit(1);
}

const db = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = EMAIL!.trim();
  console.log(`→ Creating super_admin: ${email}`);

  // Find or create the auth user.
  let userId: string | undefined;
  const created = await db.auth.admin.createUser({ email, email_confirm: true });
  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    const list = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
    userId = list.data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    )?.id;
  }
  if (!userId) {
    console.error("✗ Could not create or find the auth user");
    process.exit(1);
  }

  const { error } = await db.from("users").upsert(
    {
      id: userId,
      store_id: null,
      full_name: "Super Admin",
      email,
      role: "super_admin",
      active: true,
    },
    { onConflict: "id" },
  );
  if (error) {
    console.error("✗ Failed to upsert user row:", error.message);
    process.exit(1);
  }

  console.log("✓ Done. Log in at /login with this email → you land on /super.");
}

main().catch((err) => {
  console.error("✗ Failed:", err);
  process.exit(1);
});
