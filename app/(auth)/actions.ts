"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getUserByAuthId, getUserById } from "@/data/mock-users";
import { isDemoMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Auth Server Actions backed by Supabase Auth (email + password). Each one
// validates its own input; nothing from the client is trusted.

export interface LoginState {
  error?: string;
}

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

const GENERIC_ERROR = "Invalid email or password";

/** Only same-origin relative paths, so `next` cannot redirect off-site. */
function safeNext(next: string | undefined | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/dashboard";
  return next;
}

/** Signs in and confirms the person is an active member of the team. */
async function signIn(email: string, password: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return false;

  const { data: profile } = await supabase.from("profiles").select("status").eq("id", data.user.id).maybeSingle();
  if (!profile || profile.status !== "active" || !getUserByAuthId(data.user.id)) {
    await supabase.auth.signOut();
    return false;
  }
  return true;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  // One generic message: never reveal whether the email or the password was wrong.
  if (!parsed.success) return { error: GENERIC_ERROR };
  if (!(await signIn(parsed.data.email.toLowerCase(), parsed.data.password))) return { error: GENERIC_ERROR };
  redirect(safeNext(parsed.data.next));
}

/** Demo password for the seeded accounts; server-only, never sent to the browser. */
function demoPassword(): string | null {
  return isDemoMode() ? (process.env.DEMO_PASSWORD ?? null) : null;
}

/** One-click demo sign-in. Only when NEXT_PUBLIC_DEMO_MODE=true. */
export async function loginAsDemo(userId: string, next: string | null): Promise<void> {
  const user = getUserById(userId);
  const password = demoPassword();
  if (!user || !password || !(await signIn(user.email, password))) redirect("/login");
  redirect(safeNext(next));
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Development-only "view as" switch (also requires demo mode). */
export async function switchUserDev(userId: string): Promise<{ error: string } | void> {
  if (process.env.NODE_ENV !== "development") return { error: "User switching is only available in development" };
  const user = getUserById(userId);
  const password = demoPassword();
  if (!user || !password) return { error: "Unknown user or demo mode is off" };
  if (!(await signIn(user.email, password))) return { error: "Could not switch user" };
  redirect("/dashboard");
}
