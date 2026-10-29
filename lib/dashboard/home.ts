import type { MonthlyTarget } from "@/data/mock-targets";
import { STALE_AFTER_DAYS } from "@/lib/dashboard/agent-metrics";
import { discoveryHeld } from "@/lib/dashboard/mis";
import { isActiveStage } from "@/lib/constants";
import { daysBetween, toDateKey } from "@/lib/dates";
import { STAGE_POINTS, leadBand, leadScore, type Band } from "@/lib/scoring";
import type { Lead, LeadStage } from "@/types/lead";

// The home page: headline numbers with month-on-month change, progress to this
// month's targets, today's action points and recent wins. Pure: accounts in,
// numbers out (no I/O), so the check script can pin every figure.

export interface Kpi {
  key: string;
  label: string;
  value: number;
  /** Last month's figure for flow metrics (things that happen in a month); null for snapshots. */
  previous: number | null;
  /** "money" values print as ₹, "minutes" as min / month. */
  format: "count" | "money" | "score";
  detail: string;
  href?: string;
}

export interface ActionItem {
  id: string;
  companyName: string;
  /** What to do, or why it is listed. */
  note: string;
  /** "YYYY-MM-DD" the follow-up was due, when there is one. */
  date: string | null;
  band: Band;
  ownerId: string;
}

export interface ActionList {
  key: "overdue" | "today" | "noDate" | "stale" | "noVolume";
  title: string;
  hint: string;
  /** Where "see all" goes. */
  href: string;
  total: number;
  items: ActionItem[];
}

export interface HomeEvent {
  id: string;
  companyName: string;
  ownerId: string;
  /** "YYYY-MM-DD" */
  date: string;
  value: number;
}

export interface HomeData {
  kpis: Kpi[];
  targets: { wonValue: number; wonTarget: number; newAccounts: number; newTarget: number } | null;
  actions: ActionList[];
  wins: HomeEvent[];
  newAccounts: HomeEvent[];
  /** Employees: overdue follow-ups per owner across the team (excluding their own). */
  teamOverdue: { ownerId: string; count: number }[];
}

/** How many items each action list shows before "see all". */
export const ACTION_LIMIT = 5;

const monthOf = (iso: string | null) => (iso ? toDateKey(iso).slice(0, 7) : null);

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function computeHome(
  scope: Lead[],
  o: {
    today: string;
    viewerId: string;
    isAdmin: boolean;
    target: MonthlyTarget | null;
    points?: Record<LeadStage, number>;
  },
): HomeData {
  const points = o.points ?? STAGE_POINTS;
  const month = o.today.slice(0, 7);
  const last = previousMonth(month);
  const open = scope.filter((l) => isActiveStage(l.stage));
  const inMonth = (pick: (l: Lead) => string | null, m: string, leads = scope) => leads.filter((l) => monthOf(pick(l)) === m);
  const won = (m: string) => inMonth((l) => l.closedAt, m).filter((l) => l.stage === "won");
  const discovered = (m: string) => scope.filter((l) => discoveryHeld(l) && (l.discoveryDate ? l.discoveryDate.slice(0, 7) : l.discoveryMonth) === m);
  const scores = scope.map((l) => leadScore(l, points));
  const sum = (leads: Lead[]) => leads.reduce((n, l) => n + l.dealValue, 0);
  const hotWarm = scope.filter((l) => ["hot", "warm"].includes(leadBand(l, points)));
  const pocsLive = open.filter((l) => l.stage === "poc_approved" || l.stage === "poc_ongoing");

  const kpis: Kpi[] = [
    {
      key: "pipeline",
      label: "Open pipeline",
      value: sum(open),
      previous: null,
      format: "money",
      detail: `${open.length} open accounts`,
      href: o.isAdmin ? "/leads?status=active" : "/my-leads?status=active",
    },
    {
      key: "won",
      label: "Won this month",
      value: sum(won(month)),
      previous: sum(won(last)),
      format: "money",
      detail: `${won(month).length} closed (${won(last).length} last month)`,
    },
    {
      key: "new",
      label: "New accounts this month",
      value: inMonth((l) => l.createdAt, month).length,
      previous: inMonth((l) => l.createdAt, last).length,
      format: "count",
      detail: "Added to the tracker",
    },
    {
      key: "discoveries",
      label: "Discoveries this month",
      value: discovered(month).length,
      previous: discovered(last).length,
      format: "count",
      detail: "First meetings held",
    },
    {
      key: "pocs",
      label: "POCs live",
      value: pocsLive.length,
      previous: null,
      format: "count",
      detail: "Approved or ongoing",
      href: `${o.isAdmin ? "/leads" : "/my-leads"}?stage=poc_approved,poc_ongoing`,
    },
    {
      key: "hotWarm",
      label: "Hot + Warm",
      value: hotWarm.length,
      previous: null,
      format: "count",
      detail: `Average score ${scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "–"} / 40`,
      href: `${o.isAdmin ? "/leads" : "/my-leads"}?band=hot,warm`,
    },
  ];

  // Today's action points: always the viewer's own accounts.
  const own = open.filter((l) => l.ownerId === o.viewerId);
  const item = (l: Lead, note: string): ActionItem => ({
    id: l.id,
    companyName: l.companyName,
    note,
    date: l.nextFollowUpAt ? toDateKey(l.nextFollowUpAt) : null,
    band: leadBand(l, points),
    ownerId: l.ownerId,
  });
  const due = (l: Lead) => (l.nextFollowUpAt ? toDateKey(l.nextFollowUpAt) : null);
  const byDue = (a: Lead, b: Lead) => (due(a) ?? "").localeCompare(due(b) ?? "") || a.companyName.localeCompare(b.companyName);
  const lastTouch = (l: Lead) => l.lastContactedAt ?? l.createdAt;
  const list = (key: ActionList["key"], title: string, hint: string, href: string, leads: Lead[], note: (l: Lead) => string): ActionList => ({
    key,
    title,
    hint,
    href,
    total: leads.length,
    items: leads.slice(0, ACTION_LIMIT).map((l) => item(l, note(l))),
  });

  const actions: ActionList[] = [
    list("overdue", "Overdue", "Follow-ups whose date has passed", "/follow-ups", own.filter((l) => (due(l) ?? "9") < o.today).sort(byDue), (l) => l.nextStep || "Follow up"),
    list("today", "Due today", "Follow-ups for today", "/follow-ups", own.filter((l) => due(l) === o.today).sort(byDue), (l) => l.nextStep || "Follow up"),
    list(
      "noDate",
      "No next date",
      "Open accounts without a follow-up date",
      "/my-leads?followUp=none&status=active",
      own.filter((l) => !l.nextFollowUpAt).sort((a, b) => a.companyName.localeCompare(b.companyName)),
      (l) => l.nextStep || "Set a next step and date",
    ),
    list(
      "stale",
      `Quiet for ${STALE_AFTER_DAYS}+ days`,
      "No contact logged recently",
      "/my-leads?status=active",
      own.filter((l) => daysBetween(lastTouch(l), o.today) >= STALE_AFTER_DAYS).sort((a, b) => lastTouch(a).localeCompare(lastTouch(b))),
      (l) => `Last contact ${daysBetween(lastTouch(l), o.today)} days ago`,
    ),
    list(
      "noVolume",
      "Missing volume",
      "No calls entered and no industry average",
      "/my-leads?status=active",
      own.filter((l) => l.volume === null).sort((a, b) => a.companyName.localeCompare(b.companyName)),
      () => "Add the calls a month on Edit",
    ),
  ];

  const recentEvents = (leads: Lead[], pick: (l: Lead) => string | null, days: number) =>
    leads
      .filter((l) => pick(l) !== null && daysBetween(toDateKey(pick(l)!), o.today) <= days && toDateKey(pick(l)!) <= o.today)
      .map((l) => ({ id: l.id, companyName: l.companyName, ownerId: l.ownerId, date: toDateKey(pick(l)!), value: l.dealValue }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.companyName.localeCompare(b.companyName));

  const overdueTeam = new Map<string, number>();
  if (o.isAdmin) {
    for (const l of open) {
      if (l.ownerId !== o.viewerId && (due(l) ?? "9") < o.today) overdueTeam.set(l.ownerId, (overdueTeam.get(l.ownerId) ?? 0) + 1);
    }
  }

  return {
    kpis,
    targets: o.target
      ? {
          wonValue: sum(won(month)),
          wonTarget: o.target.wonValue,
          newAccounts: inMonth((l) => l.createdAt, month).length,
          newTarget: o.target.newLeads,
        }
      : null,
    actions,
    wins: recentEvents(scope.filter((l) => l.stage === "won"), (l) => l.closedAt, 60).slice(0, 6),
    newAccounts: recentEvents(scope, (l) => l.createdAt, 14).slice(0, 6),
    teamOverdue: [...overdueTeam].map(([ownerId, count]) => ({ ownerId, count })).sort((a, b) => b.count - a.count),
  };
}
