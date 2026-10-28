// The sales MIS home page numbers (lib/dashboard/mis.ts): `npm run check:home`.
import "./_demo-today";
import { mockLeads } from "@/data/mock-leads";
import { TODAY } from "@/lib/constants";
import { computeMisOverview, discoveryHeld } from "@/lib/dashboard/mis";
import { BANDS, bandFor, leadScore } from "@/lib/scoring";

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
}

const o = computeMisOverview(mockLeads, { today: TODAY });

check(`tracked = every account (${o.tracked})`, o.tracked === mockLeads.length);
check("funnel starts at discoveries held", o.funnel[0].count === o.discoveriesHeld && o.funnel[0].ofDiscoveries === 1);
check("funnel never increases", o.funnel.every((s, i) => i === 0 || s.count <= o.funnel[i - 1].count));
check("won step = won tile", o.funnel[o.funnel.length - 1].count === o.won);
check("bands add up to tracked", o.bands.reduce((n, b) => n + b.total, 0) === o.tracked);
check(
  "each band's sources add up to the band",
  o.bands.every((b) => Object.values(b.bySource).reduce((n, v) => n + v, 0) === b.total),
);
check("source totals add up to tracked", Object.values(o.bandTotalsBySource).reduce((n, v) => n + v, 0) === o.tracked);
check("hot + warm tile = hot + warm bands", o.hotWarm === o.bands.filter((b) => b.band === "hot" || b.band === "warm").reduce((n, b) => n + b.total, 0));
check("stages add up to tracked", o.stages.reduce((n, s) => n + s.count, 0) === o.tracked);
check("segments add up to tracked", o.segments.reduce((n, s) => n + s.count, 0) === o.tracked);
check(
  "every discovery held belongs to a discovery month",
  o.months.reduce((n, m) => n + m.discoveries, 0) === mockLeads.filter((l) => discoveryHeld(l) && l.discoveryMonth).length,
);
check("month columns: follow-up+ ≥ bot/tech+ ≥ POC+", o.months.every((m) => m.followUpPlus >= m.technicalPlus && m.technicalPlus >= m.pocPlus));
check("next steps sorted soonest first", o.nextSteps.every((n, i) => i === 0 || n.date >= o.nextSteps[i - 1].date));
check("overdue flags match today", o.nextSteps.every((n) => n.overdue === n.date < TODAY));

// Scoring edges.
check("score 30 is Hot, 29 Warm, 20 Warm, 19 Nurture, 9 Inactive", [30, 29, 20, 19, 9].map(bandFor).join() === "hot,warm,warm,nurture,inactive");
check("bands are ordered by minimum", BANDS.every((b, i) => i === 0 || b.min < BANDS[i - 1].min));
check("maximum score is 40", leadScore({ stage: "won", responsiveness: 10, decisionAccess: 10, timingBudget: 5 }) === 40);
check("inputs are clamped", leadScore({ stage: "lost", responsiveness: 99, decisionAccess: -3, timingBudget: 8 }) === 15);

const empty = computeMisOverview([], { today: TODAY });
check("an empty workspace renders zeros, not errors", empty.tracked === 0 && empty.avgScore === null && empty.funnel[0].ofDiscoveries === null);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll home checks passed");
