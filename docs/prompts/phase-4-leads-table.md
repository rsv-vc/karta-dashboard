# Phase 4 prompt: leads table, lead directory and the lead detail stub

```text
You are a senior frontend engineer continuing the Lead Tracking Dashboard.
Done so far:
- Phase 1: types, seeded mock data (75 leads), pure selectors (lib/selectors.ts), and format helpers (lib/utils.ts).
- Phase 2: signed session, DAL (requireUser/requireRole), pure permissions (lib/auth/permissions.ts), scoped getters
  (lib/data/leads.ts), proxy.ts.
- Phase 3: app shell (sidebar, header, breadcrumbs), nav config (lib/navigation.ts), PageHeader, PageContainer,
  ComingSoon, and placeholder pages.

This is PHASE 4: replace the /leads and /leads/directory placeholders with real, filterable tables, and add a read-only
/leads/[id] stub that enforces masking per lead. No create/edit forms, stage changes or charts (Phases 5+).

## 0. Rules carried over
- Next.js 16 with Cache Components: every page reads the session or params inside its own <Suspense> child component.
  `params` and `searchParams` are Promises.
- Server → client data goes through DTOs. Never pass a full Lead (notes, activities, stageHistory) to a Client
  Component. Agents never receive contact details or deal values for leads they do not own.
- @tanstack/react-table is v9.3 (NOT v8). Before writing table code, read
  node_modules/@tanstack/react-table/skills/getting-started/SKILL.md, the table-state skill and
  node_modules/@tanstack/table-core/skills/table-features/references/{sorting,pagination,column-visibility}.md.
  Key differences: `useTable` (not useReactTable); an explicit `tableFeatures({...})` registry with row-model slots
  (`sortedRowModel: createSortedRowModel()`, `paginatedRowModel: createPaginatedRowModel()`);
  `createColumnHelper<typeof features, Row>()`; built-in sort fns are imported individually (sortFn_text, ...);
  `row.getVisibleCells()` when using visibility; and controlled state = `state.<slice>` + `on<Slice>Change`.
  Keep `features`, `columns` and `data` stable (module scope or useMemo).

## 1. DTOs and pure list logic: lib/leads/
- rows.ts:
  - LeadRow = { id, companyName, pocName, pocDesignation, industry, city, source, stage, priority, dealValue,
    ownerId, ownerName, createdAt, lastContactedAt, nextFollowUpAt } (no email/phone/notes/activities/history; the
    detail page fetches those itself).
  - DirectoryRow = LeadDirectoryEntry + { ownerName, isMine }.
  - toLeadRow(lead), toDirectoryRow(entry, viewerId).
- filters.ts (pure; unit-tested):
  - LeadFilters = { q: string; stages: LeadStage[]; priorities: LeadPriority[]; sources: LeadSource[];
    owners: string[]; followUp: FollowUpBucket[] ("overdue" | "today" | "upcoming" | "none"); status: "all" | "active" | "closed" }
  - parseLeadFilters(URLSearchParams | Record<string, string | string[] | undefined>) and
    serializeLeadFilters(filters) → URLSearchParams. Comma-separated multi-values (?stage=new,contacted); drop
    unknown values silently; omit defaults so clean URLs stay clean.
  - followUpBucket(row, today = TODAY).
  - matchesSearch(row, q): case-insensitive match on company, POC and city. The company comparison also uses
    normalizeCompanyName from lib/selectors.ts, so "zenith retail pvt" finds both Zenith leads.
  - filterLeadRows(rows, filters).
  - facetCounts(rows, filters, facet): option → count with every OTHER filter applied (classic faceted counts).
  - hasActiveFilters(filters).
- Directory uses the same q/stages/owners subset (reuse the functions; DirectoryRow has the needed fields).

## 2. Scoped getters (lib/data/leads.ts, server-only; each resolves the user itself)
- getLeadRows(): LeadRow[] for leads the viewer may see in full (agent: own; admin: all).
- getDirectoryRows(): DirectoryRow[] for every lead (agent: own rows are isMine; others are masked entries).
- getOwnerOptions(): { id, name }[] of active agents (admins use it for the Owner filter).
- getLeadForViewer(id) already exists (VisibleLead | null).

## 3. Shared table building blocks: components/data-table/
- lib/table/features.ts: one shared `tableFeatures` registry (rowSortingFeature + sortedRowModel + sortFns
  { text, alphanumeric, basic, datetime }, rowPaginationFeature + paginatedRowModel, columnVisibilityFeature) and
  `type AppTableFeatures`.
- data-table.tsx ("use client"), generic over TData: renders the shadcn Table from a ReactTable; sticky header row;
  clickable rows via an optional `getRowHref(row)` (router.push on click, plus cursor-pointer and hover; the primary
  cell also holds a real <Link> for keyboard and screen-reader users); an empty state slot.
- data-table-column-header.tsx: sortable header button with ArrowUp/ArrowDown/ChevronsUpDown icons and aria-sort on
  the <th>.
- data-table-pagination.tsx: "Page X of Y", rows-per-page Select (10/20/50), first/prev/next/last icon buttons with
  aria-labels.
- data-table-view-options.tsx: "Columns" dropdown of checkboxes for hideable columns.
- faceted-filter.tsx: shadcn Popover + Command multi-select (the shadcn "tasks" pattern): option labels, optional
  colored dot, count per option, selected count shown as badges on the trigger, and "Clear filters" inside.
- Table wrapper: rounded border, overflow-x-auto (the page itself must never scroll sideways at 375px).

## 4. /leads ("My leads" for agents, "All leads" for admins)
- Server page: <Suspense> → LeadsContent: await getLeadRows() (+ getOwnerOptions() for admin) → <LeadsTable rows
  ownerOptions showOwner={isAdmin} />.
- LeadsTable ("use client"):
  - The URL is the source of truth for filters, sort and page (useSearchParams + router.replace(..., { scroll:
    false })). Search input: local state, debounced 250 ms into the URL. Changing any filter resets page to 1.
  - Toolbar (wraps on mobile): search; faceted filters Stage (stage-color dots, pipeline order), Priority, Source,
    Follow-up (Overdue/Due today/Upcoming/None), Owner (admin only); Status segmented control (All / Active / Closed);
    "Reset" (X icon) when hasActiveFilters; Columns view options on the right.
  - Summary line: "Showing N of M leads · ₹X open pipeline" (sum of dealValue for active-stage rows in the filtered
    set, formatINRShort).
  - Columns:
    1. Company (link to /leads/[id]; second line "industry · city", muted), sortable by name.
    2. POC (name + designation).
    3. Stage (StageBadge), sorted by pipeline order with lost last.
    4. Priority (PriorityBadge: high = red, medium = amber, low = slate; dot + label), sorted high → low.
    5. Deal value (right aligned, formatINRShort; full formatINR in a title tooltip), numeric sort.
    6. Owner (avatar initials + name): admin only. Hidden and not hideable for agents.
    7. Next follow-up (formatRelativeDays; red when overdue, amber when today; "—" when none), date sort with empty
       values last.
    8. Last contact (formatDate or "Never"), empty values last.
    9. Source (label): hidden by default.
    10. Created (formatDate).
  - Default sort: next follow-up ascending (most urgent first). Default page size 20.
  - Empty state (no rows match): icon, "No leads match these filters", and a Reset button. Agents with zero leads see
    "No leads yet" and an "Add lead" button.
- Store the sort in the URL as ?sort=<columnId>.<asc|desc>, the page as ?page=N (1-based) and the size as ?size=N.
- The /follow-ups placeholder gets "View overdue leads" → /leads?followUp=overdue.

## 5. /leads/directory (agents; admins keep the existing "you already see everything" note)
- Server page → getDirectoryRows() + owner options → <DirectoryTable /> ("use client"; reuse the data-table pieces
  and the same URL-state hook).
- Info callout: "Contact details and deal values are only visible to the lead owner."
- Toolbar: search ("Search companies or POCs…", normalized matching), Stage and Owner faceted filters.
- Columns: Company (bold; links to /leads/[id] only if isMine), POC, Owner ("You" badge for own rows), Stage.
  Default sort company A→Z. Own rows are clickable; others are not (no cursor-pointer).
- Primary use case: before adding a lead, an agent searches "Zenith" and sees both Zenith rows with their owners.

## 6. /leads/[id] stub (read-only; Phase 5 adds edit, the timeline and stage changes)
- <Suspense> → await params → getLeadForViewer(id). null → notFound().
- kind "masked": PageHeader(companyName) + a Card with POC, Owner, StageBadge and a muted note: "This lead belongs to
  {owner}. Contact details and deal information are only visible to them."
- kind "full": PageHeader(companyName, "industry · city") with StageBadge and PriorityBadge as actions; a "Details"
  Card in a 2-column grid (POC + designation, email (mailto), phone (tel), LinkedIn, owner, source, company size,
  deal value (formatINR), created, last contact, next follow-up) plus ComingSoon(phase 5): activity timeline,
  edit details, change stage, log activity.
- The breadcrumb shows "My leads › {company}". Extend getBreadcrumbs with an optional final label passed by the page
  via a small client component, or keep it generic ("Lead"); pick the simpler option and note it.

## 7. Verification
- scripts/check-leads.ts (`npm run check:leads`), asserting:
  - parse → serialize → parse round-trips; unknown values are dropped; the default filters serialize to an empty
    string.
  - Searching "zenith retail pvt" returns both Zenith rows.
  - filterLeadRows with stage=won returns exactly the won count from getStageCounts.
  - facetCounts for stage, with no other filters, equals getStageCounts.
  - LeadRow keys contain no pocEmail/pocPhone/notes/activities/stageHistory; DirectoryRow keys are exactly the
    directory keys + ownerName + isMine.
- Browser:
  1. Priya: /leads shows 26 rows over 2 pages at size 20; there is no Owner column; filter Stage=Won → only won rows,
     and the URL updates; reload keeps the filters; Reset clears them.
  2. Sorting by Deal value toggles asc/desc, and the URL shows ?sort=dealValue.desc.
  3. Admin: 75 leads, an Owner column and an Owner filter.
  4. /leads?followUp=overdue as Priya shows her 5 overdue leads.
  5. Directory as Priya: search "zenith" → 2 rows, owners Rohan and Ananya, no contact data in the page payload.
  6. /leads/<Priya's lead> shows full details; /leads/<Rohan's lead> as Priya shows the masked card; /leads/L-9999
     → 404.
  7. 375px: no page-level horizontal scroll; the table scrolls inside its container; the toolbar wraps.
- `npm run lint`, `npm run build` and all check scripts pass; the dev server log and console are clean.
- Commit: "Phase 4: leads table, lead directory and lead detail stub".
```
