"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { isAdmin } from "@/lib/auth/permissions";
import { ACTION_STATUSES, funnelActionSchema } from "@/lib/dashboard/funnel-health";
import { toFieldErrors } from "@/lib/leads/schemas";
import { createClient } from "@/lib/supabase/server";

// Funnel health tracker edits (admins; RLS enforces the same).

export type HealthResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function adminClient() {
  const user = await requireUser();
  return isAdmin(user) ? createClient() : null;
}

function done(): HealthResult {
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Create (no id) or update a tracker row. */
export async function saveFunnelAction(id: number | null, raw: unknown): Promise<HealthResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "Only admins can edit funnel health" };
  const parsed = funnelActionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields", fieldErrors: toFieldErrors(parsed.error) };
  const v = parsed.data;
  const row = { funnel: v.funnel, problem: v.problem, fix: v.fix, owner_label: v.owner, due_label: v.due, status: v.status };
  const { error } = id === null
    ? await supabase.from("funnel_actions").insert({ ...row, position: Date.now() % 1_000_000 })
    : await supabase.from("funnel_actions").update(row).eq("id", id);
  return error ? { ok: false, error: error.message } : done();
}

export async function setFunnelActionStatus(id: number, status: unknown): Promise<HealthResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "Only admins can edit funnel health" };
  const parsed = z.enum(ACTION_STATUSES).safeParse(status);
  if (!parsed.success) return { ok: false, error: "Unknown status" };
  const { error } = await supabase.from("funnel_actions").update({ status: parsed.data }).eq("id", id);
  return error ? { ok: false, error: error.message } : done();
}

export async function deleteFunnelAction(id: number): Promise<HealthResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "Only admins can edit funnel health" };
  const { error } = await supabase.from("funnel_actions").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : done();
}
