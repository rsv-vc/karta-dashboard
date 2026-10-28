import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getUserByAuthId } from "@/data/mock-users";
import { createClient } from "@/lib/supabase/server";
import type { Role, SessionUser } from "@/types/user";

// Data Access Layer for identity: the only place that turns a Supabase session
// into an app user. Every page, Server Action and data getter goes through it.
// The role comes from the database (profiles), never from the client.

interface AuthState {
  /** Supabase auth user id, when there is a valid session. */
  authId: string | null;
  /** The active app user for that session, or null. */
  user: SessionUser | null;
}

const getAuthState = cache(async (): Promise<AuthState> => {
  // Token verification reads the clock; keep it out of prerendering.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const authId = data?.claims?.sub ?? null;
  if (!authId) return { authId: null, user: null };

  const person = getUserByAuthId(authId);
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, role, title, status")
    .eq("id", authId)
    .maybeSingle();
  if (!person || !profile || profile.status !== "active") return { authId, user: null };

  return {
    authId,
    user: { id: person.id, name: profile.name, email: profile.email, role: profile.role, title: profile.title },
  };
});

/** The signed-in, active user, or null. Computed once per request. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getAuthState()).user;
}

/**
 * The signed-in user; otherwise redirects to /login. A valid session for an
 * inactive or unknown person is signed out first, so the proxy (which sees a
 * session) and this check can never bounce the browser back and forth.
 */
export async function requireUser(): Promise<SessionUser> {
  const { authId, user } = await getAuthState();
  if (!user) redirect(authId ? "/auth/signout" : "/login");
  return user;
}

/** The signed-in user with this role; redirects to /no-access otherwise. */
export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) redirect("/no-access");
  return user;
}
