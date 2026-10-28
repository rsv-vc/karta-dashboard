import type { CompanySize, LeadPriority, LeadSource, LeadStage } from "@/types/lead";

/** Real calendar date in India ("YYYY-MM-DD"). */
function istToday(): string {
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
}

/**
 * The app's "today". NEXT_PUBLIC_APP_TODAY freezes it (the demo uses
 * 2026-10-28 so the seeded data stays meaningful); otherwise it is the real IST
 * date. All overdue / due-today / upcoming logic uses this, never `new Date()`.
 */
export const TODAY = /^\d{4}-\d{2}-\d{2}$/.test(process.env.NEXT_PUBLIC_APP_TODAY ?? "")
  ? (process.env.NEXT_PUBLIC_APP_TODAY as string)
  : istToday();

/** TODAY as a local-midnight Date, for date-fns helpers. */
export function getToday(): Date {
  const [y, m, d] = TODAY.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export interface StageConfig {
  value: LeadStage;
  label: string;
  /** Full literal Tailwind classes; dynamic class names are invisible to Tailwind. */
  badgeClass: string;
  dotClass: string;
  /** Raw color for charts (Tailwind 500 shade). */
  chartColor: string;
}

const stage = (value: LeadStage, label: string, color: string, badgeClass: string, dotClass: string): StageConfig => ({
  value,
  label,
  badgeClass,
  dotClass,
  chartColor: color,
});

/** Every stage in display order: the main path, then the exits. */
export const STAGES: readonly StageConfig[] = [
  stage("not_met", "Not met yet", "#64748b", "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200", "bg-slate-500"),
  stage("discovery_done", "Discovery done", "#3b82f6", "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300", "bg-blue-500"),
  stage("follow_up", "Follow-up / deep dive", "#06b6d4", "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300", "bg-cyan-500"),
  stage("technical_round", "Bot / technical round", "#6366f1", "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300", "bg-indigo-500"),
  stage("poc_pitched", "POC pitched", "#8b5cf6", "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300", "bg-violet-500"),
  stage("poc_approved", "POC approved", "#d946ef", "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300", "bg-fuchsia-500"),
  stage("poc_ongoing", "POC ongoing", "#f59e0b", "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", "bg-amber-500"),
  stage("won", "Won", "#22c55e", "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300", "bg-green-500"),
  stage("no_show", "No-show", "#78716c", "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200", "bg-stone-500"),
  stage("deferred", "Deferred", "#f97316", "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300", "bg-orange-500"),
  stage("lost", "Lost", "#ef4444", "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", "bg-red-500"),
];

export const STAGE_BY_VALUE = Object.fromEntries(STAGES.map((s) => [s.value, s])) as Record<
  LeadStage,
  StageConfig
>;

/** Every stage value, for zod enums and parsing. */
export const STAGE_VALUES = [
  "not_met",
  "discovery_done",
  "follow_up",
  "technical_round",
  "poc_pitched",
  "poc_approved",
  "poc_ongoing",
  "won",
  "no_show",
  "deferred",
  "lost",
] as const satisfies readonly LeadStage[];

/** The main path an account moves along (skipping steps is allowed). */
export const PIPELINE_ORDER: readonly LeadStage[] = [
  "not_met",
  "discovery_done",
  "follow_up",
  "technical_round",
  "poc_pitched",
  "poc_approved",
  "poc_ongoing",
  "won",
];

/** Open stages: the account can still move. Deferred and No-show can re-open. */
export const ACTIVE_STAGES: readonly LeadStage[] = [
  "not_met",
  "no_show",
  "discovery_done",
  "follow_up",
  "technical_round",
  "poc_pitched",
  "poc_approved",
  "poc_ongoing",
  "deferred",
];

export const CLOSED_STAGES: readonly LeadStage[] = ["won", "lost"];

export function isActiveStage(stage: LeadStage): boolean {
  return ACTIVE_STAGES.includes(stage);
}

/**
 * Stage moves (mirrors private.can_move_stage in the database): forward along
 * the main path, No-show only before discovery, Deferred and Lost from any open
 * stage, No-show and Deferred re-open onto the main path, Won and Lost final.
 */
export function canMoveStage(from: LeadStage, to: LeadStage): boolean {
  if (from === "won" || from === "lost" || from === to) return false;
  if (to === "lost" || to === "deferred") return true;
  if (to === "no_show") return from === "not_met";
  if (from === "no_show" || from === "deferred") return true;
  return PIPELINE_ORDER.indexOf(to) > PIPELINE_ORDER.indexOf(from);
}

/** Has the account held its first discovery meeting? (Counts toward the funnel.) */
export function isPastDiscovery(stage: LeadStage): boolean {
  return PIPELINE_ORDER.indexOf(stage) >= PIPELINE_ORDER.indexOf("discovery_done");
}

export const STAGE_LABELS = Object.fromEntries(STAGES.map((s) => [s.value, s.label])) as Record<LeadStage, string>;

export const SOURCE_LABELS: Record<LeadSource, string> = {
  linkedin: "LinkedIn",
  referral: "Referral",
  cold_email: "Cold Email",
  cold_call: "Cold Call",
  website: "Website",
  event: "Event",
  partner: "Partner",
  pipeloom: "Pipeloom",
  voice_bot: "Voice Bot campaign",
  head_of_growth: "Head of Growth",
  unknown: "Not recorded",
};

/** The three channels the sales MIS tracks, in the order its tables show them. */
export const MIS_SOURCES: LeadSource[] = ["pipeloom", "voice_bot", "head_of_growth"];

/** MIS channels first, then the general ones. */
export const SOURCES: LeadSource[] = [
  ...MIS_SOURCES,
  ...(Object.keys(SOURCE_LABELS) as LeadSource[]).filter((s) => !MIS_SOURCES.includes(s)),
];

export const PRIORITY_LABELS: Record<LeadPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** Ordered high → low, the order lists and filters show them in. */
export const PRIORITIES: LeadPriority[] = ["high", "medium", "low"];

/** Full literal classes (Tailwind cannot see dynamically built names). */
export const PRIORITY_STYLES: Record<LeadPriority, { dotClass: string; textClass: string }> = {
  high: { dotClass: "bg-red-500", textClass: "text-red-700 dark:text-red-400" },
  medium: { dotClass: "bg-amber-500", textClass: "text-amber-700 dark:text-amber-400" },
  low: { dotClass: "bg-slate-400", textClass: "text-muted-foreground" },
};

export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  "1-10": "1–10 employees",
  "11-50": "11–50 employees",
  "51-200": "51–200 employees",
  "201-1000": "201–1,000 employees",
  "1000+": "1,000+ employees",
};

export const COMPANY_SIZES = Object.keys(COMPANY_SIZE_LABELS) as CompanySize[];

/** Account segments (the workbook's Segment column), stored in the industry field. */
export const INDUSTRIES = [
  "NBFC",
  "Fintech",
  "Housing finance",
  "Bank",
  "Insurance",
  "Wealth & AMC",
  "Healthcare",
  "Other",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export const CITIES = [
  "Bengaluru",
  "Mumbai",
  "Delhi NCR",
  "Pune",
  "Hyderabad",
  "Chennai",
  "Ahmedabad",
  "Kolkata",
] as const;
