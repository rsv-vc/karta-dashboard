import "server-only";
import { requireRole } from "@/lib/auth/dal";
import { fetchAppConfig, fetchLeadSummaries } from "@/lib/data/repo";
import { createClient } from "@/lib/supabase/server";
import type { AppConfig, DropReasonScope } from "@/lib/config";
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

export interface CityMaster {
  name: string;
  active: boolean;
  accounts: number;
}

export interface ReasonMaster {
  id: number;
  label: string;
  appliesTo: DropReasonScope;
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
  cities: CityMaster[];
  pricing: AppConfig["pricing"];
  stages: StageMaster[];
  reasons: ReasonMaster[];
}

export async function getMastersData(): Promise<MastersData> {
  await requireRole("admin");
  const supabase = await createClient();
  const [config, leads, cities] = await Promise.all([
    fetchAppConfig(),
    fetchLeadSummaries(),
    supabase.from("cities").select("*").order("position").order("name"),
  ]);
  if (cities.error) throw new Error(`Could not load cities: ${cities.error.message}`);
  const count = (pick: (l: (typeof leads)[number]) => unknown, value: unknown) => leads.filter((l) => pick(l) === value).length;

  return {
    industries: config.industries.map((i) => ({ ...i, accounts: count((l) => l.industry, i.name) })),
    cities: cities.data.map((c) => ({ name: c.name, active: c.active, accounts: count((l) => l.city, c.name) })),
    pricing: config.pricing,
    stages: (Object.keys(config.stages) as LeadStage[]).map((stage) => ({
      stage,
      ...config.stages[stage],
      accounts: count((l) => l.stage, stage),
    })),
    reasons: config.dropReasons.map((r) => ({ ...r, accounts: count((l) => l.dropReasonId, r.id) })),
  };
}
