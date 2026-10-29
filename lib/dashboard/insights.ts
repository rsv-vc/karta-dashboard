import type { DropReason } from "@/lib/config";
import { PIPELINE_ORDER, SOURCE_LABELS, STAGE_LABELS, isActiveStage } from "@/lib/constants";
import { discoveryHeld } from "@/lib/dashboard/mis";
import { daysBetween, toDateKey } from "@/lib/dates";
import type { Lead, LeadSource, LeadStage } from "@/types/lead";

// The Investor view: pipeline and revenue, a root-cause view of each of the
// three funnels (conversion, where and why accounts drop off, how long the
// step takes, and whether recent cohorts convert better), and cohort trends.
// Pure: accounts in, numbers out.

const rank = (stage: LeadStage) => PIPELINE_ORDER.indexOf(stage);
const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);
const median = (values: number[]) => {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * The furthest stage on the main path an account ever reached: from its stage
 * history, its current stage, and (for imported accounts with little history)
 * whether its discovery was held.
 */
export function furthestStage(lead: Lead): LeadStage {
  const seen = [lead.stage, ...lead.stageHistory.map((h) => h.stage)].filter((s) => rank(s) >= 0);
  let best = seen.reduce<LeadStage>((a, s) => (rank(s) > rank(a) ? s : a), "not_met");
  if (rank(best) < rank("discovery_done") && discoveryHeld(lead)) best = "discovery_done";
  return best;
}

/** When the account first entered `stage` (or a later one), from its history; null when unknown. */
function enteredAt(lead: Lead, stage: LeadStage): string | null {
  const hit = lead.stageHistory.filter((h) => rank(h.stage) >= rank(stage)).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (hit) return hit.startDate;
  if (stage === "discovery_done" && lead.discoveryDate) return lead.discoveryDate;
  return null;
}

export interface ReasonCount {
  /** null = no reason recorded (e.g. imported before reasons were required). */
  reasonId: number | null;
  label: string;
  count: number;
  value: number;
}

export interface FunnelInsight {
  id: 1 | 2 | 3;
  title: string;
  from: LeadStage;
  to: LeadStage;
  entered: number;
  converted: number;
  rate: number | null;
  /** Still open between the two stages. */
  inProgress: number;
  /** In progress with no contact for 30+ days. */
  stuck: number;
  lost: number;
  deferred: number;
  /** Lost and deferred inside this step, by reason, most common first. */
  reasons: ReasonCount[];
  medianDays: number | null;
  /**
   * Conversion of accounts that entered in the latest 90-day window vs the 90
   * days before it. Both windows end `lagDays` ago (the step's typical time),
   * so the newest entries, which have not had time to move on, do not drag
   * the recent figure down.
   */
  recentRate: number | null;
  earlierRate: number | null;
  lagDays: number;
}

export interface BreakdownRow {
  key: string;
  label: string;
  open: number;
  openValue: number;
  openVolume: number;
  won: number;
  wonValue: number;
  lost: number;
  winRate: number | null;
}

export interface CohortRow {
  month: string;
  discoveries: number;
  followUp: number | null;
  technical: number | null;
  poc: number | null;
  won: number | null;
  dropped: number | null;
}

export interface Insights {
  totals: {
    openValue: number;
    openVolume: number;
    openAccounts: number;
    wonValue: number;
    wonCount: number;
    wonLast90: number;
    winRate: number | null;
    avgWon: number | null;
    medianDaysToWin: number | null;
  };
  revenueByMonth: { month: string; value: number; count: number }[];
  bySegment: BreakdownRow[];
  bySource: BreakdownRow[];
  funnels: FunnelInsight[];
  lostReasons: ReasonCount[];
  deferredReasons: ReasonCount[];
  /** Lost accounts by the furthest stage they reached. */
  lostAtStage: { stage: LeadStage; label: string; count: number; value: number }[];
  cohorts: CohortRow[];
}

const FUNNEL_STEPS: { id: 1 | 2 | 3; title: string; from: LeadStage; to: LeadStage }[] = [
  { id: 1, title: "Discovery → follow-up", from: "discovery_done", to: "follow_up" },
  { id: 2, title: "Follow-up → bot test / POC", from: "follow_up", to: "technical_round" },
  { id: 3, title: "POC → paid", from: "poc_pitched", to: "won" },
];

function monthsBack(today: string, n: number): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export function computeInsights(
  leads: Lead[],
  o: { today: string; reasons: DropReason[]; labels?: Record<LeadStage, string> },
): Insights {
  const labels = o.labels ?? STAGE_LABELS;
  const reasonLabel = new Map(o.reasons.map((r) => [r.id, r.label]));
  const open = leads.filter((l) => isActiveStage(l.stage));
  const won = leads.filter((l) => l.stage === "won");
  const lost = leads.filter((l) => l.stage === "lost");
  const deferred = leads.filter((l) => l.stage === "deferred");
  const furthest = new Map(leads.map((l) => [l.id, furthestStage(l)]));
  const reached = (l: Lead, stage: LeadStage) => rank(furthest.get(l.id)!) >= rank(stage);
  const sum = (ls: Lead[]) => ls.reduce((n, l) => n + l.dealValue, 0);

  const reasonCounts = (ls: Lead[]): ReasonCount[] => {
    const by = new Map<number | null, Lead[]>();
    for (const l of ls) by.set(l.dropReasonId, [...(by.get(l.dropReasonId) ?? []), l]);
    return [...by]
      .map(([reasonId, group]) => ({
        reasonId,
        label: reasonId === null ? "Not recorded" : (reasonLabel.get(reasonId) ?? "Removed reason"),
        count: group.length,
        value: sum(group),
      }))
      .sort((a, b) => (a.reasonId === null ? 1 : 0) - (b.reasonId === null ? 1 : 0) || b.count - a.count || a.label.localeCompare(b.label));
  };

  const daysToWin = won
    .map((l) => {
      const start = enteredAt(l, "discovery_done");
      return start && l.closedAt ? daysBetween(toDateKey(start), toDateKey(l.closedAt)) : null;
    })
    .filter((d): d is number => d !== null && d >= 0);
  const recentWins = won.filter((l) => l.closedAt && daysBetween(toDateKey(l.closedAt), o.today) <= 90);

  const months = monthsBack(o.today, 12);
  const revenueByMonth = months.map((month) => {
    const inMonth = won.filter((l) => l.closedAt && toDateKey(l.closedAt).slice(0, 7) === month);
    return { month, value: sum(inMonth), count: inMonth.length };
  });

  const breakdown = (keyOf: (l: Lead) => string, labelOf: (k: string) => string): BreakdownRow[] => {
    const keys = [...new Set(leads.map(keyOf))];
    return keys
      .map((key) => {
        const group = leads.filter((l) => keyOf(l) === key);
        const g = { open: group.filter((l) => isActiveStage(l.stage)), won: group.filter((l) => l.stage === "won"), lost: group.filter((l) => l.stage === "lost") };
        return {
          key,
          label: labelOf(key),
          open: g.open.length,
          openValue: sum(g.open),
          openVolume: g.open.reduce((n, l) => n + (l.volume ?? 0), 0),
          won: g.won.length,
          wonValue: sum(g.won),
          lost: g.lost.length,
          winRate: share(g.won.length, g.won.length + g.lost.length),
        };
      })
      .sort((a, b) => b.openValue + b.wonValue - (a.openValue + a.wonValue) || a.label.localeCompare(b.label));
  };

  const funnels = FUNNEL_STEPS.map((f): FunnelInsight => {
    const entered = leads.filter((l) => reached(l, f.from));
    const converted = entered.filter((l) => reached(l, f.to));
    const inside = entered.filter((l) => !reached(l, f.to));
    const inProgress = inside.filter((l) => isActiveStage(l.stage));
    const dropped = inside.filter((l) => l.stage === "lost" || l.stage === "deferred");
    const durations = converted
      .map((l) => {
        const a = enteredAt(l, f.from);
        const b = enteredAt(l, f.to);
        return a && b ? daysBetween(toDateKey(a), toDateKey(b)) : null;
      })
      .filter((d): d is number => d !== null && d >= 0);
    const lagDays = Math.max(14, Math.round(median(durations) ?? 14));
    // Cohorts by when the account entered the step (where the history says).
    const cohort = (fromDays: number, toDays: number) => {
      const group = entered.filter((l) => {
        const at = enteredAt(l, f.from);
        if (!at) return false;
        const age = daysBetween(toDateKey(at), o.today);
        return age >= fromDays && age < toDays;
      });
      return share(group.filter((l) => reached(l, f.to)).length, group.length);
    };
    return {
      ...f,
      entered: entered.length,
      converted: converted.length,
      rate: share(converted.length, entered.length),
      inProgress: inProgress.length,
      stuck: inProgress.filter((l) => daysBetween(toDateKey(l.lastContactedAt ?? l.createdAt), o.today) >= 30).length,
      lost: dropped.filter((l) => l.stage === "lost").length,
      deferred: dropped.filter((l) => l.stage === "deferred").length,
      reasons: reasonCounts(dropped),
      medianDays: median(durations),
      recentRate: cohort(lagDays, lagDays + 90),
      earlierRate: cohort(lagDays + 90, lagDays + 180),
      lagDays,
    };
  });

  const lostAtStage = PIPELINE_ORDER.filter((s) => s !== "won")
    .map((stage) => {
      const group = lost.filter((l) => furthest.get(l.id) === stage);
      return { stage, label: labels[stage], count: group.length, value: sum(group) };
    })
    .filter((r) => r.count > 0);

  const cohortMonths = [...new Set(leads.map((l) => (l.discoveryDate ? l.discoveryDate.slice(0, 7) : l.discoveryMonth)).filter((m): m is string => m !== null))].sort();
  const cohorts = cohortMonths.map((month): CohortRow => {
    const group = leads.filter((l) => discoveryHeld(l) && (l.discoveryDate ? l.discoveryDate.slice(0, 7) : l.discoveryMonth) === month);
    const rate = (stage: LeadStage) => share(group.filter((l) => reached(l, stage)).length, group.length);
    return {
      month,
      discoveries: group.length,
      followUp: rate("follow_up"),
      technical: rate("technical_round"),
      poc: rate("poc_pitched"),
      won: share(group.filter((l) => l.stage === "won").length, group.length),
      dropped: share(group.filter((l) => l.stage === "lost" || l.stage === "deferred").length, group.length),
    };
  });

  return {
    totals: {
      openValue: sum(open),
      openVolume: open.reduce((n, l) => n + (l.volume ?? 0), 0),
      openAccounts: open.length,
      wonValue: sum(won),
      wonCount: won.length,
      wonLast90: sum(recentWins),
      winRate: share(won.length, won.length + lost.length),
      avgWon: won.length ? Math.round(sum(won) / won.length) : null,
      medianDaysToWin: median(daysToWin),
    },
    revenueByMonth,
    bySegment: breakdown((l) => l.industry || "Not set", (k) => k),
    bySource: breakdown((l) => l.source, (k) => SOURCE_LABELS[k as LeadSource] ?? k),
    funnels,
    lostReasons: reasonCounts(lost),
    deferredReasons: reasonCounts(deferred),
    lostAtStage,
    cohorts,
  };
}
