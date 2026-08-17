import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// SECURITY DEFINER-equivalent client: bypasses RLS entirely via the service
// role key. Only use inside Server Actions for operations that genuinely
// require elevated privileges (e.g. inviting a new auth user) — never for
// anything a normal RLS-respecting client can already do, and never import
// this into a Client Component.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
