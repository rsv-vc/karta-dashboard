"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyCredentials } from "@/data/mock-credentials";
import { getUserById } from "@/data/mock-users";
import { createSession, deleteSession } from "@/lib/auth/session";

// Auth Server Actions. Each one validates its own input; nothing from the
// client is trusted.

export interface LoginState {
  error?: string;
}

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

/** Only same-origin relative paths, so `next` cannot redirect off-site. */
function safeNext(next: string | undefined | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/dashboard";
  return next;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  // One generic message: never reveal whether the email or the password was wrong.
  if (!parsed.success) return { error: "Invalid email or password" };

  const user = verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) return { error: "Invalid email or password" };

  await createSession(user.id);
  redirect(safeNext(parsed.data.next));
}

/** One-click demo sign-in. Allowed while the app runs on mock data (removed in Phase 9). */
export async function loginAsDemo(userId: string, next: string | null): Promise<void> {
  const user = getUserById(userId);
  if (!user || user.status !== "active") redirect("/login");
  await createSession(user.id);
  redirect(safeNext(next));
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}

/** Development-only "view as" switch. */
export async function switchUserDev(userId: string): Promise<{ error: string } | void> {
  if (process.env.NODE_ENV !== "development") return { error: "User switching is only available in development" };
  const user = getUserById(userId);
  if (!user || user.status !== "active") return { error: "Unknown or inactive user" };
  await createSession(user.id);
  redirect("/dashboard");
}
