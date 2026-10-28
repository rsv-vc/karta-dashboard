# Phase 5 prompt: create/edit leads, stage changes, activity log and the full lead page

```text
You are a senior frontend engineer continuing the Lead Tracking Dashboard.
Done so far:
- Phases 1–2: types, seeded mock data, selectors, signed session, DAL, pure permissions.
- Phase 3: app shell and nav config.
- Phase 4: URL-driven leads table, masked directory, a read-only /leads/[id] stub, list DTOs (lib/leads/rows.ts) and
  pure filters.

This is PHASE 5: make leads editable. Create and edit forms with a live duplicate check, stage changes, activity
logging, follow-up scheduling, admin delete and reassign, and a complete lead page. Still no real backend: mutations go
to an in-memory server store that Phase 9 replaces with Supabase.

## 0. Rules carried over
- Next.js 16 + Cache Components: session/params reads inside a page-level <Suspense> child; `params` is a Promise.
- Every Server Action re-checks the session and permissions against the CURRENT record in the store, validates input
  with the same zod schema the form uses, and never trusts ids or roles sent by the client.
- Never send a full Lead to a non-owner. Duplicate-check results are masked (company, owner name, stage).
- zod is v4 (use z.email(), z.url()); @hookform/resolvers v6 supports it via `zodResolver`. Keep the form schema
  free of transforms (input type = output type); normalize on the server instead.
- After a mutation, call revalidatePath("/", "layout") so the list, the sidebar badge and the dashboards refresh.

## 1. In-memory store: lib/data/store.ts (server-only)
- Seeded once from structuredClone(mockLeads) and kept on globalThis, so it survives dev hot-reloads. It resets on
  server restart (document this).
- listLeads(), findLead(id), insertLead(lead), replaceLead(lead), removeLead(id), nextLeadId() ("L-" + max+1).
- lib/data/leads.ts switches from mockLeads to listLeads() everywhere (pass the leads explicitly into selectors).
  /dev/data keeps showing the pristine seed.

## 2. Time in the mock world: lib/dates.ts
- nowIso(): TODAY's date with the real current IST time of day ("2026-10-28T14:05:00+05:30").
- laterThan(iso, minIso): returns iso, or minIso + 1 minute when iso is not after minIso. This keeps history ordered
  even when seed data has a later time on TODAY.

## 3. Shared zod schemas: lib/leads/schemas.ts (client + server)
- leadFormSchema: companyName (2–120), industry (enum INDUSTRIES), companySize, city (enum CITIES), pocName (2–80),
  pocDesignation (2–80), pocEmail (z.email), pocPhone (an Indian mobile: optional +91/0 prefix, 10 digits starting
  6–9, spaces/dashes allowed; normalized server-side to "+91 98xxx xxxxx"), pocLinkedIn (z.url on linkedin.com, or ""),
  source, priority, dealValue (an integer ₹10,000 – ₹10,00,00,000), nextFollowUpDate ("YYYY-MM-DD" ≥ TODAY, or ""),
  notes (≤ 1000), ownerId (string; ignored for agents), duplicateAcknowledged (boolean).
- logActivitySchema: type (call | email | meeting | note), description (3–500), date ("YYYY-MM-DD" ≤ TODAY),
  nextFollowUpDate ("" or ≥ TODAY).
- changeStageSchema: to (LeadStage), note (≤ 300), lostReason (required, 3–300, when to = "lost"), finalDealValue
  (optional positive integer when to = "won"). Use superRefine for the conditional rules.
- followUpSchema: date ("" clears it, else ≥ TODAY).

## 4. Pure mutation logic: lib/leads/mutations.ts (unit-tested; no I/O)
- allowedNextStages(stage): the next PIPELINE_ORDER step, plus "lost" for any active stage; [] for won/lost.
- buildNewLead(input, { id, ownerId, at, byUserId }): stage "new", stageHistory [{ new, at, null }], an activity
  "Lead created", closedAt null.
- applyLeadEdits(lead, input, { canReassign }): updates fields; ownerId only changes when canReassign. When the owner
  changes, add a note activity "Reassigned from X to Y".
- applyStageChange(lead, { to, at, byUserId, note, lostReason, finalDealValue }): throws if the move is not allowed.
  It closes the previous history entry, appends the new one, adds a stage_change activity ("Moved from Proposal to
  Lost: <reason>"), sets closedAt and clears nextFollowUpAt for won/lost, and applies finalDealValue on won.
- applyActivity(lead, { type, description, date, byUserId, nextFollowUpDate }): rejects closed leads and dates outside
  [createdAt day, TODAY]. The timestamp is nowIso() for today, else 12:00 IST (never before createdAt). Updates
  lastContactedAt for call/email/meeting when newer, and sets nextFollowUpAt if given.
- setFollowUp(lead, date | null): rejects closed leads.
- normalizePhone(raw).

## 5. Validation update: lib/validation.ts
- Split the rules: integrity rules always apply (history order, legal moves, contiguous dates, last entry = stage,
  closedAt/follow-up rules, activities inside the lifetime, owner exists). Seed-only rules (exactly 75 leads, ≥ 3
  days per stage, 2–8 activities, one stage_change per transition) apply only when
  `validateLeads(leads, { seedRules: true })`. /dev/data and check:data pass seedRules: true.

## 6. Server Actions: app/(app)/leads/actions.ts ("use server")
Each returns ActionResult = { ok: true; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> }.
- checkDuplicates(companyName) → masked matches { id, companyName, ownerName, stage, isMine } (≥ 3 characters,
  otherwise []). Uses findPossibleDuplicates over the store.
- createLead(input): validate; owner = self for agents, input.ownerId (must be an active agent) for admins. If
  duplicates exist and !duplicateAcknowledged → { ok: false, error: "possible-duplicate" }. Insert and return the id.
- updateLead(id, input): owner or admin only (canEditLead). Reassigning needs canReassignLead. The duplicate check
  ignores the lead itself.
- changeStage(id, input), logActivity(id, input), setFollowUp(id, input): owner or admin.
- deleteLead(id): admin only (canDeleteLead).
- All call revalidatePath("/", "layout") on success. Map zod issues to fieldErrors.

## 7. Pages and components
- /leads/new: PageHeader "Add lead" + <LeadForm mode="create" ownerOptions? />. Admins must pick an owner; agents
  never see the field.
- /leads/[id]/edit: owner/admin only (others → /no-access; unknown id → 404). LeadForm mode="edit" pre-filled;
  admins see an Owner select (reassign).
- components/leads/lead-form.tsx ("use client"): react-hook-form + zodResolver + shadcn Field/Input/Select/Textarea.
  Sections in cards: Company · Point of contact · Deal · Follow-up & notes (Owner for admins). Inline field errors
  (FieldError). Debounced (400 ms) duplicate check on company name: an amber callout listing the matches ("Zenith
  Retail · Rohan Mehta · Qualified"; own matches link to the lead) and a required "This is a different company /
  create anyway" checkbox before submit. Submit shows a pending state; on success toast + router.push(`/leads/${id}`);
  on error, set fieldErrors on the form or show a toast. Cancel goes back.
- /leads/[id] (full view) becomes a two-column layout (stacked on mobile):
  - Header: company, "industry · city", PriorityBadge + StageBadge; actions: Edit, Change stage, Log activity, and
    Delete (admin, with a confirm dialog). Closed leads hide Change stage and Log activity.
  - StageStepper: the 6 pipeline steps with completed/current/upcoming styling. Lost shows a red "Lost at <stage>"
    banner instead.
  - Activity timeline (newest first): an icon per type, description, "by <name> · 28 Oct 2026, 2:05 pm".
  - Aside: Details card (from Phase 4), Follow-up card (date + FollowUpLabel, inline date input + Save/Clear),
    Notes card, Stage history (stage, dates, days in stage).
  - ChangeStageDialog: a radio list of allowedNextStages, an optional note, lost → required reason, won → final deal
    value pre-filled.
  - LogActivityDialog: type select, description, date (default today, max today, min created), optional next
    follow-up.
- The masked view is unchanged.

## 8. Verification
- scripts/check-mutations.ts (`npm run check:mutations`):
  - buildNewLead passes integrity validation.
  - Walking a lead new → … → won one step at a time stays valid, and each step adds a stage_change activity.
  - Lost from proposal requires a reason; won → anything throws; a skip (new → proposal) throws.
  - An activity dated before created or after TODAY throws; a call updates lastContactedAt; a note does not.
  - A non-reassigning edit keeps the owner.
  - normalizePhone("9876543210") === "+91 98765 43210".
  - validateLeads(seed, { seedRules: true }) is still valid.
- Browser:
  1. As Priya, create "Zenith Retail Solutions": the duplicate warning shows both Zenith leads; submitting without
     ticking is blocked; after ticking it creates, redirects to the new lead and toasts; the lead appears in My leads
     (27).
  2. Invalid email/phone show inline errors; nothing is created.
  3. Advance that lead new → contacted → qualified; the stepper, history and timeline update. Log a call → last
     contact = today. Set a follow-up → the Follow-up badge count updates.
  4. Mark it lost with a reason → Closed banner; the actions are hidden.
  5. Priya cannot open /leads/<Rohan's lead>/edit (→ /no-access); posting to the action for that id returns an error.
  6. Admin edits a lead and reassigns it to Karan → the timeline shows the reassignment; Karan now sees it.
  7. Admin deletes the test lead → back on /leads, and the count drops.
- lint, build and all check scripts pass; the dev log and console are clean.
- Commit: "Phase 5: lead create/edit, stage changes and activity log".
```
