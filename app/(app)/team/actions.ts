"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { isAdmin } from "@/lib/auth/permissions";
import { TODAY, isActiveStage } from "@/lib/constants";
import { fetchAccessRules, fetchTeam, fetchVisibleLeads } from "@/lib/data/repo";
import { toFieldErrors } from "@/lib/leads/schemas";
import { createAdminClient, isAdminApiConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  MEMBER_TYPE_LABELS,
  activeOwners,
  addMemberSchema,
  allowedEmailSchema,
  generateTempPassword,
  isEmailAllowed,
} from "@/lib/team";
import type { Role, UserStatus } from "@/types/user";

// Admin-only team management. Each action re-checks that the caller is an
// active admin; the database enforces the rest (the email rule trigger and
// admin_update_member). The service client is used only for Auth itself:
// creating users, setting passwords and blocking deactivated members.

export type TeamActionResult =
  | { ok: true; password?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const NOT_CONFIGURED: TeamActionResult = {
  ok: false,
  error: "Member management needs SUPABASE_SECRET_KEY on the server. Ask whoever deployed the app to add it.",
};

/** The caller if they are an active admin, else null. */
async function adminCaller() {
  const user = await requireUser();
  return isAdmin(user) ? user : null;
}

function done(result: TeamActionResult = { ok: true }): TeamActionResult {
  revalidatePath("/", "layout");
  return result;
}

/** Create an employee or sales agent with a temporary password, shown once to the admin. */
export async function addMember(raw: unknown): Promise<TeamActionResult> {
  const caller = await adminCaller();
  if (!caller) return { ok: false, error: "Only admins can add members" };
  if (!isAdminApiConfigured()) return NOT_CONFIGURED;
  const parsed = addMemberSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields", fieldErrors: toFieldErrors(parsed.error) };
  const input = parsed.data;

  // Friendly early answer; the database trigger refuses the same cases regardless.
  const { companyDomains, allowedEmails } = await fetchAccessRules();
  if (!isEmailAllowed(input.email, input.role, companyDomains, allowedEmails)) {
    const message =
      input.role === "admin"
        ? `Employees need a company email (${companyDomains.map((d) => `@${d}`).join(", ")})`
        : "Use a company email, or add this address to the allowed outside emails first";
    return { ok: false, error: message, fieldErrors: { email: message } };
  }
  if ((await fetchTeam()).some((m) => m.email === input.email)) {
    return { ok: false, error: "Someone on the team already uses this email", fieldErrors: { email: "Already on the team" } };
  }

  const admin = createAdminClient();
  const password = generateTempPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: { name: input.name },
  });
  if (error || !data.user) {
    const taken = error?.code === "email_exists" || /already/i.test(error?.message ?? "");
    return taken
      ? { ok: false, error: "This email already has an account", fieldErrors: { email: "Already registered" } }
      : { ok: false, error: error?.message ?? "Could not create the account" };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    name: input.name,
    email: input.email,
    role: input.role,
    title: input.title || MEMBER_TYPE_LABELS[input.role],
    joined_at: TODAY,
    must_change_password: true,
  });
  if (profileError) {
    // Keep Auth and profiles in step: no account without a profile.
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: profileError.message };
  }
  return done({ ok: true, password });
}

/** Give a member a new temporary password; they must change it at their next sign-in. */
export async function resetMemberPassword(memberId: string): Promise<TeamActionResult> {
  const caller = await adminCaller();
  if (!caller) return { ok: false, error: "Only admins can reset passwords" };
  if (!isAdminApiConfigured()) return NOT_CONFIGURED;
  if (memberId === caller.id) return { ok: false, error: "Change your own password in Settings" };
  const member = (await fetchTeam()).find((m) => m.id === memberId);
  if (!member) return { ok: false, error: "This member no longer exists" };
  if (member.isDemo) return { ok: false, error: "Demo accounts keep the shared demo password" };

  const admin = createAdminClient();
  const password = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(memberId, { password });
  if (error) return { ok: false, error: error.message };
  const { error: flagError } = await admin.from("profiles").update({ must_change_password: true }).eq("id", memberId);
  if (flagError) return { ok: false, error: flagError.message };
  return done({ ok: true, password });
}

const accessSchema = z.object({
  role: z.enum(["admin", "sales_agent"]),
  status: z.enum(["active", "inactive"]),
  /** Agent who receives the member's active leads when they leave the sales team. */
  reassignTo: z.string().optional(),
});

/** Change a member's type or status. Leaving the sales team first moves their active leads. */
export async function updateMemberAccess(memberId: string, raw: unknown): Promise<TeamActionResult> {
  const caller = await adminCaller();
  if (!caller) return { ok: false, error: "Only admins can manage the team" };
  const parsed = accessSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid change" };
  const { role, status, reassignTo } = parsed.data as { role: Role; status: UserStatus; reassignTo?: string };

  const team = await fetchTeam();
  const member = team.find((m) => m.id === memberId);
  if (!member) return { ok: false, error: "This member no longer exists" };
  const supabase = await createClient();

  // Deactivating someone who owns open accounts moves those accounts first.
  const deactivating = status !== "active";
  const activeLeadIds = deactivating
    ? (await fetchVisibleLeads()).filter((l) => l.ownerId === memberId && isActiveStage(l.stage)).map((l) => l.id)
    : [];
  if (activeLeadIds.length > 0) {
    if (!reassignTo || reassignTo === memberId || !activeOwners(team).some((a) => a.id === reassignTo)) {
      return { ok: false, error: "Pick who takes over their open accounts", fieldErrors: { reassignTo: "Required" } };
    }
    const { error } = await supabase.rpc("reassign_leads", { p_lead_ids: activeLeadIds, p_to: reassignTo });
    if (error) return { ok: false, error: error.message };
  }

  const { error } = await supabase.rpc("admin_update_member", { p_id: memberId, p_role: role, p_status: status });
  if (error) return { ok: false, error: error.message };

  // Block (or unblock) sign-in itself; the app already treats inactive members as signed out.
  if (status !== member.status && isAdminApiConfigured()) {
    await createAdminClient().auth.admin.updateUserById(memberId, {
      ban_duration: status === "inactive" ? "876000h" : "none",
    });
  }
  return done();
}

const targetSchema = z.object({
  userId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Pick a month"),
  wonValue: z.coerce.number().int("Whole rupees only").min(0, "Cannot be negative").max(1_000_000_000_000, "Too large"),
  newLeads: z.coerce.number().int("Whole numbers only").min(0, "Cannot be negative").max(10_000, "Too large"),
});

/** Set one agent's targets for a month (admins only under RLS). */
export async function setMonthlyTarget(raw: unknown): Promise<TeamActionResult> {
  const caller = await adminCaller();
  if (!caller) return { ok: false, error: "Only admins can set targets" };
  const parsed = targetSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields", fieldErrors: toFieldErrors(parsed.error) };
  const { userId, month, wonValue, newLeads } = parsed.data;
  if (!activeOwners(await fetchTeam()).some((a) => a.id === userId)) return { ok: false, error: "Targets are for active team members" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("monthly_targets")
    .upsert({ user_id: userId, month: `${month}-01`, won_value: wonValue, new_leads: newLeads }, { onConflict: "user_id,month" });
  return error ? { ok: false, error: error.message } : done();
}

export async function addAllowedEmail(raw: unknown): Promise<TeamActionResult> {
  const caller = await adminCaller();
  if (!caller) return { ok: false, error: "Only admins can allow emails" };
  const parsed = allowedEmailSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, fieldErrors: { email: parsed.error.issues[0].message } };

  const supabase = await createClient();
  const { error } = await supabase.from("allowed_emails").insert({ email: parsed.data, added_by: caller.id });
  if (error?.code === "23505") return { ok: false, error: "That email is already allowed", fieldErrors: { email: "Already allowed" } };
  return error ? { ok: false, error: error.message } : done();
}

/** Removing an address stops new accounts with it; existing members keep their access. */
export async function removeAllowedEmail(email: string): Promise<TeamActionResult> {
  const caller = await adminCaller();
  if (!caller) return { ok: false, error: "Only admins can change allowed emails" };
  const supabase = await createClient();
  const { error } = await supabase.from("allowed_emails").delete().eq("email", email);
  return error ? { ok: false, error: error.message } : done();
}
