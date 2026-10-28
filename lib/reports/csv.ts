import { getUserById } from "@/data/mock-users";
import { PRIORITY_LABELS, SOURCE_LABELS, STAGE_LABELS } from "@/lib/constants";
import { toDateKey } from "@/lib/dates";
import type { MonthlyReport } from "@/lib/reports/monthly";
import type { Lead } from "@/types/lead";

// CSV building. RFC 4180 quoting, CRLF line endings, a UTF-8 BOM for Excel,
// and a guard against spreadsheet formula injection.

export type CsvCell = string | number | null | undefined;

const BOM = "﻿";
/** Leading characters a spreadsheet would treat as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "number") return Number.isFinite(cell) ? String(cell) : "";
  // Neutralize formulas: '=SUM(A1) is shown as text, never evaluated.
  const text = FORMULA_START.test(cell) ? `'${cell}` : cell;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: CsvCell[][]): string {
  return BOM + rows.map((row) => row.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

const date = (iso: string | null) => (iso ? toDateKey(iso) : "");
const pct = (r: number | null) => (r === null ? "" : Math.round(r * 100));

/** All report sections in one sheet, separated by blank rows. Money as plain rupee integers. */
export function monthlyReportCsv(report: MonthlyReport): string {
  const rows: CsvCell[][] = [
    [`Karta Lead Tracker monthly report: ${report.monthLabel}`],
    [],
    ["Summary"],
    ["Metric", report.monthLabel, report.compareLabel ?? "", report.compareLabel ? "Change" : ""],
    ...report.summary.map((r) => {
      const asCell = (v: number | null) => (v === null ? "" : r.kind === "percent" ? Math.round(v * 100) : v);
      const unit = r.kind === "percent" ? `${r.label} (%)` : r.kind === "currency" ? `${r.label} (INR)` : r.label;
      const change =
        r.value !== null && r.compare !== null
          ? r.kind === "percent"
            ? Math.round((r.value - r.compare) * 100)
            : r.value - r.compare
          : "";
      return [unit, asCell(r.value), asCell(r.compare), change];
    }),
    [],
    ["Agents"],
    ["Agent", "New leads", "Qualified", "Proposals", "Won", "Won value (INR)", "Lost", "Win rate (%)", "Activities"],
    ...report.agents.map((a) => [a.name, a.newLeads, a.qualified, a.proposals, a.won, a.wonValue, a.lost, pct(a.winRate), a.activities]),
    [],
    ["Sources"],
    ["Source", "New leads", "Won", "Won value (INR)"],
    ...report.sources.map((s) => [s.label, s.newLeads, s.won, s.wonValue]),
    [],
    ["Won deals"],
    ["Lead ID", "Company", "Owner", "Deal value (INR)", "Closed"],
    ...report.wonDeals.map((d) => [d.id, d.companyName, d.ownerName, d.dealValue, date(d.closedAt)]),
    [],
    ["Lost deals"],
    ["Lead ID", "Company", "Owner", "Lost at stage", "Reason", "Closed"],
    ...report.lostDeals.map((d) => [
      d.id,
      d.companyName,
      d.ownerName,
      d.stageLostAt ? STAGE_LABELS[d.stageLostAt] : "",
      d.reason ?? "",
      date(d.closedAt),
    ]),
  ];
  return toCsv(rows);
}

export function leadsCsv(leads: Lead[]): string {
  const header = [
    "Lead ID", "Company", "POC", "Designation", "Email", "Phone", "Industry", "City", "Source", "Stage",
    "Priority", "Deal value (INR)", "Owner", "Created", "Last contact", "Next follow-up",
  ];
  const rows = leads.map((l) => [
    l.id,
    l.companyName,
    l.pocName,
    l.pocDesignation,
    l.pocEmail,
    l.pocPhone,
    l.industry,
    l.city,
    SOURCE_LABELS[l.source],
    STAGE_LABELS[l.stage],
    PRIORITY_LABELS[l.priority],
    l.dealValue,
    getUserById(l.ownerId)?.name ?? "",
    date(l.createdAt),
    date(l.lastContactedAt),
    date(l.nextFollowUpAt),
  ]);
  return toCsv([header, ...rows]);
}
