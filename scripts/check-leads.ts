// Asserts list DTOs and filter logic: `npm run check:leads`
import { mockLeads } from "@/data/mock-leads";
import {
  DEFAULT_FILTERS,
  facetCounts,
  filterLeadRows,
  parseLeadFilters,
  serializeLeadFilters,
  type LeadFilters,
} from "@/lib/leads/filters";
import { toDirectoryRow, toLeadRow } from "@/lib/leads/rows";
import { findPossibleDuplicates, getFollowUpsDue, getStageCounts, toDirectoryEntry } from "@/lib/selectors";

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
}

const rows = mockLeads.map(toLeadRow);
const withFilters = (patch: Partial<LeadFilters>): LeadFilters => ({ ...DEFAULT_FILTERS, ...patch });

// URL round-trips.
const sample = withFilters({ q: "zenith", stages: ["new", "won"], owners: ["u_priya"], followUp: ["overdue"], status: "active" });
const roundTrip = parseLeadFilters(serializeLeadFilters(sample));
check("parse(serialize(f)) round-trips", JSON.stringify(roundTrip) === JSON.stringify(sample));
check("default filters serialize to an empty query", serializeLeadFilters(DEFAULT_FILTERS).toString() === "");
const junk = parseLeadFilters(new URLSearchParams("stage=won,banana&priority=urgent&status=weird&followUp=today"));
check("unknown values are dropped", junk.stages.join() === "won" && junk.priorities.length === 0 && junk.status === "all");
check("followUp parses", junk.followUp.join() === "today");
check("record params parse too", parseLeadFilters({ stage: ["qualified"], q: " x " }).stages.join() === "qualified");

// Filtering.
const zenith = filterLeadRows(rows, withFilters({ q: "zenith retail pvt" }));
check(`"zenith retail pvt" finds both Zenith leads (${zenith.length})`, zenith.length === 2);
const counts = getStageCounts(mockLeads);
check("stage=won returns every won lead", filterLeadRows(rows, withFilters({ stages: ["won"] })).length === counts.won);
const active = filterLeadRows(rows, withFilters({ status: "active" })).length;
const closed = filterLeadRows(rows, withFilters({ status: "closed" })).length;
check("active + closed = all", active + closed === rows.length && closed === counts.won + counts.lost);
const overdue = filterLeadRows(rows, withFilters({ followUp: ["overdue"] })).length;
check("followUp=overdue matches getFollowUpsDue", overdue === getFollowUpsDue().overdue.length);
const priyaOverdue = filterLeadRows(rows, withFilters({ owners: ["u_priya"], followUp: ["overdue"] })).length;
check(`Priya overdue = ${priyaOverdue}`, priyaOverdue === getFollowUpsDue("u_priya").overdue.length);

// Facets: counts ignore their own facet but respect the others.
const stageFacet = facetCounts(rows, withFilters({ stages: ["won"] }), "stages");
check("stage facet ignores the stage filter", JSON.stringify(stageFacet) === JSON.stringify(facetCounts(rows, DEFAULT_FILTERS, "stages")));
const allStages = Object.entries(counts).every(([stage, n]) => (stageFacet[stage] ?? 0) === n);
check("stage facet equals getStageCounts", allStages);
const priyaStageTotal = Object.values(facetCounts(rows, withFilters({ owners: ["u_priya"] }), "stages")).reduce((a, b) => a + b, 0);
check("stage facet respects the owner filter", priyaStageTotal === rows.filter((r) => r.ownerId === "u_priya").length);

// Duplicate detection: exact after normalizing, or one name plus extra words.
check("duplicates: 'Zenith Retail Solutions' finds both Zenith leads", findPossibleDuplicates("Zenith Retail Solutions").length === 2);
check(
  "duplicates: no seed lead matches another except the Zenith pair",
  mockLeads.filter((l) => findPossibleDuplicates(l.companyName, l.id).length > 0).length === 2,
);
check("duplicates: short prefixes do not match", findPossibleDuplicates("Zen").length === 0);

// DTO shape: nothing sensitive leaks into list rows.
const leadRowKeys = Object.keys(rows[0]);
const forbidden = ["pocEmail", "pocPhone", "pocLinkedIn", "notes", "activities", "stageHistory"];
check("LeadRow has no contact/notes/history fields", forbidden.every((k) => !leadRowKeys.includes(k)));
const dirKeys = Object.keys(toDirectoryRow(toDirectoryEntry(mockLeads[0]), "u_priya")).sort().join(",");
check("DirectoryRow keys are exactly the masked set", dirKeys === "companyName,id,isMine,ownerId,ownerName,pocName,stage");

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll lead list checks passed");
