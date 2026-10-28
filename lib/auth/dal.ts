import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getUserById } from "@/data/mock-users";
import { readSession } from "@/lib/auth/session";
import type { Role, SessionUser, User } from "@/types/user";

// Data Access Layer for identity: the only place that turns a cookie into a user.
// Every page, Server Action and data getter goes through these functions.

function toSessionUser(user: User): SessionUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role, title: user.title };
}

/** The signed-in, active user, or null. Computed once per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = getUserById(session.userId);
  if (!user || user.status !== "active") return null;
  return toSessionUser(user);
});

/** The signed-in user; redirects to /login when there is none. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** The signed-in user with this role; redirects to /no-access otherwise. */
export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) redirect("/no-access");
  return user;
}
