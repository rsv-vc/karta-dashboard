import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { DEFAULT_TARGET, type MonthlyTarget } from "@/data/mock-targets";
import { toDirectoryEntryFromDb, toLead, type LeadDbRowWithRelations } from "@/lib/data/mappers";
import { createClient } from "@/lib/supabase/server";
import type { Lead, LeadDirectoryEntry } from "@/types/lead";
import type { User } from "@/types/user";

// Raw reads from Supabase as the signed-in user. Row Level Security decides
// what comes back: agents get their own leads, admins get all of them. Each
// read is cached for the duration of one request.

const LEAD_SELECT = "*, lead_stage_history(*), lead_activities(*)";

export class DataError extends Error {}

function fail(what: string, error: { message: string }): never {
  throw new DataError(`Could not load ${what}: ${error.message}`);
}

/** The whole team from profiles (every signed-in user may read it), sorted by name. */
export const fetchTeam = cache(async (): Promise<User[]> => {
  // Often fetched in parallel with the session check: keep it out of prerendering too.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, title, status, joined_at")
    .order("name");
  if (error) fail("the team", error);
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    title: p.title,
    status: p.status,
    joinedAt: p.joined_at,
  }));
});

/** Every lead this user may see in full, with history and activities. */
export const fetchVisibleLeads = cache(async (): Promise<Lead[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select(LEAD_SELECT).order("id");
  if (error) fail("leads", error);
  return (data as unknown as LeadDbRowWithRelations[]).map(toLead);
});

/** One lead if this user may see it in full, else null. */
export const fetchLead = cache(async (id: string): Promise<Lead | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select(LEAD_SELECT).eq("id", id).maybeSingle();
  if (error) fail("the lead", error);
  return data ? toLead(data as unknown as LeadDbRowWithRelations) : null;
});

/** The masked team directory (5 columns per lead, every lead). */
export const fetchDirectory = cache(async (): Promise<LeadDirectoryEntry[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_directory");
  if (error) fail("the lead directory", error);
  return data.map(toDirectoryEntryFromDb);
});

/**
 * Monthly targets keyed by user id for "YYYY-MM" (agents see their own,
 * admins everyone's). Falls back to the default plan when none is stored.
 */
export const fetchTargets = cache(async (monthKey: string): Promise<(userId: string) => MonthlyTarget> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_targets")
    .select("user_id, won_value, new_leads")
    .eq("month", `${monthKey}-01`);
  if (error) fail("targets", error);
  const byUser = new Map(data.map((t) => [t.user_id, { wonValue: t.won_value, newLeads: t.new_leads }]));
  return (userId: string) => byUser.get(userId) ?? DEFAULT_TARGET;
});
