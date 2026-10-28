import type { MonthlyTarget } from "@/data/mock-targets";
import { PIPELINE_ORDER, SOURCES, SOURCE_LABELS, STAGE_LABELS, isActiveStage } from "@/lib/constants";
import { daysBetween, fromDayNumber, toDateKey, toDayNumber } from "@/lib/dates";
import { STALE_AFTER_DAYS } from "@/lib/dashboard/agent-metrics";
import { getMonthlySummary } from "@/lib/selectors";
import { formatMonth } from "@/lib/utils";
import type { Lead, LeadSource, LeadStage } from "@/types/lead";
import type { User } from "@/types/user";

// Team-wide metrics for the admin overview. Pure, so scripts/check-team.ts can
// verify every number.

export type TeamPeriod = "month" | "90d" | "all";
export const TEAM_PERIODS: readonly { value: TeamPeriod; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];
export const DEFAULT_PERIOD: TeamPeriod = "90d";

export function parsePeriod(raw: unknown): TeamPeriod {
  return TEAM_PERIODS.some((p) => p.value === raw) ? (raw as TeamPeriod) : DEFAULT_PERIOD;
}

/** Inclusive lower bound (date key) for the period, or null for all time. */
export function periodStart(period: TeamPeriod, today: string): string | null {
  if (period === "month") return `${today.slice(0, 7)}-01`;
  if (period === "90d") return fromDayNumber(toDayNumber(today) - 89);
  return null;
}

const inPeriod = (iso: string | null, start: string | null) => iso !== null && (start === null || toDateKey(iso) >= start);

export interface LeaderboardRow {
  agentId: string;
  name: string;
  active: number;
  openPipeline: number;
  newLeads: number;
  won: number;
  lost: number;
  wonValue: number;
  winRate: number | null;
  overdue: number;
  stale: number;
}

export interface SourceRow {
  source: LeadSource;
  label: string;
  leads: number;
  won: number;
  lost: number;
  winRate: number | null;
  openPipeline: number;
}

export interface FunnelStep {
  stage: LeadStage;
  label: string;
  reached: number;
  /** Share of the previous step that reached this one; null for the first step. */
  conversion: number | null;
}

export interface TeamDashboard {
  kpis: {
    openPipeline: { value: number; count: number };
    wonThisMonth: { value: number; count: number };
    winRate90d: { rate: number | null; won: number; lost: number };
    newLeads: { thisMonth: number; lastMonth: number; monthLabel: string; lastMonthLabel: string };
    overdueFollowUps: number;
  };
  funnel: FunnelStep[];
  lostTotal: number;
  trend: { key: string; label: string; newLeads: number; won: number; wonValue: number; pipelineValue: number }[];
  leaderboard: LeaderboardRow[];
  sources: SourceRow[];
}

function monthOf(dateKey: string, back = 0): { year: number; month: number } {
  const [y, m] = dateKey.split("-").map(Number);
  const index = y * 12 + (m - 1) - back;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

const sum = (leads: Lead[]) => leads.reduce((t, l) => t + l.dealValue, 0);
const rate = (won: number, lost: number) => (won + lost > 0 ? won / (won + lost) : null);

function isOverdue(lead: Lead, today: string): boolean {
  return isActiveStage(lead.stage) && lead.nextFollowUpAt !== null && toDateKey(lead.nextFollowUpAt) < today;
}

function isStale(lead: Lead, today: string): boolean {
  return isActiveStage(lead.stage) && daysBetween(lead.lastContactedAt ?? lead.createdAt, today) >= STALE_AFTER_DAYS;
}

/** Won/lost counts and won value for leads closed since `start`. */
function closedStats(leads: Lead[], start: string | null) {
  const closed = leads.filter((l) => inPeriod(l.closedAt, start));
  const won = closed.filter((l) => l.stage === "won");
  return { won: won.length, lost: closed.length - won.length, wonValue: sum(won) };
}

export function computeTeamDashboard(
  leads: Lead[],
  { today, period, agents }: { today: string; period: TeamPeriod; agents: User[]; targets?: Record<string, MonthlyTarget> },
): TeamDashboard {
  const monthKey = today.slice(0, 7);
  const lastMonth = monthOf(today, 1);
  const lastMonthKey = `${lastMonth.year}-${String(lastMonth.month).padStart(2, "0")}`;
  const active = leads.filter((l) => isActiveStage(l.stage));
  const start = periodStart(period, today);
  const ninety = closedStats(leads, periodStart("90d", today));
  const thisMonthClosed = leads.filter((l) => l.stage === "won" && l.closedAt?.startsWith(monthKey));

  const funnel: FunnelStep[] = PIPELINE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    reached: leads.filter((l) => l.stageHistory.some((e) => e.stage === stage)).length,
    conversion: null,
  }));
  funnel.forEach((step, i) => {
    if (i > 0) step.conversion = funnel[i - 1].reached > 0 ? step.reached / funnel[i - 1].reached : null;
  });

  const leaderboard = agents
    .filter((a) => a.role === "sales_agent" && a.status === "active")
    .map((agent): LeaderboardRow => {
      const own = leads.filter((l) => l.ownerId === agent.id);
      const ownActive = own.filter((l) => isActiveStage(l.stage));
      const stats = closedStats(own, start);
      return {
        agentId: agent.id,
        name: agent.name,
        active: ownActive.length,
        openPipeline: sum(ownActive),
        newLeads: own.filter((l) => inPeriod(l.createdAt, start)).length,
        ...stats,
        winRate: rate(stats.won, stats.lost),
        overdue: own.filter((l) => isOverdue(l, today)).length,
        stale: own.filter((l) => isStale(l, today)).length,
      };
    })
    .sort((a, b) => b.wonValue - a.wonValue || (b.winRate ?? -1) - (a.winRate ?? -1));

  const sources = SOURCES.map((source): SourceRow => {
    const bySource = leads.filter((l) => l.source === source);
    const stats = closedStats(bySource, start);
    return {
      source,
      label: SOURCE_LABELS[source],
      leads: bySource.filter((l) => inPeriod(l.createdAt, start)).length,
      won: stats.won,
      lost: stats.lost,
      winRate: rate(stats.won, stats.lost),
      openPipeline: sum(bySource.filter((l) => isActiveStage(l.stage))),
    };
  })
    .filter((s) => s.leads > 0 || s.openPipeline > 0 || s.won + s.lost > 0)
    .sort((a, b) => b.leads - a.leads || b.openPipeline - a.openPipeline);

  const trend = getMonthlySummary(monthOf(today, 5), monthOf(today), leads).map((row) => ({
    key: row.key,
    label: formatMonth(row.key).slice(0, 3),
    newLeads: row.newLeads,
    won: row.won,
    wonValue: row.wonValue,
    pipelineValue: row.pipelineValue,
  }));

  return {
    kpis: {
      openPipeline: { value: sum(active), count: active.length },
      wonThisMonth: { value: sum(thisMonthClosed), count: thisMonthClosed.length },
      winRate90d: { rate: rate(ninety.won, ninety.lost), won: ninety.won, lost: ninety.lost },
      newLeads: {
        thisMonth: leads.filter((l) => l.createdAt.startsWith(monthKey)).length,
        lastMonth: leads.filter((l) => l.createdAt.startsWith(lastMonthKey)).length,
        monthLabel: formatMonth(monthKey).split(" ")[0],
        lastMonthLabel: formatMonth(lastMonthKey).split(" ")[0],
      },
      overdueFollowUps: leads.filter((l) => isOverdue(l, today)).length,
    },
    funnel,
    lostTotal: leads.filter((l) => l.stage === "lost").length,
    trend,
    leaderboard,
    sources,
  };
}
