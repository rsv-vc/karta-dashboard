import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";

// Service client for what Row Level Security cannot express: creating Auth
// users, setting their passwords and blocking deactivated members. It bypasses
// RLS, so only Server Actions that have already confirmed the caller is an
// admin may use it. SUPABASE_SECRET_KEY never reaches the browser
// (scripts/check-secrets.mjs scans the client bundles after a build).

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** False until SUPABASE_SECRET_KEY is configured; member management is off without it. */
export function isAdminApiConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}

export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient<Database>(supabaseUrl(), key, NO_SESSION);
}

/** Checks an email/password pair without touching the caller's session cookies. */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const client = createClient<Database>(supabaseUrl(), supabasePublishableKey(), NO_SESSION);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return false;
  // End only the throwaway session created for this check.
  await client.auth.signOut({ scope: "local" });
  return true;
}
