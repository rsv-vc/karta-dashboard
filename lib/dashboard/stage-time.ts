import { PIPELINE_ORDER, STAGE_LABELS } from "@/lib/constants";
import { daysBetween } from "@/lib/dates";
import type { Lead, LeadStage, StageHistoryEntry } from "@/types/lead";

// Days spent in each stage, from an account's stage history. Pure. A stage
// visited twice (re-opened) adds up. Days are calendar days in India time, so a
// move on the same day counts as 0.

/** The main path, then the exit: the order every stage-time view uses. */
const DISPLAY_ORDER: readonly LeadStage[] = [...PIPELINE_ORDER, "lost"];

export interface StageDays {
  stage: LeadStage;
  /** Null when the account never reached this stage (skipped or not there yet). */
  days: number | null;
  /** The account is in this stage now, so its days are still counting. */
  current: boolean;
}

const stayDays = (entry: StageHistoryEntry, today: string) => Math.max(0, daysBetween(entry.startDate, entry.endDate ?? today));

/** One account: every main-path stage in order, plus Lost / Deprioritised if it went there. */
export function daysInStages(history: StageHistoryEntry[], today: string): StageDays[] {
  return DISPLAY_ORDER.filter((stage) => stage !== "lost" || history.some((h) => h.stage === "lost")).map((stage) => {
    const stays = history.filter((h) => h.stage === stage);
    return {
      stage,
      days: stays.length ? stays.reduce((n, h) => n + stayDays(h, today), 0) : null,
      current: stays.some((h) => h.endDate === null),
    };
  });
}

export interface StageAverage {
  stage: LeadStage;
  label: string;
  /** Accounts that have left this stage, and their average days there. */
  movedOn: number;
  avgDaysMovedOn: number | null;
  /** Accounts in this stage now, and their average days so far. */
  inStage: number;
  avgDaysSoFar: number | null;
}

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** Across accounts: finished stays and stays still running are kept apart, since the second are still growing. */
export function averageStageDays(leads: Lead[], today: string, labels: Record<LeadStage, string> = STAGE_LABELS): StageAverage[] {
  return DISPLAY_ORDER.map((stage) => {
    const finished: number[] = [];
    const running: number[] = [];
    for (const lead of leads) {
      const stays = lead.stageHistory.filter((h) => h.stage === stage);
      const done = stays.filter((h) => h.endDate !== null);
      if (done.length) finished.push(done.reduce((n, h) => n + stayDays(h, today), 0));
      const now = stays.find((h) => h.endDate === null);
      if (now) running.push(stayDays(now, today));
    }
    return {
      stage,
      label: labels[stage],
      movedOn: finished.length,
      avgDaysMovedOn: average(finished),
      inStage: running.length,
      avgDaysSoFar: average(running),
    };
  });
}
