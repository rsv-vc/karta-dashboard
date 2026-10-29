import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { DEFAULT_TARGET, type MonthlyTarget } from "@/data/mock-targets";
import { DEFAULT_APP_CONFIG, type AppConfig } from "@/lib/config";
import { toDirectoryEntryFromDb, toLead, type LeadDbRowWithRelations } from "@/lib/data/mappers";
import { createClient } from "@/lib/supabase/server";
import type { Lead, LeadDirectoryEntry } from "@/types/lead";
import type { Database } from "@/types/supabase";
import type { Member } from "@/types/user";

// Raw reads from Supabase as the signed-in user. Row Level Security decides
// what comes back: agents get their own leads, admins get all of them. Each
// read is cached for the duration of one request.

const LEAD_SELECT = "*, lead_stage_history(*), lead_activities(*)";

export class DataError extends Error {}

function fail(what: string, error: { message: string }): never {
  throw new DataError(`Could not load ${what}: ${error.message}`);
}

/** The whole team from profiles (every signed-in user may read it), sorted by name. */
export const fetchTeam = cache(async (): Promise<Member[]> => {
  // Often fetched in parallel with the session check: keep it out of prerendering too.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, title, status, joined_at, must_change_password, is_demo")
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
    mustChangePassword: p.must_change_password,
    isDemo: p.is_demo,
  }));
});

/** The masters (industries, cities, pricing, stage names and points, drop-off reasons), readable by everyone. */
export const fetchAppConfig = cache(async (): Promise<AppConfig> => {
  await connection();
  const supabase = await createClient();
  const [industries, cities, settings, stages, reasons] = await Promise.all([
    supabase.from("industries").select("*").order("position").order("name"),
    supabase.from("cities").select("*").order("position").order("name"),
    supabase.from("app_settings").select("price_per_minute, price_low, price_high, minutes_per_call, contract_months").single(),
    supabase.from("stage_settings").select("*"),
    supabase.from("drop_reasons").select("*").order("position").order("label"),
  ]);
  if (industries.error) fail("industries", industries.error);
  if (cities.error) fail("cities", cities.error);
  if (settings.error) fail("pricing", settings.error);
  if (stages.error) fail("stages", stages.error);
  if (reasons.error) fail("drop-off reasons", reasons.error);
  const s = settings.data;
  return {
    industries: industries.data.map((i) => ({
      name: i.name,
      avgCallsPerMonth: i.avg_calls_per_month,
      minutesPerCall: Number(i.minutes_per_call),
      active: i.active,
    })),
    cities: cities.data.filter((c) => c.active).map((c) => c.name),
    pricing: {
      pricePerMinute: Number(s.price_per_minute),
      priceLow: Number(s.price_low),
      priceHigh: Number(s.price_high),
      minutesPerCall: Number(s.minutes_per_call),
      contractMonths: s.contract_months,
    },
    stages: {
      ...DEFAULT_APP_CONFIG.stages,
      ...Object.fromEntries(stages.data.map((r) => [r.stage, { label: r.label, points: r.points }])),
    },
    dropReasons: reasons.data.map((r) => ({ id: r.id, label: r.label, appliesTo: r.applies_to, active: r.active })),
  };
});

/** When the signed-in person last opened their notifications (ISO), or null. */
export const fetchNotificationsSeenAt = cache(async (userId: string): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("notifications_seen_at").eq("id", userId).single();
  if (error) fail("notifications", error);
  return data.notifications_seen_at;
});

/** Company domains and the outside emails allowed for agents (the list is admin-only under RLS). */
export const fetchAccessRules = cache(async (): Promise<{ companyDomains: string[]; allowedEmails: string[] }> => {
  const supabase = await createClient();
  const [settings, allowed] = await Promise.all([
    supabase.from("app_settings").select("company_domains").single(),
    supabase.from("allowed_emails").select("email").order("email"),
  ]);
  if (settings.error) fail("settings", settings.error);
  if (allowed.error) fail("allowed emails", allowed.error);
  return { companyDomains: settings.data.company_domains, allowedEmails: allowed.data.map((r) => r.email) };
});

/** Every lead this user may see in full, with history and activities. */
export const fetchVisibleLeads = cache(async (): Promise<Lead[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select(LEAD_SELECT).order("id");
  if (error) fail("leads", error);
  return (data as unknown as LeadDbRowWithRelations[]).map(toLead);
});

/**
 * The same leads without stage history or activities, for lists, counts and
 * follow-up queues that never read them (much less data per request).
 */
export const fetchLeadSummaries = cache(async (): Promise<Lead[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select("*").order("id");
  if (error) fail("leads", error);
  return data.map((row) => toLead({ ...row, lead_stage_history: [], lead_activities: [] }));
});

export type ActionStatus = Database["public"]["Enums"]["action_status"];

export interface FunnelAction {
  id: number;
  funnel: 1 | 2 | 3;
  problem: string;
  fix: string;
  owner: string;
  due: string;
  status: ActionStatus;
}

/** The Funnel Health tracker (readable by everyone, edited by admins). */
export const fetchFunnelActions = cache(async (): Promise<FunnelAction[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("funnel_actions").select("*").order("funnel").order("position").order("id");
  if (error) fail("funnel health", error);
  return data.map((a) => ({
    id: a.id,
    funnel: a.funnel as 1 | 2 | 3,
    problem: a.problem,
    fix: a.fix,
    owner: a.owner_label,
    due: a.due_label,
    status: a.status,
  }));
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
