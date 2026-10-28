import type { Lead, LeadStage } from "@/types/lead";

// Lead qualification scoring (the MIS workbook's "Scoring Guide"). The score is
// always computed, never stored or typed: stage points + responsiveness +
// decision access + timing/budget, out of 40.

export const STAGE_POINTS: Record<LeadStage, number> = {
  won: 15,
  poc_ongoing: 14,
  poc_approved: 13,
  poc_pitched: 12,
  technical_round: 11,
  follow_up: 9,
  discovery_done: 5,
  deferred: 3,
  no_show: 2,
  not_met: 1,
  lost: 0,
};

export const SCORE_MAX = 40;

export interface ScoreCriterion {
  key: "responsiveness" | "decisionAccess" | "timingBudget";
  label: string;
  max: number;
  /** How to score it, best first. */
  guide: string;
}

export const SCORE_CRITERIA: readonly ScoreCriterion[] = [
  {
    key: "responsiveness",
    label: "Responsiveness",
    max: 10,
    guide: "10 = replied or met in the last 14 days · 5 = replies slowly or asked to reconnect later · 3 = one missed call, still warm · 0 = not responding",
  },
  {
    key: "decisionAccess",
    label: "Decision access",
    max: 10,
    guide: "10 = CXO / SVP / Head, or more than one stakeholder engaged · 7 = one senior contact · 4 = mid-level or referral pending · 1 = wrong contact",
  },
  {
    key: "timingBudget",
    label: "Timing / budget",
    max: 5,
    guide: "5 = volumes shared, trial or POC asked for · 3 = use case clear, timing unclear · 0 = deferred, no budget, on hold or another vendor chosen",
  },
];

export type Band = "hot" | "warm" | "nurture" | "inactive";

export interface BandConfig {
  value: Band;
  label: string;
  /** Lowest score in the band. */
  min: number;
  status: string;
  playbook: string;
  badgeClass: string;
}

/** Highest first, so the first band whose minimum a score reaches is its band. */
export const BANDS: readonly BandConfig[] = [
  {
    value: "hot",
    label: "Hot",
    min: 30,
    status: "Active – closing",
    playbook: "Founder or exec on the account; POC plan with success criteria; implementation support; weekly touchpoint.",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  {
    value: "warm",
    label: "Warm",
    min: 20,
    status: "Active – progressing",
    playbook: "Next meeting within 2 weeks; full dashboard walkthrough, not just audio samples; bring in IT and the business sponsor.",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  {
    value: "nurture",
    label: "Nurture",
    min: 10,
    status: "Inactive – nurture",
    playbook: "Monthly nurture: case studies, ROI calculator, newsletter; re-score monthly.",
    badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  },
  {
    value: "inactive",
    label: "Inactive",
    min: 0,
    status: "Inactive – parked",
    playbook: "Quarterly check-in only.",
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
];

export const BAND_BY_VALUE = Object.fromEntries(BANDS.map((b) => [b.value, b])) as Record<Band, BandConfig>;

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n)));

type Scored = Pick<Lead, "stage" | "responsiveness" | "decisionAccess" | "timingBudget">;

export function leadScore(lead: Scored): number {
  return (
    STAGE_POINTS[lead.stage] +
    clamp(lead.responsiveness, 10) +
    clamp(lead.decisionAccess, 10) +
    clamp(lead.timingBudget, 5)
  );
}

export function bandFor(score: number): Band {
  return (BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1]).value;
}

export function leadBand(lead: Scored): Band {
  return bandFor(leadScore(lead));
}
