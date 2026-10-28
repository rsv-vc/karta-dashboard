import type { MonthlyTarget } from "@/data/mock-targets";
import { ACTIVE_STAGES, STAGE_LABELS, isActiveStage } from "@/lib/constants";
import { daysBetween, fromDayNumber, toDateKey, toDayNumber } from "@/lib/dates";
import { buildFollowUpBoard } from "@/lib/dashboard/follow-ups";
import type { FollowUpItem } from "@/lib/dashboard/types";
import { getMonthlySummary } from "@/lib/selectors";
import { formatMonth } from "@/lib/utils";
import type { ActivityType, Lead, LeadStage } from "@/types/lead";

// Everything the agent dashboard shows, computed from the agent's own leads.
// Pure, so scripts/check-dashboard.ts can verify every number.

export const STALE_AFTER_DAYS = 14;
const DUE_NOW_LIMIT = 8;
const ATTENTION_LIMIT = 5;
const RECENT_LIMIT = 6;
const WIN_RATE_WINDOW_DAYS = 90;
const TREND_MONTHS = 6;

export interface AgentDashboard {
  kpis: {
    openPipeline: { value: number; count: number };
    wonThisMonth: { value: number; count: number };
    winRate90d: { rate: number | null; won: number; lost: number };
    followUpsDue: { overdue: number; today: number };
  };
  target: {
    monthLabel: string;
    wonValue: { actual: number; target: number };
    newLeads: { actual: number; target: number };
  };
  pipelineByStage: { stage: LeadStage; label: string; count: number; value: number }[];
  trend: { key: string; label: string; newLeads: number; won: number }[];
  dueNow: FollowUpItem[];
  dueNowTotal: number;
  needsAttention: { id: string; companyName: string; stage: LeadStage; daysSinceContact: number; neverContacted: boolean }[];
  recentActivity: { id: string; leadId: string; companyName: string; type: ActivityType; description: string; date: string }[];
}

/** The 1-12 month and year of a date key, stepped back `back` months. */
function monthOf(dateKey: string, back = 0): { year: number; month: number } {
  const [y, m] = dateKey.split("-").map(Number);
  const index = y * 12 + (m - 1) - back;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function computeAgentDashboard(
  leads: Lead[],
  { today, target }: { today: string; target: MonthlyTarget },
): AgentDashboard {
  const monthKey = today.slice(0, 7);
  const active = leads.filter((l) => isActiveStage(l.stage));
  const wonThisMonth = leads.filter((l) => l.stage === "won" && l.closedAt?.startsWith(monthKey));

  // Win rate over deals closed in the last 90 days.
  const windowStart = fromDayNumber(toDayNumber(today) - WIN_RATE_WINDOW_DAYS);
  const recentlyClosed = leads.filter((l) => l.closedAt && toDateKey(l.closedAt) > windowStart);
  const won = recentlyClosed.filter((l) => l.stage === "won").length;
  const lost = recentlyClosed.length - won;

  // One person's leads: the owner name is never shown on their own queue.
  const board = buildFollowUpBoard(leads, today, () => "");
  const due = [...board.overdue, ...board.today];

  const trend = getMonthlySummary(monthOf(today, TREND_MONTHS - 1), monthOf(today), leads).map((row) => ({
    key: row.key,
    label: formatMonth(row.key).slice(0, 3),
    newLeads: row.newLeads,
    won: row.won,
  }));

  const needsAttention = active
    .map((l) => {
      const since = l.lastContactedAt ?? l.createdAt;
      return {
        id: l.id,
        companyName: l.companyName,
        stage: l.stage,
        daysSinceContact: daysBetween(since, today),
        neverContacted: l.lastContactedAt === null,
      };
    })
    .filter((l) => l.daysSinceContact >= STALE_AFTER_DAYS)
    .sort((a, b) => b.daysSinceContact - a.daysSinceContact)
    .slice(0, ATTENTION_LIMIT);

  const recentActivity = leads
    .flatMap((l) => l.activities.map((a) => ({ ...a, leadId: l.id, companyName: l.companyName })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_LIMIT)
    .map(({ id, leadId, companyName, type, description, date }) => ({ id, leadId, companyName, type, description, date }));

  return {
    kpis: {
      openPipeline: { value: sum(active), count: active.length },
      wonThisMonth: { value: sum(wonThisMonth), count: wonThisMonth.length },
      winRate90d: { rate: won + lost > 0 ? won / (won + lost) : null, won, lost },
      followUpsDue: { overdue: board.overdue.length, today: board.today.length },
    },
    target: {
      monthLabel: formatMonth(monthKey).split(" ")[0],
      wonValue: { actual: sum(wonThisMonth), target: target.wonValue },
      newLeads: { actual: leads.filter((l) => l.createdAt.startsWith(monthKey)).length, target: target.newLeads },
    },
    pipelineByStage: ACTIVE_STAGES.map((stage) => {
      const inStage = active.filter((l) => l.stage === stage);
      return { stage, label: STAGE_LABELS[stage], count: inStage.length, value: sum(inStage) };
    }),
    trend,
    dueNow: due.slice(0, DUE_NOW_LIMIT),
    dueNowTotal: due.length,
    needsAttention,
    recentActivity,
  };
}

function sum(leads: Lead[]): number {
  return leads.reduce((total, l) => total + l.dealValue, 0);
}
