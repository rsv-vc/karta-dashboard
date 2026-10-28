import { SOURCES, SOURCE_LABELS } from "@/lib/constants";
import { getMonthlySummary, type MonthlySummaryRow } from "@/lib/selectors";
import { nameLookup, type NameOf } from "@/lib/team";
import type { ActivityType, Lead, LeadStage } from "@/types/lead";
import type { User } from "@/types/user";

// Monthly report for the admin. Pure: takes leads and month keys ("2026-10").

export const FIRST_REPORT_MONTH = "2026-05";
const CONTACT_TYPES: readonly ActivityType[] = ["call", "email", "meeting"];

export type MetricKind = "count" | "currency" | "percent";

export interface SummaryRow {
  key: string;
  label: string;
  value: number | null;
  compare: number | null;
  kind: MetricKind;
  higherIsBetter: boolean;
}

export interface AgentReportRow {
  agentId: string;
  name: string;
  newLeads: number;
  qualified: number;
  proposals: number;
  won: number;
  wonValue: number;
  lost: number;
  winRate: number | null;
  activities: number;
}

export interface SourceReportRow {
  label: string;
  newLeads: number;
  won: number;
  wonValue: number;
}

export interface WonDeal {
  id: string;
  companyName: string;
  ownerName: string;
  dealValue: number;
  closedAt: string;
}

export interface LostDeal {
  id: string;
  companyName: string;
  ownerName: string;
  stageLostAt: LeadStage | null;
  reason: string | null;
  closedAt: string;
}

export interface MonthlyReport {
  month: string;
  monthLabel: string;
  compareTo: string | null;
  compareLabel: string | null;
  summary: SummaryRow[];
  agents: AgentReportRow[];
  sources: SourceReportRow[];
  wonDeals: WonDeal[];
  lostDeals: LostDeal[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-10" -> "October 2026" */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** The month before `key`. */
export function previousMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Months with data, newest first: FIRST_REPORT_MONTH through TODAY's month. */
export function reportMonths(today: string): string[] {
  const months: string[] = [];
  for (let key = today.slice(0, 7); key >= FIRST_REPORT_MONTH; key = previousMonth(key)) months.push(key);
  return months;
}

function summaryFor(leads: Lead[], key: string): MonthlySummaryRow {
  const [year, month] = key.split("-").map(Number);
  return getMonthlySummary({ year, month }, { year, month }, leads)[0];
}

function contactActivitiesIn(leads: Lead[], key: string): number {
  return leads.reduce(
    (n, l) => n + l.activities.filter((a) => CONTACT_TYPES.includes(a.type) && a.date.startsWith(key)).length,
    0,
  );
}

const enteredIn = (lead: Lead, stage: LeadStage, key: string) =>
  lead.stageHistory.some((e) => e.stage === stage && e.startDate.startsWith(key));

/** "Moved from Proposal to Lost: Budget cut" -> "Budget cut"; null when no reason was recorded. */
export function parseLostReason(description: string): string | null {
  const match = /^Moved from .+ to Lost: (.+)$/.exec(description);
  return match ? match[1].trim() : null;
}

function lostDeal(lead: Lead, ownerName: NameOf): LostDeal {
  const history = lead.stageHistory;
  const change = [...lead.activities].reverse().find((a) => a.type === "stage_change" && a.description.includes("to Lost"));
  return {
    id: lead.id,
    companyName: lead.companyName,
    ownerName: ownerName(lead.ownerId),
    stageLostAt: history.length > 1 ? history[history.length - 2].stage : null,
    reason: change ? parseLostReason(change.description) : null,
    closedAt: lead.closedAt!,
  };
}

export function buildMonthlyReport(
  leads: Lead[],
  { month, compareTo, team }: { month: string; compareTo: string | null; team: readonly User[] },
): MonthlyReport {
  const ownerName = nameLookup(team);
  const now = summaryFor(leads, month);
  const before = compareTo ? summaryFor(leads, compareTo) : null;
  const metric = (
    key: string,
    label: string,
    kind: MetricKind,
    pick: (s: MonthlySummaryRow) => number | null,
    higherIsBetter = true,
  ): SummaryRow => ({ key, label, kind, higherIsBetter, value: pick(now), compare: before ? pick(before) : null });

  const activitiesRow: SummaryRow = {
    key: "activities",
    label: "Activities logged",
    kind: "count",
    higherIsBetter: true,
    value: contactActivitiesIn(leads, month),
    compare: compareTo ? contactActivitiesIn(leads, compareTo) : null,
  };

  const closedIn = leads.filter((l) => l.closedAt?.startsWith(month));

  const agentRows = team
    .filter((a) => a.role === "sales_agent" && a.status === "active")
    .map((agent): AgentReportRow => {
      const own = leads.filter((l) => l.ownerId === agent.id);
      const ownClosed = own.filter((l) => l.closedAt?.startsWith(month));
      const won = ownClosed.filter((l) => l.stage === "won");
      const lost = ownClosed.length - won.length;
      return {
        agentId: agent.id,
        name: agent.name,
        newLeads: own.filter((l) => l.createdAt.startsWith(month)).length,
        qualified: own.filter((l) => enteredIn(l, "qualified", month)).length,
        proposals: own.filter((l) => enteredIn(l, "proposal", month)).length,
        won: won.length,
        wonValue: won.reduce((s, l) => s + l.dealValue, 0),
        lost,
        winRate: won.length + lost > 0 ? won.length / (won.length + lost) : null,
        activities: contactActivitiesIn(own, month),
      };
    })
    .sort((a, b) => b.wonValue - a.wonValue || b.newLeads - a.newLeads);

  const sources = SOURCES.map((source): SourceReportRow => {
    const bySource = leads.filter((l) => l.source === source);
    const won = bySource.filter((l) => l.stage === "won" && l.closedAt?.startsWith(month));
    return {
      label: SOURCE_LABELS[source],
      newLeads: bySource.filter((l) => l.createdAt.startsWith(month)).length,
      won: won.length,
      wonValue: won.reduce((s, l) => s + l.dealValue, 0),
    };
  })
    .filter((s) => s.newLeads > 0 || s.won > 0)
    .sort((a, b) => b.newLeads - a.newLeads || b.wonValue - a.wonValue);

  return {
    month,
    monthLabel: monthLabel(month),
    compareTo,
    compareLabel: compareTo ? monthLabel(compareTo) : null,
    summary: [
      metric("newLeads", "New leads", "count", (s) => s.newLeads),
      metric("qualified", "Qualified", "count", (s) => s.qualified),
      metric("proposals", "Proposals sent", "count", (s) => s.proposals),
      metric("won", "Deals won", "count", (s) => s.won),
      metric("wonValue", "Won value", "currency", (s) => s.wonValue),
      metric("lost", "Deals lost", "count", (s) => s.lost, false),
      metric("winRate", "Win rate", "percent", (s) => s.winRate),
      activitiesRow,
      metric("pipelineValue", "Pipeline at month end", "currency", (s) => s.pipelineValue),
    ],
    agents: agentRows,
    sources,
    wonDeals: closedIn
      .filter((l) => l.stage === "won")
      .map((l) => ({ id: l.id, companyName: l.companyName, ownerName: ownerName(l.ownerId), dealValue: l.dealValue, closedAt: l.closedAt! }))
      .sort((a, b) => b.dealValue - a.dealValue),
    lostDeals: closedIn
      .filter((l) => l.stage === "lost")
      .map((l) => lostDeal(l, ownerName))
      .sort((a, b) => b.closedAt.localeCompare(a.closedAt)),
  };
}

