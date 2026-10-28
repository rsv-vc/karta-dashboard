// Quick CLI sanity check of the mock data: `npx tsx scripts/check-data.ts`
import { mockLeads } from "@/data/mock-leads";
import { getFollowUpsDue, findPossibleDuplicates, getMonthlySummary, getStageCounts } from "@/lib/selectors";
import { validateLeads } from "@/lib/validation";

const result = validateLeads(mockLeads);
console.log(result.valid ? `OK: all ${mockLeads.length} leads valid` : result.errors);
console.log("stages", getStageCounts(mockLeads));

const byOwner: Record<string, { total: number; won: number; lost: number }> = {};
for (const l of mockLeads) {
  const o = (byOwner[l.ownerId] ??= { total: 0, won: 0, lost: 0 });
  o.total++;
  if (l.stage === "won") o.won++;
  if (l.stage === "lost") o.lost++;
}
console.log("owners", byOwner);
console.table(getMonthlySummary({ year: 2026, month: 5 }, { year: 2026, month: 10 }));
const f = getFollowUpsDue();
console.log("follow-ups", { overdue: f.overdue.length, today: f.today.length, upcoming: f.upcoming.length });
console.log("zenith", findPossibleDuplicates("Zenith Retail").map((l) => [l.id, l.companyName, l.ownerId]));
console.log(mockLeads.slice(0, 3).map((l) => ({ ...l, activities: l.activities.length })));
