"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { toFieldErrors } from "@/lib/leads/schemas";
import { verifyPassword } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { newPasswordSchema, profileSchema } from "@/lib/team";

// Self-service settings. Column grants let people change only their own name
// and title; role, status and email stay with admins.

export type SettingsResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const invalid = (error: z.ZodError): SettingsResult => ({
  ok: false,
  error: "Please fix the highlighted fields",
  fieldErrors: toFieldErrors(error),
});

export async function updateProfile(raw: unknown): Promise<SettingsResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

const changePasswordSchema = z.object({ current: z.string().min(1, "Enter your current password") }).and(newPasswordSchema);

/** Change your own password; the current one is checked first. */
export async function changePassword(raw: unknown): Promise<SettingsResult> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await verifyPassword(user.email, parsed.data.current))) {
    return { ok: false, error: "Your current password is not right", fieldErrors: { current: "Not right" } };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error?.code === "same_password") {
    return { ok: false, error: "Pick a password you have not used here", fieldErrors: { password: "Same as before" } };
  }
  return error ? { ok: false, error: error.message } : { ok: true };
}
