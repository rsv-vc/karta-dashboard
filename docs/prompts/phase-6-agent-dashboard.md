# Phase 6 prompt: agent dashboard and the follow-ups workspace

```text
You are a senior frontend engineer continuing the Lead Tracking Dashboard.
Done so far:
- Phases 1–3: data model, seeded mock data, auth, permissions, app shell.
- Phase 4: leads table and masked directory.
- Phase 5: in-memory store (lib/data/store.ts), shared zod schemas, pure mutations, Server Actions (create/edit,
  changeStage, logActivity, setFollowUp, delete), and the full lead page with LogActivityDialog.

This is PHASE 6: give sales agents a real home screen (/dashboard) and turn /follow-ups into a working queue. The admin
dashboard stays a placeholder until Phase 7 (admins do get the team-wide /follow-ups).

## 0. Rules carried over
- Next.js 16 + Cache Components: session reads inside page-level <Suspense> children; scoped getters in
  lib/data/leads.ts resolve the user themselves; Client Components get small DTOs, never full Leads.
- All metric logic is PURE (lib/dashboard/*.ts) and unit-tested; pages only fetch and render.
- "Today" is TODAY (2026-10-28); the current month is October 2026.

## 1. Charts: follow the dataviz rules
- Use shadcn `chart` (recharts 3) with ChartContainer, ChartTooltip and ChartLegend.
- Pipeline by stage = ONE series: one color (series slot 1) for every bar. Horizontal bars ≤ 24px thick with a 4px
  rounded data end, the count labeled at the bar tip, the ₹ value in the tooltip. No legend (the title names it).
- Monthly trend (last 6 months) = TWO series on ONE axis (new leads vs won), as grouped columns with a 2px gap and
  rounded tops; legend present; tooltip on hover. No dual axis.
- Palette: slot 1 blue #2a78d6 / dark #3987e5, slot 2 orange #eb6834 / dark #d95926 (validated with the dataviz
  validator in both modes). Define them as --series-1/--series-2 CSS variables in globals.css with .dark overrides,
  and reference them through ChartConfig.
- Hairline, solid, recessive grid; axis text in muted text tokens; text never wears the series color. Each chart has an
  accessible table alternative (a visually hidden <table> or a "View as table" toggle).

## 2. Targets: data/mock-targets.ts
- MonthlyTarget = { wonValue: number; newLeads: number } per agent (Priya ₹40L/8, Rohan ₹25L/6, Ananya ₹25L/6,
  Karan ₹15L/4) and getTargetFor(userId).

## 3. Pure metrics: lib/dashboard/
- types.ts → FollowUpItem DTO { id, companyName, pocName, stage, priority, nextFollowUpAt, lastContactedAt,
  createdDay, ownerName } and toFollowUpItem(lead).
- agent-metrics.ts → computeAgentDashboard(leads /* the agent's own */, { today, target }):
  - kpis: openPipeline { value, count }, wonThisMonth { value, count }, winRate90d { rate | null, won, lost } (closed in
    the last 90 days), followUpsDue { overdue, today }
  - target: { wonValue: { actual, target }, newLeads: { actual, target } } for the current month
  - pipelineByStage: [{ stage, label, count, value }] for the active stages, in pipeline order
  - trend: the last 6 months [{ key, label, newLeads, won }] (reuse getMonthlySummary with the agent's leads)
  - dueNow: overdue + today FollowUpItems (most overdue first, max 8) and dueNowTotal
  - needsAttention: active leads not contacted for ≥ 14 days (never contacted counts from createdAt), oldest first,
    max 5, with daysSinceContact
  - recentActivity: the latest 6 activities on the agent's leads: { leadId, companyName, type, description, date }
- follow-ups.ts → buildFollowUpBoard(leads, today) → { overdue, today, thisWeek (next 7 days), later } of
  FollowUpItems, each sorted by date (overdue: oldest first).

## 4. Scoped getters (lib/data/leads.ts)
- getAgentDashboard(): requireUser; agents only (admins never call it); computes from the agent's own leads in the
  store.
- getFollowUpBoard(ownerId?): agent → own leads (ownerId ignored); admin → all leads, optionally one owner.

## 5. /dashboard
- Agents: <AgentDashboard data={...} /> (a server component composed of small pieces):
  1. Four stat tiles: Open pipeline (₹ short + "N active leads"), Won this month (₹ + count), Win rate · 90 days
     (% + "W won · L lost", or "—" with "No closed deals yet"), Follow-ups due (overdue + today; red text and an
     AlertCircle icon when overdue > 0; links to /follow-ups). Values use proportional figures.
  2. "Due now" card (wide): the dueNow list; each row has the company link, POC, StageBadge, FollowUpLabel and quick
     actions (Log activity, Reschedule). Empty state: "You're all caught up". Footer: "View all N follow-ups →".
  3. "October target" card: two meters (won value, new leads) with "₹X of ₹Y" / "N of M" and the percentage. The fill
     uses the primary color, the track a lighter step; at ≥ 100% show a check icon + "Target met".
  4. "My pipeline" chart and "Last 6 months" chart (side by side on lg, stacked below).
  5. "Needs attention" (stale leads with "No contact in N days") and "Recent activity" (a compact timeline linking
     to leads).
- Admins: keep the Phase 3 placeholder (Phase 7 builds the team overview).

## 6. /follow-ups (working queue)
- Agents see their own leads; admins see everyone's, with an Owner select (All agents + each agent) synced to
  ?owner=.
- Summary tiles: Overdue / Due today / This week / Later (counts; each scrolls to its section).
- Sections in order: Overdue (red header), Due today, This week, Later. Each row: company (link), POC, StageBadge,
  priority, owner (admin only), last contact ("Last contact 12 days ago" / "Never contacted"), FollowUpLabel, and
  actions:
  - Log activity → reuse LogActivityDialog (give it a compact trigger variant).
  - Reschedule → a dropdown: Tomorrow / In 3 days / Next week / Pick a date… / Clear, calling setFollowUp. Compute
    dates from TODAY with the day-number helpers, never `new Date()`.
- Empty section: a muted one-liner. Completely empty: "No follow-ups scheduled".
- The sidebar overdue badge updates after a reschedule (the actions already revalidate the layout).

## 7. Verification
- scripts/check-dashboard.ts (`npm run check:dashboard`):
  - For each agent, openPipeline.count = their active leads; pipelineByStage counts sum to it.
  - dueNow.length ≤ 8 and dueNowTotal = overdue + today from getFollowUpsDue.
  - buildFollowUpBoard buckets partition every active lead with a follow-up exactly once.
  - trend has 6 months ending Oct 2026; Priya's trend newLeads sums to her leads created May–Oct.
  - The win rate is in [0, 1] or null; needsAttention leads all have daysSinceContact ≥ 14.
- Browser:
  1. Priya's dashboard: the tiles match check:dashboard; the charts render in light and dark with tooltips; no
     console errors.
  2. Reschedule an overdue follow-up to Tomorrow from the dashboard → it leaves "Due now", the overdue tile and the
     sidebar badge drop by 1, and it appears under "This week" on /follow-ups.
  3. Log a call from /follow-ups → a toast, and the lead's last contact = today.
  4. Admin /follow-ups shows all agents, with an Owner filter (?owner=u_karan shows only Karan's).
  5. 375px: tiles stack 2×2 or 1-col, charts fit, no page-level horizontal scroll.
- lint, build and all check scripts pass. Commit: "Phase 6: agent dashboard and follow-ups queue".
```
