import { mockUsers } from "@/data/mock-users";
import type { User } from "@/types/user";

/**
 * Shared password for every mock user. Mock only: replaced by real auth in Phase 9.
 */
export const DEMO_PASSWORD = "karta-demo";

/** Returns the active user matching these credentials, or null. Email match is case-insensitive. */
export function verifyCredentials(email: string, password: string): User | null {
  const normalized = email.trim().toLowerCase();
  const user = mockUsers.find((u) => u.email.toLowerCase() === normalized);
  if (!user || user.status !== "active" || password !== DEMO_PASSWORD) return null;
  return user;
}
