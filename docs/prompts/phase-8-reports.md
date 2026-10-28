# Phase 8 prompt: monthly reports, month comparison, CSV export and print view

```text
You are a senior frontend engineer continuing the Lead Tracking Dashboard.
Done so far:
- Phases 1–5: data model, auth/permissions, shell, leads table (URL filters in lib/leads/filters.ts), and lead
  mutations on an in-memory store.
- Phases 6–7: agent and admin dashboards, follow-ups, the team page and rebalancing; pure metrics in lib/dashboard/;
  getMonthlySummary in lib/selectors.ts.

This is PHASE 8: replace the /reports placeholder with a real monthly report for the admin, comparison against
another month, CSV downloads (report + leads), and a print-friendly layout.

## 0. Rules carried over
- Next.js 16 + Cache Components: page-level Suspense; searchParams is a Promise. Route Handlers (GET) are dynamic by
  default.
- Route Handlers never redirect for auth: they return 401 (no session) or 403 (wrong role) as plain text. They resolve
  the user through the DAL (getCurrentUser), never from query params.
- Report logic is pure (lib/reports/) and unit-tested. Exports contain only what the requester may see.

## 1. Pure report builder: lib/reports/monthly.ts
- reportMonths(today): the month keys from the first month with data (2026-05) through TODAY's month, newest first.
- buildMonthlyReport(leads, { month, compareTo, agents }) →
  - month / compareTo keys and labels ("October 2026").
  - summary: rows { key, label, value, compare, kind: "count" | "currency" | "percent", higherIsBetter } for: New
    leads, Qualified, Proposals sent, Deals won, Won value, Deals lost, Win rate, Activities logged
    (call/email/meeting dated in the month), Pipeline at month end. Values come from getMonthlySummary (activities
    are counted directly).
  - agents: per active agent { name, newLeads, qualified, proposals, won, wonValue, lost, winRate, activities } for
    the month, sorted by wonValue desc then newLeads desc.
  - sources: per source { label, newLeads, won, wonValue } for the month; drop all-zero rows.
  - wonDeals: [{ id, companyName, ownerName, dealValue, closedAt }] closed won in the month, value desc.
  - lostDeals: [{ id, companyName, ownerName, stageLostAt, reason, closedAt }]. The reason is parsed from the
    stage_change activity "Moved from X to Lost: <reason>" (null when absent); stageLostAt = the stage before lost.
- Deltas: change = value − compare; for percent rows, show percentage points ("+5 pts").

## 2. CSV: lib/reports/csv.ts
- toCsv(rows: (string | number | null)[][]): RFC 4180 quoting (quote fields with comma, quote or newline; double inner
  quotes), CRLF line endings, a UTF-8 BOM so Excel shows ₹ correctly.
- CSV-injection guard: prefix text cells that start with = + - @ (or tab/CR) with an apostrophe. Numbers stay numeric.
- monthlyReportCsv(report): sections separated by a blank line (Summary with Month/Compare/Change columns, Agents,
  Sources, Won deals, Lost deals) with a title row each. Rupee values as plain integers (no ₹ symbol) so spreadsheets
  can sum them; dates as YYYY-MM-DD.
- leadsCsv(leads: Lead[]): id, company, POC, designation, email, phone, industry, city, source, stage, priority,
  deal value, owner, created, last contact, next follow-up.

## 3. Route Handlers
- app/(app)/reports/export/route.ts: GET ?month=&compare= → admin only → monthly report CSV with
  Content-Disposition "attachment; filename=karta-report-2026-10.csv". Invalid month → 400.
- app/(app)/leads/export/route.ts: GET with the SAME query params as /leads (parseLeadFilters + sort is optional) →
  any signed-in user → only the leads they may see in full (agent: own; admin: all), filtered → leads CSV
  (karta-leads-2026-10-28.csv). Masked leads are never exported.
- Both send Cache-Control: no-store.

## 4. /reports page (admin only)
- A toolbar row (print:hidden): Month select and "Compare with" select (default: the previous month), both in the
  URL (?month=2026-10&compare=2026-09); "Download CSV" (a link to the export route with the same params); "Print"
  (window.print()).
- Sections (cards):
  1. Summary: a table Metric | {Month} | {Compare month} | Change, with a direction icon + signed text for changes
     (text tokens; the icon carries direction, never color alone; "—" when there is no comparison data).
  2. Agent breakdown table (numeric columns right-aligned, tabular figures).
  3. Source breakdown table.
  4. Won deals (company link, owner, value, closed date) and Lost deals (company link, owner, lost at stage, reason,
     date). Empty states: "No deals won in October 2026."
- A print header (hidden on screen): "Karta Lead Tracker · Monthly report · October 2026 vs September 2026 ·
  generated 28 Oct 2026".

## 5. Print styles
- In globals.css @media print: hide the sidebar, app header, toasts, the dev switcher and the Next.js dev badge; let
  the content use the full width; remove card shadows/rings; avoid page breaks inside cards (break-inside: avoid);
  force a white background with dark text even in dark mode.
- Mark interactive chrome with print:hidden.

## 6. Leads export button
- On /leads add "Export CSV" next to Columns: a link to /leads/export?{current query}, so the export respects the
  active filters. Agents export only their own leads.

## 7. Verification
- scripts/check-reports.ts (`npm run check:reports`):
  - The October report summary equals getMonthlySummary for 2026-10 (new, qualified, proposals, won, lost, won value,
    pipeline).
  - Σ agent newLeads = summary new leads; Σ agent won = summary won.
  - For each month May–Oct, wonDeals.length = summary won and lostDeals.length = summary lost.
  - Lost reasons parse ("Moved from Proposal to Lost: Budget cut" → "Budget cut"; none → null).
  - toCsv escapes commas/quotes/newlines, neutralizes "=SUM(A1)", and keeps numbers numeric; the output starts with a
    BOM and uses CRLF.
  - leadsCsv has a header plus one row per lead.
- Browser:
  1. Admin /reports defaults to October vs September; switching to September vs August updates the URL and tables;
     the won/lost lists match the summary counts.
  2. "Download CSV" returns the file (fetch it: 200, text/csv, attachment filename).
  3. /leads/export as Priya returns only her leads (count = My leads); with ?stage=won only won rows. Logged out →
     401. /reports/export as Priya → 403.
  4. Print preview (emulate print media) hides the sidebar/header/toolbar and shows the print header.
  5. 375px: tables scroll inside their cards; no page-level horizontal scroll.
- lint, build and all check scripts pass. Commit: "Phase 8: monthly reports, CSV export and print view".
```
