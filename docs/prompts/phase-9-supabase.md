# Phase 9 prompt: Supabase backend, real auth and database-enforced permissions

```text
You are a senior full-stack engineer continuing the Lead Tracking Dashboard.
Done so far (Phases 1–8): a complete Next.js 16 app (App Router, Cache Components) running on mock data. Mock auth
uses an HMAC-signed cookie; leads live in an in-memory store (lib/data/store.ts); every page and Server Action goes
through scoped getters in lib/data/leads.ts; pure rules live in lib/auth/permissions.ts, lib/leads/mutations.ts,
lib/dashboard/* and lib/reports/*; and seven check scripts guard the logic.

This is PHASE 9: replace mock auth and the in-memory store with Supabase (Postgres + Auth), and move the most
important permission (agents never see other agents' lead details) into the database with Row Level Security. The UI
must not change. Pages keep calling the same getter and action signatures.

## 0. Ground rules
- Before creating anything billable, show the cost (Supabase MCP get_cost) and wait for the user's confirmation.
  Default: one project on the free tier, region ap-south-1 (Mumbai).
- Read the Supabase docs for @supabase/ssr with the Next.js App Router, and the local docs in
  node_modules/next/dist/docs/ (proxy, cookies, Cache Components). In this Next.js, middleware is `proxy`.
- Secrets: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY go in .env.local (plus .env.example
  placeholders). SUPABASE_SECRET_KEY is used ONLY by the seed script and server-only admin code, never imported by
  anything a Client Component can reach. Never commit real keys.
- All schema changes are SQL migrations in supabase/migrations/ (Supabase CLI), applied with apply_migration. Never
  hand-edit the remote schema. Run the security and performance advisors after each migration and fix the findings.
- Keep the pure logic modules and their check scripts working; data-layer tests get their own script.

## 1. Schema (migration 0001)
- Enums: app_role (admin, sales_agent), user_status, lead_stage, lead_source, lead_priority, company_size,
  activity_type, matching types/*.ts exactly.
- profiles: id uuid PK → auth.users(id) on delete cascade; name, email (unique), role app_role, title, status, joined_at.
- leads: id text PK (keep the "L-1001" style; a sequence for new ids), company_name, poc_name, poc_designation,
  poc_email, poc_phone, poc_linkedin, industry, company_size, city, source, stage, priority, deal_value bigint
  (rupees, check ≥ 0), currency text default 'INR', owner_id uuid → profiles(id), created_at timestamptz,
  last_contacted_at, next_follow_up_at, closed_at, notes, updated_at (trigger).
- lead_stage_history: id, lead_id → leads on delete cascade, stage, start_at, end_at (null = current), with a unique
  partial index (lead_id) where end_at is null.
- lead_activities: id, lead_id → leads on delete cascade, type, description, at timestamptz, by_user_id → profiles.
- monthly_targets: user_id → profiles, month date (first of month), won_value bigint, new_leads int; PK (user_id, month).
- Indexes on leads(owner_id), leads(stage), leads(next_follow_up_at), lead_activities(lead_id, at),
  lead_stage_history(lead_id, start_at), and a normalized company-name index for duplicate checks.
- Check constraints mirroring the integrity rules: closed_at set ⇔ stage in (won, lost); follow-up null when closed.

## 2. Row Level Security (migration 0002), the core of this phase
- Enable RLS on every table. Helper: private.is_admin() (security definer, stable, `set search_path = ''`) reading
  profiles.role for auth.uid().
- profiles: any signed-in user can SELECT id, name, role, title, status (needed for owner names); users UPDATE only
  their own name/title; only admins change role/status.
- leads:
  - SELECT: owner_id = auth.uid() OR is_admin(). Agents CANNOT select other agents' rows at all.
  - INSERT: agents only with owner_id = auth.uid(); admins with any active agent as owner.
  - UPDATE: owner or admin; a BEFORE UPDATE trigger rejects owner_id changes unless is_admin().
  - DELETE: admin only.
- lead_stage_history / lead_activities: access follows the parent lead (exists-subquery on leads with the same
  rules); activities are insert-only for owners/admins (no update/delete except admin).
- monthly_targets: users read their own; admins read/write all.
- The masked directory: a security-definer function public.lead_directory() returning ONLY (id, company_name,
  poc_name, owner_id, stage) for all leads; grant execute to authenticated, revoke from anon. This is the only path
  by which an agent sees other agents' leads.
- Duplicate check: a security-definer function public.find_possible_duplicates(name text, exclude_id text) returning
  the same masked columns, matching the normalized-name rule from lib/selectors.ts (exact or word-prefix,
  minimum length 6).

## 3. Atomic mutations (migration 0003)
Multi-row changes run as Postgres functions (security invoker, so RLS still applies) to stay atomic:
- change_lead_stage(lead_id, to_stage, note, lost_reason, final_deal_value): validates the move (next pipeline step,
  or lost from an active stage), closes the current history row, inserts the new one, writes the stage_change activity
  ("Moved from X to Y[: detail]"), sets closed_at/follow-up/final value. Raises clear errors.
- log_activity(lead_id, type, description, activity_date, next_follow_up_date).
- reassign_leads(lead_ids text[], to_owner uuid): admin only; notes each move.
- create_lead(...) returning the new id, with the "Lead created" activity and the first history row.
Server Actions keep their zod validation and call these functions; map Postgres error messages to the existing
ActionResult shape. The pure functions in lib/leads/mutations.ts stay as the reference rules for the tests.

## 4. App integration
- Install @supabase/ssr and @supabase/supabase-js. lib/supabase/server.ts (createServerClient with cookies(), plus a
  `connection()` before time-dependent reads) and lib/supabase/client.ts (browser client, only where needed).
- Generate types (generate_typescript_types) into types/supabase.ts; write row ↔ domain mappers in lib/data/mappers.ts
  so the rest of the app keeps using Lead, User and friends.
- Auth: replace lib/auth/session*.ts with Supabase Auth (email + password). The DAL (getCurrentUser,
  requireUser, requireRole) reads auth.getUser() + the profile; same signatures, same React cache().
- proxy.ts: the Supabase session-refresh pattern plus the existing redirects (optimistic only; the DAL stays the real
  gate).
- Login page: the same form, now calling signInWithPassword in a Server Action with the same generic error. Remove the
  one-click demo accounts and the dev user switcher from production; keep them only when
  NEXT_PUBLIC_DEMO_MODE=true, signing in to seeded test accounts with passwords from .env.local.
- lib/data/leads.ts: replace every store call with Supabase queries; dashboards and reports fetch the needed leads
  (with history/activities) and reuse the existing pure metric functions unchanged.
- Delete lib/data/store.ts and the in-memory code paths once every getter is migrated.
- "Today": keep TODAY configurable through APP_TODAY (default: the real current date in IST). For the seeded demo,
  set APP_TODAY=2026-10-28 so the dashboards look as they do now.

## 5. Seed (scripts/seed-supabase.ts, `npm run db:seed`)
- Uses SUPABASE_SECRET_KEY. Idempotent: wipes and reloads demo data only when DEMO_SEED=true.
- Creates the 5 users with auth.admin.createUser (passwords from .env.local, never hard-coded), then their profiles.
- Inserts the 75 deterministic leads from data/mock-leads.ts with their history and activities, plus the mock targets.
- Prints a summary and runs validateLeads (integrity rules) over the data read back from the database.

## 6. Verification
- `npm run check:rls` (new) signs in as Priya, Rohan and Admin with the anon key and asserts:
  - Priya selecting leads gets exactly her own rows; selecting Rohan's lead by id returns nothing.
  - lead_directory() returns all leads with exactly the 5 columns.
  - Priya cannot update or delete Rohan's lead, and cannot change owner_id on her own.
  - change_lead_stage rejects a skip (new → proposal) and a move on a closed lead.
  - Admin can read everything, reassign and delete.
  - The anon role (signed out) can read nothing.
- All existing check scripts still pass; the Supabase security advisor reports no errors.
- Browser: repeat the key flows from Phases 2–8 (login, masking, create with the duplicate warning, stage change,
  follow-ups, admin rebalance, reports, CSV export) against Supabase; the data survives a dev-server restart.
- Commit in steps (schema, RLS, functions, app integration, seed) with clear messages.

## Decisions (confirmed by the user)
1. Hosting: the app runs on Vercel (project linked to the public GitHub repo rsv-vc/karta-dashboard, auto-deploying
   on push). The database is a HOSTED Supabase project (free tier, ap-south-1 Mumbai), created through the Vercel
   Marketplace Supabase integration so the env vars are injected into the Vercel project. Skip the local stack: the
   goal is a shared team link. Confirm the cost before creating it.
2. Sign-in: email + password only for now (Google SSO may come later; it must not need schema changes).
3. Keep the fixed demo date: APP_TODAY=2026-10-28 in both .env.local and the Vercel project.
4. One-click demo sign-in stays available on the team deployment: NEXT_PUBLIC_DEMO_MODE=true on Vercel and locally.
   The buttons sign in to the seeded demo accounts. Production deployments for real customers set it to false.
```
