// Phase 12 models: the home page, the notification feed, the Investor view and
// the masters config: `npm run check:insights`.
import "./_demo-today";
import { mockLeads } from "@/data/mock-leads";
import { DEMO_USER_IDS as U } from "@/data/mock-users";
import { DEFAULT_APP_CONFIG, reasonsFor, stageLabelsOf, stagePointsOf } from "@/lib/config";
import { PIPELINE_ORDER, TODAY, isActiveStage } from "@/lib/constants";
import { ACTION_LIMIT, computeHome, previousMonth } from "@/lib/dashboard/home";
import { computeInsights, furthestStage } from "@/lib/dashboard/insights";
import { calculateDeal } from "@/lib/deal-calculator";
import { buildNotifications } from "@/lib/notifications";
import { STAGE_POINTS, leadScore } from "@/lib/scoring";
import type { Lead } from "@/types/lead";

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
}

const REASONS = [
  { id: 1, label: "Price too high", appliesTo: "both" as const, active: true },
  { id: 2, label: "Chose another vendor", appliesTo: "lost" as const, active: true },
  { id: 3, label: "Timing: revisit next quarter", appliesTo: "deferred" as const, active: true },
  { id: 4, label: "Retired", appliesTo: "both" as const, active: false },
];
const config = { ...DEFAULT_APP_CONFIG, dropReasons: REASONS };

// Config --------------------------------------------------------------------------------------
console.log("Masters config");
check("default stage points match the scoring guide", Object.entries(stagePointsOf(config)).every(([s, p]) => STAGE_POINTS[s as keyof typeof STAGE_POINTS] === p));
check("stage labels cover every stage", Object.keys(stageLabelsOf(config)).length === Object.keys(STAGE_POINTS).length);
check("lost offers both + lost-only reasons, not retired ones", reasonsFor(config, "lost").map((r) => r.id).join() === "1,2");
check("deferred offers both + deferred-only reasons", reasonsFor(config, "deferred").map((r) => r.id).join() === "1,3");
const renamed = { ...config.stages, won: { label: "Paid", points: 20 } };
check("custom stage points change the score", leadScore({ stage: "won", responsiveness: 0, decisionAccess: 0, timingBudget: 0 }, stagePointsOf({ stages: renamed })) === 20);
const custom = { industries: [{ name: "Bank", avgCallsPerMonth: 100, minutesPerCall: 2, active: true }], pricing: { ...config.pricing, pricePerMinute: 10, contractMonths: 6 } };
const deal = calculateDeal({ segment: "Bank", callsPerMonth: null, minutesPerCall: null, pricePerMinute: null, contractMonths: null }, custom);
check("calculator uses the industry's average and minutes from the masters", deal.volume === 200);
check("calculator uses the pricing master (200 × ₹10 × 6 = ₹12,000)", deal.dealValue === 12_000);

// Home ----------------------------------------------------------------------------------------
console.log("\nHome");
check("previous month wraps the year", previousMonth("2026-01") === "2025-12" && previousMonth("2026-10") === "2026-09");
const target = { wonValue: 1, newLeads: 1 };
const agentScope = mockLeads.filter((l) => l.ownerId === U.priya);
const home = computeHome(agentScope, { today: TODAY, viewerId: U.priya, isAdmin: false, target });
const kpi = (key: string) => home.kpis.find((k) => k.key === key)!;
check("open pipeline = open deal value", kpi("pipeline").value === agentScope.filter((l) => isActiveStage(l.stage)).reduce((n, l) => n + l.dealValue, 0));
check("new accounts this month counts this month only", kpi("new").value === agentScope.filter((l) => l.createdAt.slice(0, 7) === TODAY.slice(0, 7)).length);
check("snapshots have no month-on-month delta", kpi("pipeline").previous === null && kpi("pocs").previous === null);
const overdue = home.actions.find((a) => a.key === "overdue")!;
check(`overdue list = own open accounts past due (${overdue.total})`, overdue.total === agentScope.filter((l) => isActiveStage(l.stage) && l.nextFollowUpAt && l.nextFollowUpAt.slice(0, 10) < TODAY).length);
check(`each action list shows at most ${ACTION_LIMIT}`, home.actions.every((a) => a.items.length <= ACTION_LIMIT && a.items.length === Math.min(a.total, ACTION_LIMIT)));
check("agents get no team overdue rows", home.teamOverdue.length === 0);
const adminHome = computeHome(mockLeads, { today: TODAY, viewerId: U.admin, isAdmin: true, target });
check("admin action points are their own accounts only (admin owns none)", adminHome.actions.every((a) => a.total === 0));
check(
  "team overdue adds up to every overdue open account",
  adminHome.teamOverdue.reduce((n, r) => n + r.count, 0) === mockLeads.filter((l) => isActiveStage(l.stage) && l.nextFollowUpAt && l.nextFollowUpAt.slice(0, 10) < TODAY).length,
);
check("wins are won accounts, newest first", adminHome.wins.every((w, i) => i === 0 || w.date <= adminHome.wins[i - 1].date));

// Notifications -------------------------------------------------------------------------------
console.log("\nNotifications");
const nameOf = (id: string) => (id === U.priya ? "Priya Sharma" : "Someone");
const feed = buildNotifications(agentScope, { viewerId: U.priya, viewerName: "Priya Sharma", isAdmin: false, today: TODAY, nameOf, target, seenAt: null });
check("alerts come first", feed.items.findIndex((n) => n.tone !== "alert") === -1 || feed.items.slice(0, feed.items.findIndex((n) => n.tone !== "alert")).every((n) => n.tone === "alert"));
check("never seen = everything unread", feed.unread === feed.items.length);
const seenNow = buildNotifications(agentScope, { viewerId: U.priya, viewerName: "Priya Sharma", isAdmin: false, today: TODAY, nameOf, target, seenAt: "2999-01-01T00:00:00Z" });
check("seen after everything = nothing unread", seenNow.unread === 0);
check("overdue alert when overdue follow-ups exist", (overdue.total > 0) === feed.items.some((n) => n.id.startsWith("overdue-")));
check("a tiny target is met and celebrated", feed.items.some((n) => n.id.startsWith("target-new-")) === agentScope.some((l) => l.createdAt.slice(0, 7) === TODAY.slice(0, 7)));
const handed: Lead = {
  ...agentScope.find((l) => isActiveStage(l.stage))!,
  id: "L-HAND",
  activities: [{ id: "a1", type: "note", description: "Reassigned from Rohan Mehta to Priya Sharma", date: `${TODAY}T09:00:00+05:30`, byUserId: U.admin }],
};
const handFeed = buildNotifications([handed], { viewerId: U.priya, viewerName: "Priya Sharma", isAdmin: false, today: TODAY, nameOf, target: { wonValue: 0, newLeads: 0 }, seenAt: null });
check("an account handed over shows up", handFeed.items.some((n) => n.id === "handover-a1"));

// Investor view -------------------------------------------------------------------------------
console.log("\nInvestor view");
const lostOne = mockLeads.find((l) => l.stage === "lost")!;
const leads = mockLeads.map((l) => (l.id === lostOne.id ? { ...l, dropReasonId: 2 } : l));
const ins = computeInsights(leads, { today: TODAY, reasons: REASONS });
check("lost reasons add up to lost accounts", ins.lostReasons.reduce((n, r) => n + r.count, 0) === leads.filter((l) => l.stage === "lost").length);
check("a recorded reason is counted under its label", ins.lostReasons.some((r) => r.label === "Chose another vendor" && r.count >= 1));
check("unrecorded reasons sort last", ins.lostReasons.findIndex((r) => r.reasonId === null) === -1 || ins.lostReasons[ins.lostReasons.length - 1].reasonId === null);
check("funnel conversion never exceeds entries", ins.funnels.every((f) => f.converted <= f.entered));
check("each funnel's entries = converted + in progress + dropped", ins.funnels.every((f) => f.entered === f.converted + f.inProgress + f.lost + f.deferred));
check("revenue by month covers 12 months", ins.revenueByMonth.length === 12 && ins.revenueByMonth[11].month === TODAY.slice(0, 7));
check("segment rows add up to open accounts", ins.bySegment.reduce((n, r) => n + r.open, 0) === ins.totals.openAccounts);
check("won accounts reached won", leads.filter((l) => l.stage === "won").every((l) => furthestStage(l) === "won"));
check("furthest stage is on the main path", leads.every((l) => PIPELINE_ORDER.includes(furthestStage(l))));
check("cohort shares are 0–100%", ins.cohorts.every((c) => [c.followUp, c.technical, c.poc, c.won, c.dropped].every((v) => v === null || (v >= 0 && v <= 1))));
const none = computeInsights([], { today: TODAY, reasons: [] });
check("no accounts renders zeros, not errors", none.totals.winRate === null && none.funnels.every((f) => f.rate === null));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll Phase 12 checks passed");
