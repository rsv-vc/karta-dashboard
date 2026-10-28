import { mockLeads } from "@/data/mock-leads";
import { STAGES, TODAY, isActiveStage } from "@/lib/constants";
import { lastDayOfMonth, toDateKey, toMonthKey } from "@/lib/dates";
import type { Lead, LeadDirectoryEntry, LeadStage } from "@/types/lead";

// Pure read functions over lead data. Each takes an optional `leads` list that
// defaults to the mock data; later phases swap these for API calls with the same
// signatures.

export interface YearMonth {
  year: number;
  /** 1-12 */
  month: number;
}

export function getLeadById(id: string, leads: Lead[] = mockLeads): Lead | undefined {
  return leads.find((l) => l.id === id);
}

export function getLeadsByOwner(ownerId: string, leads: Lead[] = mockLeads): Lead[] {
  return leads.filter((l) => l.ownerId === ownerId);
}

/** Masks a lead down to the fields any agent may see. Builds a new object so nothing else leaks. */
export function toDirectoryEntry(lead: Lead): LeadDirectoryEntry {
  return {
    id: lead.id,
    companyName: lead.companyName,
    pocName: lead.pocName,
    ownerId: lead.ownerId,
    stage: lead.stage,
  };
}

export function getDirectory(leads: Lead[] = mockLeads): LeadDirectoryEntry[] {
  return leads.map(toDirectoryEntry);
}

export function getLeadsCreatedInMonth(year: number, month: number, leads: Lead[] = mockLeads): Lead[] {
  const key = toMonthKey(year, month);
  return leads.filter((l) => l.createdAt.startsWith(key));
}

/** The lead's stage at the end of a calendar day, or null if it did not exist yet. */
export function getStageOnDate(lead: Lead, dateKey: string): LeadStage | null {
  let stage: LeadStage | null = null;
  for (const entry of lead.stageHistory) {
    if (toDateKey(entry.startDate) <= dateKey) stage = entry.stage;
    else break;
  }
  return stage;
}

export interface MonthlySummaryRow extends YearMonth {
  /** "YYYY-MM" */
  key: string;
  newLeads: number;
  /** Leads that entered "qualified" during the month. */
  qualified: number;
  /** Leads that entered "proposal" during the month. */
  proposals: number;
  won: number;
  lost: number;
  wonValue: number;
  /** Deal value of leads in an active stage at month end (or TODAY for the current month). */
  pipelineValue: number;
  /** won / (won + lost), or null when nothing closed. */
  winRate: number | null;
}

function enteredStageInMonth(lead: Lead, stage: LeadStage, monthKey: string): boolean {
  return lead.stageHistory.some((e) => e.stage === stage && e.startDate.startsWith(monthKey));
}

function summarizeMonth(year: number, month: number, leads: Lead[]): MonthlySummaryRow {
  const key = toMonthKey(year, month);
  const monthEnd = lastDayOfMonth(year, month);
  const cutoff = monthEnd < TODAY ? monthEnd : TODAY;

  const closedInMonth = leads.filter((l) => l.closedAt?.startsWith(key));
  const wonLeads = closedInMonth.filter((l) => l.stage === "won");
  const lost = closedInMonth.length - wonLeads.length;

  const pipelineValue = leads
    .filter((l) => {
      const stage = getStageOnDate(l, cutoff);
      return stage !== null && isActiveStage(stage);
    })
    .reduce((sum, l) => sum + l.dealValue, 0);

  return {
    year,
    month,
    key,
    newLeads: leads.filter((l) => l.createdAt.startsWith(key)).length,
    qualified: leads.filter((l) => enteredStageInMonth(l, "qualified", key)).length,
    proposals: leads.filter((l) => enteredStageInMonth(l, "proposal", key)).length,
    won: wonLeads.length,
    lost,
    wonValue: wonLeads.reduce((sum, l) => sum + l.dealValue, 0),
    pipelineValue,
    winRate: wonLeads.length + lost > 0 ? wonLeads.length / (wonLeads.length + lost) : null,
  };
}

/** One row per month from `from` to `to`, inclusive. Counts are event-based (when it happened). */
export function getMonthlySummary(from: YearMonth, to: YearMonth, leads: Lead[] = mockLeads): MonthlySummaryRow[] {
  const rows: MonthlySummaryRow[] = [];
  let { year, month } = from;
  while (year < to.year || (year === to.year && month <= to.month)) {
    rows.push(summarizeMonth(year, month, leads));
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return rows;
}

/** Count per stage, with every stage present. */
export function getStageCounts(leads: Lead[]): Record<LeadStage, number> {
  const counts = Object.fromEntries(STAGES.map((s) => [s.value, 0])) as Record<LeadStage, number>;
  for (const lead of leads) counts[lead.stage]++;
  return counts;
}

export interface FollowUpsDue {
  overdue: Lead[];
  today: Lead[];
  upcoming: Lead[];
}

/** Active leads with a follow-up, bucketed relative to `date` and sorted soonest first. */
export function getFollowUpsDue(ownerId?: string, date: string = TODAY, leads: Lead[] = mockLeads): FollowUpsDue {
  const result: FollowUpsDue = { overdue: [], today: [], upcoming: [] };
  const withFollowUp = leads
    .filter((l) => isActiveStage(l.stage) && l.nextFollowUpAt !== null)
    .filter((l) => !ownerId || l.ownerId === ownerId)
    .sort((a, b) => a.nextFollowUpAt!.localeCompare(b.nextFollowUpAt!));

  for (const lead of withFollowUp) {
    const day = toDateKey(lead.nextFollowUpAt!);
    if (day < date) result.overdue.push(lead);
    else if (day === date) result.today.push(lead);
    else result.upcoming.push(lead);
  }
  return result;
}

const LEGAL_WORDS = new Set(["private", "pvt", "limited", "ltd", "llp", "inc"]);

/** "Zenith Retail Pvt. Ltd." -> "zenith retail" */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !LEGAL_WORDS.has(word))
    .join(" ");
}

/** Shortest normalized name allowed to match by word-prefix, so "abc" does not flag "abc anything". */
const MIN_PREFIX_MATCH_LENGTH = 6;

/**
 * Same company after normalizing, or one name is the other plus extra trailing
 * words ("Zenith Retail" vs "Zenith Retail Solutions").
 */
function namesOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= MIN_PREFIX_MATCH_LENGTH && longer.startsWith(`${shorter} `);
}

/** Leads whose company name looks like the same company. Pass excludeId when checking an existing lead. */
export function findPossibleDuplicates(companyName: string, excludeId?: string, leads: Lead[] = mockLeads): Lead[] {
  const target = normalizeCompanyName(companyName);
  if (!target) return [];
  return leads.filter((l) => l.id !== excludeId && namesOverlap(normalizeCompanyName(l.companyName), target));
}
