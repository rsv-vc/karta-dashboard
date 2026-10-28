// Asserts dashboard and follow-up metrics: `npm run check:dashboard`
import "./_demo-today";
import { mockLeads } from "@/data/mock-leads";
import { getTargetFor } from "@/data/mock-targets";
import { demoAgents, mockUsers } from "@/data/mock-users";
import { TODAY, isActiveStage } from "@/lib/constants";
import { STALE_AFTER_DAYS, computeAgentDashboard } from "@/lib/dashboard/agent-metrics";
import { buildFollowUpBoard } from "@/lib/dashboard/follow-ups";
import { nameLookup } from "@/lib/team";
import { getFollowUpsDue, getLeadsByOwner } from "@/lib/selectors";

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
}

for (const agent of demoAgents()) {
  const leads = getLeadsByOwner(agent.id);
  const d = computeAgentDashboard(leads, { today: TODAY, target: getTargetFor(agent.id) });
  const activeCount = leads.filter((l) => isActiveStage(l.stage)).length;
  const due = getFollowUpsDue(agent.id);
  const k = d.kpis;

  check(`${agent.name}: open pipeline count ${k.openPipeline.count} = active leads`, k.openPipeline.count === activeCount);
  check(
    `${agent.name}: stage bars sum to open pipeline`,
    d.pipelineByStage.reduce((s, r) => s + r.count, 0) === activeCount &&
      d.pipelineByStage.reduce((s, r) => s + r.value, 0) === k.openPipeline.value,
  );
  check(
    `${agent.name}: due now ${d.dueNowTotal} = overdue ${due.overdue.length} + today ${due.today.length}`,
    d.dueNowTotal === due.overdue.length + due.today.length && d.dueNow.length <= 8,
  );
  check(`${agent.name}: overdue tile matches`, k.followUpsDue.overdue === due.overdue.length);
  check(
    `${agent.name}: trend is 6 months ending Oct 2026`,
    d.trend.length === 6 && d.trend[5].key === "2026-10" && d.trend[0].key === "2026-05",
  );
  check(`${agent.name}: trend new leads = all created May–Oct`, d.trend.reduce((s, r) => s + r.newLeads, 0) === leads.length);
  check(
    `${agent.name}: win rate valid (${k.winRate90d.rate === null ? "none" : Math.round(k.winRate90d.rate * 100) + "%"})`,
    k.winRate90d.rate === null || (k.winRate90d.rate >= 0 && k.winRate90d.rate <= 1),
  );
  check(`${agent.name}: needs-attention all stale`, d.needsAttention.every((n) => n.daysSinceContact >= STALE_AFTER_DAYS));
  check(`${agent.name}: recent activity newest first`, d.recentActivity.every((a, i, arr) => i === 0 || arr[i - 1].date >= a.date));
}

// The board partitions every active lead with a follow-up exactly once.
const board = buildFollowUpBoard(mockLeads, TODAY, nameLookup(mockUsers));
const ids = [...board.overdue, ...board.today, ...board.thisWeek, ...board.later].map((i) => i.id);
const expected = mockLeads.filter((l) => isActiveStage(l.stage) && l.nextFollowUpAt).map((l) => l.id);
check(`board covers ${expected.length} scheduled leads once each`, ids.length === expected.length && new Set(ids).size === ids.length);
check("board overdue/today match getFollowUpsDue", board.overdue.length === getFollowUpsDue().overdue.length && board.today.length === getFollowUpsDue().today.length);
check("board overdue is oldest first", board.overdue.every((i, n, arr) => n === 0 || arr[n - 1].nextFollowUpAt! <= i.nextFollowUpAt!));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll dashboard checks passed");
