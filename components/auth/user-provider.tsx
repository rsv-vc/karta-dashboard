"use client";

import { createContext, use, type ReactNode } from "react";
import type { SessionUser } from "@/types/user";

// Hands the signed-in user (resolved on the server) to Client Components.

const UserContext = createContext<SessionUser | null>(null);

export function UserProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  return <UserContext value={user}>{children}</UserContext>;
}

export function useUser(): SessionUser {
  const user = use(UserContext);
  if (!user) throw new Error("useUser must be used within a UserProvider");
  return user;
}
