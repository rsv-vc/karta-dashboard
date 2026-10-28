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

export const STAGES: readonly StageConfig[] = [
  {
    value: "new",
    label: "New",
    badgeClass: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    dotClass: "bg-slate-500",
    chartColor: "#64748b",
  },
  {
    value: "contacted",
    label: "Contacted",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    dotClass: "bg-blue-500",
    chartColor: "#3b82f6",
  },
  {
    value: "qualified",
    label: "Qualified",
    badgeClass: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
    dotClass: "bg-violet-500",
    chartColor: "#8b5cf6",
  },
  {
    value: "proposal",
    label: "Proposal",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    dotClass: "bg-amber-500",
    chartColor: "#f59e0b",
  },
  {
    value: "negotiation",
    label: "Negotiation",
    badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
    dotClass: "bg-orange-500",
    chartColor: "#f97316",
  },
  {
    value: "won",
    label: "Won",
    badgeClass: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    dotClass: "bg-green-500",
    chartColor: "#22c55e",
  },
  {
    value: "lost",
    label: "Lost",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    dotClass: "bg-red-500",
    chartColor: "#ef4444",
  },
];

export const STAGE_BY_VALUE = Object.fromEntries(STAGES.map((s) => [s.value, s])) as Record<
  LeadStage,
  StageConfig
>;

/** Every stage value, for zod enums and parsing. */
export const STAGE_VALUES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const satisfies readonly LeadStage[];

/** The forward path a lead moves along. "lost" is a terminal exit, not a step. */
export const PIPELINE_ORDER: readonly LeadStage[] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
];

export const ACTIVE_STAGES: readonly LeadStage[] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
];

export const CLOSED_STAGES: readonly LeadStage[] = ["won", "lost"];

export function isActiveStage(stage: LeadStage): boolean {
  return ACTIVE_STAGES.includes(stage);
}

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  linkedin: "LinkedIn",
  referral: "Referral",
  cold_email: "Cold Email",
  cold_call: "Cold Call",
  website: "Website",
  event: "Event",
  partner: "Partner",
};

export const SOURCES = Object.keys(SOURCE_LABELS) as LeadSource[];

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

export const INDUSTRIES = [
  "SaaS",
  "FinTech",
  "Healthcare",
  "EdTech",
  "Manufacturing",
  "Retail",
  "Logistics",
  "Real Estate",
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
