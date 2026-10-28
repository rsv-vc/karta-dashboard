# Phase 7 prompt: admin team overview, team page and lead rebalancing

```text
You are a senior frontend engineer continuing the Lead Tracking Dashboard.
Done so far:
- Phases 1–5: data model, auth/permissions, shell, leads table/directory, lead create/edit/stages/activities on an
  in-memory store with Server Actions.
- Phase 6: agent dashboard (lib/dashboard/agent-metrics.ts → computeAgentDashboard), the follow-ups queue, StatTile,
  TargetMeter, PipelineChart, TrendChart, the --series-1/--series-2 palette and mock targets.

This is PHASE 7: the admin (Chief Growth Officer) home screen at /dashboard, a real /team page, and bulk lead
reassignment. Agents' views are unchanged.

## 0. Rules carried over
- Next.js 16 + Cache Components (page-level Suspense; params/searchParams are Promises). Admin-only pages call
  requireRole("admin"); Server Actions re-check permissions (canReassignLead).
- Metric logic is pure in lib/dashboard/ and unit-tested; pages fetch and render.
- Dataviz rules from Phase 6: single-series charts use one color (slot 1); two series on one axis use slots 1 and 2
  with a legend; no dual axes; hairline grids; text never in series colors; a screen-reader table per chart; tooltips
  on hover. No new palette slots are needed.

## 1. Period filter
- TeamPeriod = "month" | "90d" | "all" in the URL as ?period= (default "90d"). Shown as a segmented control in one row
  above the leaderboard and source sections (the KPI tiles and charts above have fixed, labeled periods).
- Semantics, stated in the UI: won/lost/win rate/won value = closed within the period; new leads = created within the
  period; open pipeline, overdue and stale = right now.

## 2. Pure metrics: lib/dashboard/team-metrics.ts
computeTeamDashboard(leads, { today, period, agents, targets }) →
- kpis: openPipeline { value, count }; wonThisMonth { value, count }; winRate90d { rate, won, lost };
  newLeads { thisMonth, lastMonth }; overdueFollowUps.
- funnel: for each PIPELINE_ORDER stage (new … won), `reached` = leads whose stageHistory ever entered it, and
  `conversion` = reached / previous stage's reached (null for "new"); plus lostTotal.
- trend: the last 6 months { key, label, newLeads, won, wonValue, pipelineValue } (getMonthlySummary).
- leaderboard: per active agent { agentId, name, active, openPipeline, newLeads, won, lost, wonValue, winRate | null,
  overdue, stale (≥ 14 days without contact) } for the period, sorted by wonValue desc, then winRate desc.
- sources: per LeadSource { source, label, leads (created in period), won, lost, winRate | null, openPipeline }, sorted
  by leads desc; hide sources with zero leads and zero pipeline.
- periodLabel and periodRange helpers: month = since the 1st of TODAY's month; 90d = the last 90 days; all = no lower
  bound.

## 3. Reassignment
- lib/leads/mutations.ts: extract reassignLead(lead, toOwnerId, { byUserId, ownerName, at? }) → a new Lead with the
  owner changed and a "Reassigned from X to Y" note. applyLeadEdits reuses it. A no-op when the owner is the same.
- Server Action reassignLeads({ leadIds, toOwnerId }): admin only; zod-validated (1–50 ids); the target must be an
  active agent; unknown ids → error; leads already owned by the target are skipped. Returns { ok, moved, skipped }.
  revalidatePath("/", "layout").

## 4. /dashboard (admin) = "Team overview"
1. Five stat tiles: Team pipeline (₹ + N active), Won in October (₹ + deals), Win rate · last 90 days (W won · L lost),
   New leads in October (with "vs N in September" and an up/down arrow; text tokens, not series colors), Overdue
   follow-ups (alert tone when > 0; links to /follow-ups).
2. Charts row: "Conversion funnel" (horizontal bars of `reached` per stage, one color, a label at the tip
   "N · X%"; the tooltip explains "X% of Qualified reached Proposal"; a footnote with the lost total) and "Last 6
   months" (reuse TrendChart: new leads vs won).
3. "Pipeline value at month end": a single-series area chart (2px line, ~10% area wash, crosshair tooltip with
   formatINR), the y-axis in ₹ short form.
4. The period control, then "Agent leaderboard": a table (Agent with avatar → /leads?owner=id, Active, Open pipeline,
   New, Won, Won value, Win rate, Overdue, Stale), with numeric columns right-aligned and tabular; the top performer
   gets a subtle "Top" badge; overdue/stale cells use text tokens plus an icon when > 0. Under 640px the table scrolls
   inside its card.
5. "Source performance" table: Source, Leads, Won, Win rate, Open pipeline.
- The agent dashboard is unchanged.

## 5. /team (admin only)
- PageHeader "Team" + a "Rebalance leads" button opening ReassignDialog.
- One card per agent (grid 1/2/3 columns): avatar, name, email, joined date; this-month TargetMeters (won value, new
  leads; reuse computeAgentDashboard per agent); a mini KPI row (active, open pipeline, overdue, stale); links "View
  leads" (/leads?owner=…) and "Follow-ups" (/follow-ups?owner=…).
- ReassignDialog ("use client"): From agent select → a checklist of that agent's active leads (company, stage,
  follow-up label; "Select all"; stale leads flagged), To agent select (excluding From), and a submit button "Move N
  leads". On success: toast "Moved N leads to X", close, and the cards refresh. Data passed in: a small DTO list
  { id, companyName, stage, ownerId, nextFollowUpAt, stale } of active leads only.

## 6. Verification
- scripts/check-team.ts (`npm run check:team`):
  - funnel.new.reached = all leads; reached is non-increasing along the pipeline; won.reached = won count.
  - The leaderboard has 4 agents; Σ active = team open count; Σ wonValue(all) = total won value; it is sorted.
  - Source leads (period all) sum to 75; winRate ∈ [0, 1] or null.
  - The month/90d/all periods filter won counts correctly (all ≥ 90d ≥ month).
  - reassignLead: owner changes, adds one note, stays valid (validateLeads integrity); same-owner is a no-op.
- Browser:
  1. Admin /dashboard: the tiles match check:team; three charts render with tooltips in light and dark; the period
     control updates the leaderboard and sources (URL ?period=all).
  2. /team shows 4 agent cards; rebalance 2 of Karan's leads to Priya → toast; Karan's active count −2 and Priya's
     +2; the leads show a "Reassigned" note; Priya now sees them in My leads.
  3. Priya visiting /team → /no-access.
  4. 375px: tiles wrap, tables scroll inside their cards, no page-level horizontal scroll.
- lint, build and all check scripts pass. Commit: "Phase 7: admin team overview, team page and rebalancing".
```
