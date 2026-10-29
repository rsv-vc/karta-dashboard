import { CITIES, INDUSTRIES, STAGES } from "@/lib/constants";
import { STAGE_POINTS } from "@/lib/scoring";
import type { LeadStage } from "@/types/lead";

// The masters (Masters page, stored in the database) as one value the app
// passes around: industries with their average volume, cities, pricing
// defaults, stage names and points, and drop-off reasons. DEFAULT_APP_CONFIG
// mirrors the seeded values, so pure modules and tests work without a database.

export interface IndustryConfig {
  name: string;
  /** null = no industry average: the calls must be entered per account. */
  avgCallsPerMonth: number | null;
  minutesPerCall: number;
  active: boolean;
}

export interface PricingConfig {
  pricePerMinute: number;
  priceLow: number;
  priceHigh: number;
  minutesPerCall: number;
  contractMonths: number;
}

export interface StageConfigEntry {
  label: string;
  points: number;
}

export type DropReasonScope = "lost" | "deferred" | "both";

export interface DropReason {
  id: number;
  label: string;
  appliesTo: DropReasonScope;
  active: boolean;
}

export interface AppConfig {
  industries: IndustryConfig[];
  cities: string[];
  pricing: PricingConfig;
  stages: Record<LeadStage, StageConfigEntry>;
  dropReasons: DropReason[];
}

const DEFAULT_AVERAGES: Record<string, number> = {
  Bank: 1_500_000,
  Insurance: 1_000_000,
  NBFC: 800_000,
  "Housing finance": 800_000,
  "Wealth & AMC": 800_000,
  Fintech: 500_000,
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  industries: INDUSTRIES.map((name) => ({ name, avgCallsPerMonth: DEFAULT_AVERAGES[name] ?? null, minutesPerCall: 5, active: true })),
  cities: [...CITIES],
  pricing: { pricePerMinute: 4, priceLow: 3, priceHigh: 5, minutesPerCall: 5, contractMonths: 12 },
  stages: Object.fromEntries(STAGES.map((s) => [s.value, { label: s.label, points: STAGE_POINTS[s.value] }])) as Record<
    LeadStage,
    StageConfigEntry
  >,
  dropReasons: [],
};

export const stageLabelsOf = (config: Pick<AppConfig, "stages">) =>
  Object.fromEntries(Object.entries(config.stages).map(([k, v]) => [k, v.label])) as Record<LeadStage, string>;

export const stagePointsOf = (config: Pick<AppConfig, "stages">) =>
  Object.fromEntries(Object.entries(config.stages).map(([k, v]) => [k, v.points])) as Record<LeadStage, number>;

/** Reasons offered when moving an account to `to` (Lost or Deferred). */
export function reasonsFor(config: Pick<AppConfig, "dropReasons">, to: "lost" | "deferred"): DropReason[] {
  return config.dropReasons.filter((r) => r.active && (r.appliesTo === "both" || r.appliesTo === to));
}

export const activeIndustries = (config: Pick<AppConfig, "industries">) => config.industries.filter((i) => i.active).map((i) => i.name);
