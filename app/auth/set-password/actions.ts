"use server";

import { redirect } from "next/navigation";
import { requireUserForPasswordChange } from "@/lib/auth/dal";
import { toFieldErrors } from "@/lib/leads/schemas";
import { createAdminClient, isAdminApiConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { newPasswordSchema } from "@/lib/team";

export type SetPasswordResult = { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Replaces the temporary password an admin set, then lets the member into the app. */
export async function setNewPassword(raw: unknown): Promise<SetPasswordResult> {
  const { user } = await requireUserForPasswordChange();
  const parsed = newPasswordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields", fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error?.code === "same_password") {
    return { ok: false, error: "Pick a new password, not the temporary one", fieldErrors: { password: "Same as the temporary password" } };
  }
  if (error) return { ok: false, error: error.message };

  // Only the server may clear the flag (people cannot write this column themselves).
  if (!isAdminApiConfigured()) return { ok: false, error: "Password saved, but the server is missing SUPABASE_SECRET_KEY" };
  const { error: flagError } = await createAdminClient()
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);
  if (flagError) return { ok: false, error: flagError.message };
  redirect("/dashboard");
}
