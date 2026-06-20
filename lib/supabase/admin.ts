import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. BYPASSES RLS — server-only, never import in a
 * client component. The key has no NEXT_PUBLIC_ prefix so it is never bundled.
 * Only used by /admin/api/* and /account/api/delete.
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
