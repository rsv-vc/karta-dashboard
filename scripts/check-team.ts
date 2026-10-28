// Asserts admin team metrics and reassignment: `npm run check:team`
import "./_demo-today";
import { mockLeads } from "@/data/mock-leads";
import { DEMO_USER_IDS as U, mockUsers } from "@/data/mock-users";
import { TODAY, isActiveStage } from "@/lib/constants";
import { computeTeamDashboard } from "@/lib/dashboard/team-metrics";
import { reassignLead } from "@/lib/leads/mutations";
import { getStageCounts } from "@/lib/selectors";
import { nameLookup } from "@/lib/team";
import { validateLeads } from "@/lib/validation";

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
}

const all = computeTeamDashboard(mockLeads, { today: TODAY, period: "all", agents: mockUsers });
const ninety = computeTeamDashboard(mockLeads, { today: TODAY, period: "90d", agents: mockUsers });
const month = computeTeamDashboard(mockLeads, { today: TODAY, period: "month", agents: mockUsers });
const counts = getStageCounts(mockLeads);

// Funnel.
check("funnel starts with every lead", all.funnel[0].reached === mockLeads.length);
check("funnel never increases", all.funnel.every((s, i) => i === 0 || s.reached <= all.funnel[i - 1].reached));
check("funnel won = won leads", all.funnel.at(-1)!.reached === counts.won);
check("lost total", all.lostTotal === counts.lost);
console.log("   funnel:", all.funnel.map((s) => `${s.label} ${s.reached}${s.conversion === null ? "" : ` (${Math.round(s.conversion * 100)}%)`}`).join(" → "));

// KPIs.
const activeCount = mockLeads.filter((l) => isActiveStage(l.stage)).length;
check(`open pipeline count ${all.kpis.openPipeline.count}`, all.kpis.openPipeline.count === activeCount);
check("KPIs do not depend on the period", JSON.stringify(all.kpis) === JSON.stringify(month.kpis));

// Leaderboard.
check("leaderboard has 4 agents", all.leaderboard.length === 4);
check("Σ active = team open count", all.leaderboard.reduce((s, r) => s + r.active, 0) === activeCount);
const totalWon = mockLeads.filter((l) => l.stage === "won").reduce((s, l) => s + l.dealValue, 0);
check("Σ won value (all time) = total won", all.leaderboard.reduce((s, r) => s + r.wonValue, 0) === totalWon);
check("leaderboard sorted by won value", all.leaderboard.every((r, i, a) => i === 0 || a[i - 1].wonValue >= r.wonValue));
console.log("   leaderboard:", all.leaderboard.map((r) => `${r.name} ₹${r.wonValue / 1e5}L`).join(", "));
const wonIn = (d: typeof all) => d.leaderboard.reduce((s, r) => s + r.won, 0);
check(`periods nest: all ${wonIn(all)} ≥ 90d ${wonIn(ninety)} ≥ month ${wonIn(month)}`, wonIn(all) >= wonIn(ninety) && wonIn(ninety) >= wonIn(month));

// Sources.
check("source leads (all time) sum to 75", all.sources.reduce((s, r) => s + r.leads, 0) === mockLeads.length);
check("source win rates valid", all.sources.every((s) => s.winRate === null || (s.winRate >= 0 && s.winRate <= 1)));

// Trend.
check("trend has 6 months ending this month", all.trend.length === 6 && all.trend[5].key === TODAY.slice(0, 7));

// Reassignment.
const nameOf = nameLookup(mockUsers);
const karanLead = mockLeads.find((l) => l.ownerId === U.karan && isActiveStage(l.stage))!;
const moved = reassignLead(karanLead, U.priya, { byUserId: U.admin, ownerName: nameOf });
check("reassign changes owner", moved.ownerId === U.priya);
check("reassign adds one note", moved.activities.length === karanLead.activities.length + 1 && moved.activities.some((a) => a.description === "Reassigned from Karan Singh to Priya Sharma"));
check("reassigned lead stays valid", validateLeads([moved], { team: mockUsers }).valid);
check("same-owner reassign is a no-op", reassignLead(karanLead, U.karan, { byUserId: U.admin, ownerName: nameOf }) === karanLead);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll team checks passed");
