import "server-only";
import { requireRole } from "@/lib/auth/dal";
import { STAGE_VALUES } from "@/lib/constants";
import { fetchAppConfig, fetchLeadSummaries } from "@/lib/data/repo";
import { createClient } from "@/lib/supabase/server";
import type { AppConfig, DropKind } from "@/lib/config";
import type { LeadStage } from "@/types/lead";

// The Masters page (admins): every list with how many accounts use each entry,
// so an entry in use is retired (made inactive) rather than deleted.

export interface IndustryMaster {
  name: string;
  avgCallsPerMonth: number | null;
  minutesPerCall: number;
  active: boolean;
  accounts: number;
}

export interface NameMaster {
  name: string;
  active: boolean;
  accounts: number;
}

export interface ReasonMaster {
  id: number;
  label: string;
  kind: DropKind;
  active: boolean;
  accounts: number;
}

export interface StageMaster {
  stage: LeadStage;
  label: string;
  points: number;
  accounts: number;
}

export interface MastersData {
  industries: IndustryMaster[];
  cities: NameMaster[];
  competitors: NameMaster[];
  useCases: NameMaster[];
  directions: NameMaster[];
  pricing: AppConfig["pricing"];
  stages: StageMaster[];
  reasons: ReasonMaster[];
}

export async function getMastersData(): Promise<MastersData> {
  await requireRole("admin");
  const supabase = await createClient();
  const [config, leads, cities, competitors, useCases, directions] = await Promise.all([
    fetchAppConfig(),
    fetchLeadSummaries(),
    supabase.from("cities").select("*").order("position").order("name"),
    supabase.from("competitors").select("*").order("position").order("name"),
    supabase.from("use_cases").select("*").order("position").order("name"),
    supabase.from("directions").select("*").order("position").order("name"),
  ]);
  const failed = cities.error ?? competitors.error ?? useCases.error ?? directions.error;
  if (failed) throw new Error(`Could not load the masters: ${failed.message}`);
  const count = (pick: (l: (typeof leads)[number]) => unknown, value: unknown) => leads.filter((l) => pick(l) === value).length;

  return {
    industries: config.industries.map((i) => ({ ...i, accounts: count((l) => l.industry, i.name) })),
    cities: cities.data!.map((c) => ({ name: c.name, active: c.active, accounts: count((l) => l.city, c.name) })),
    competitors: competitors.data!.map((c) => ({ name: c.name, active: c.active, accounts: count((l) => l.competitor, c.name) })),
    useCases: useCases.data!.map((c) => ({ name: c.name, active: c.active, accounts: count((l) => l.useCase, c.name) })),
    directions: directions.data!.map((c) => ({ name: c.name, active: c.active, accounts: count((l) => l.direction, c.name) })),
    pricing: config.pricing,
    stages: STAGE_VALUES.map((stage) => ({
      stage,
      ...config.stages[stage],
      accounts: count((l) => l.stage, stage),
    })),
    reasons: config.dropReasons.map((r) => ({ ...r, accounts: count((l) => l.dropReasonId, r.id) })),
  };
}
