// Asserts the monthly report and CSV helpers: `npm run check:reports`
import { mockLeads } from "@/data/mock-leads";
import { mockUsers } from "@/data/mock-users";
import { TODAY } from "@/lib/constants";
import { DEFAULT_FILTERS, filterLeadRows } from "@/lib/leads/filters";
import { toLeadRow } from "@/lib/leads/rows";
import { leadsCsv, monthlyReportCsv, toCsv } from "@/lib/reports/csv";
import { buildMonthlyReport, parseLostReason, previousMonth, reportMonths } from "@/lib/reports/monthly";
import { getMonthlySummary } from "@/lib/selectors";

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
}

const months = reportMonths(TODAY);
check(`report months ${months.at(-1)} → ${months[0]}`, months.length === 6 && months[0] === "2026-10" && months.at(-1) === "2026-05");
check("previous month wraps the year", previousMonth("2026-01") === "2025-12");

for (const month of months) {
  const report = buildMonthlyReport(mockLeads, { month, compareTo: previousMonth(month), agents: mockUsers });
  const [y, m] = month.split("-").map(Number);
  const s = getMonthlySummary({ year: y, month: m }, { year: y, month: m }, mockLeads)[0];
  const v = Object.fromEntries(report.summary.map((r) => [r.key, r.value]));
  const ok =
    v.newLeads === s.newLeads && v.qualified === s.qualified && v.proposals === s.proposals && v.won === s.won &&
    v.lost === s.lost && v.wonValue === s.wonValue && v.pipelineValue === s.pipelineValue;
  check(`${report.monthLabel}: summary matches getMonthlySummary`, ok);
  check(`${report.monthLabel}: Σ agents new/won = summary`, report.agents.reduce((n, a) => n + a.newLeads, 0) === s.newLeads && report.agents.reduce((n, a) => n + a.won, 0) === s.won);
  check(`${report.monthLabel}: ${report.wonDeals.length} won / ${report.lostDeals.length} lost deals listed`, report.wonDeals.length === s.won && report.lostDeals.length === s.lost);
}

check("lost reason parses", parseLostReason("Moved from Proposal to Lost: Budget cut") === "Budget cut");
check("no reason → null", parseLostReason("Moved from Proposal to Lost") === null && parseLostReason("Pricing call") === null);

// CSV.
const csv = toCsv([["a,b", 'say "hi"', "line\nbreak", 42, null, "=SUM(A1)", "-5 people", "@cmd"]]);
check("BOM + CRLF", csv.startsWith("﻿") && csv.endsWith("\r\n"));
check(
  "quoting, numbers and formula guard",
  csv.slice(1).trimEnd() === `"a,b","say ""hi""","line\nbreak",42,,'=SUM(A1),'-5 people,'@cmd`,
);
const reportCsv = monthlyReportCsv(buildMonthlyReport(mockLeads, { month: "2026-09", compareTo: "2026-08", agents: mockUsers }));
check("report CSV has every section", ["Summary", "Agents", "Sources", "Won deals", "Lost deals"].every((t) => reportCsv.includes(`\r\n${t}\r\n`)));
check("report CSV money is plain integers (no ₹)", !reportCsv.includes("₹"));
const leadCsvLines = leadsCsv(mockLeads).trimEnd().split("\r\n");
check("leads CSV = header + 75 rows", leadCsvLines.length === 76);
const wonRows = filterLeadRows(mockLeads.map(toLeadRow), { ...DEFAULT_FILTERS, stages: ["won"] }).length;
check(`filtered export size (${wonRows} won)`, wonRows === mockLeads.filter((l) => l.stage === "won").length);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll report checks passed");
