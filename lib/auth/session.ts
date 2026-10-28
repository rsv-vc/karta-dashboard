import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  getSessionSecret,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth/session-token";

// Cookie-backed session. Writing (create/delete) only works inside Server Actions
// or Route Handlers; reading works anywhere on the server.

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(userId, getSessionSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** The verified session, or null if missing, tampered or expired. */
export async function readSession(): Promise<SessionPayload | null> {
  // The expiry check reads the clock; connection() keeps it out of prerendering.
  await connection();
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value, getSessionSecret());
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
