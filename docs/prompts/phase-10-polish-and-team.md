# Phase 10 prompt: real team accounts, polish, accessibility and mobile

```text
You are a senior full-stack engineer finishing the Lead Tracking Dashboard.
Done so far (Phases 1–9): a Next.js 16 app (App Router, Cache Components) on Vercel
(https://karta-dashboard-alpha.vercel.app, auto-deploys from github.com/rsv-vc/karta-dashboard), backed by a hosted
Supabase project (Mumbai) with Row Level Security, atomic lead functions, a seeded demo team, one-click demo sign-in,
and eight check scripts (check:rls runs against the live database).

Known gaps this phase closes:
- The team list lives in code (data/mock-users.ts) with short app ids ("u_priya") mapped to auth UUIDs.
- There is no way to invite people, reset a password, deactivate someone or edit targets.
- No route-level loading/error states, no automated accessibility checks, and the leads table only scrolls sideways
  on phones.

## 0. Rules carried over
- Read node_modules/next/dist/docs/ when unsure (proxy, Cache Components, forms). Session reads stay inside page-level
  <Suspense>; params/searchParams are Promises.
- Schema changes are migrations in supabase/migrations/, applied with apply_migration; run the security and
  performance advisors after each one and fix the findings. Regenerate types/supabase.ts.
- Every Server Action re-checks the session and permissions; the database (RLS + functions) stays the final gate.
- Keep all check scripts passing; add tests for every new rule. Commit in small steps.
- Anything that sends email, changes Auth settings or adds paid services: ask first.

## Part A: real team accounts

### A1. The team comes from the database
- profiles is the single source of truth. App user ids become the profile UUIDs everywhere; remove the "u_priya" →
  UUID mapping (getUserByAuthId, toAuthId, toAppUserId).
- lib/data/team.ts (server-only): getTeam() (cached per request) → TeamMember[] { id, name, email, role, title,
  status, joinedAt }; getTeamMap() for id → name lookups.
- Replace every getUserById/getAgents/mockUsers call in app code with team data passed down from the server: DTOs
  already carry ownerName; ActivityTimeline, CSV export, reports, team metrics, the owner filters and the dev switcher
  receive names from getTeam().
- data/mock-users.ts survives only as seed input (with its fixed UUIDs). Pure modules take `agents` / `ownerName`
  parameters instead of importing it. Update the check scripts to pass a team fixture.

### A2. Admins create members and reset passwords (no email needed)
- Member types: **Employee** (in-house staff, role admin) and **Sales agent** (outsourced, role sales_agent).
- Email rule, enforced in the database: employees must use a company address (@getkarta.ai; the domain list lives
  in app_settings). Sales agents may use a company address or an outside address on the allowlist that admins
  manage on /team ("Allowed outside emails"). Nobody can sign themselves up.
- SUPABASE_SECRET_KEY is added to Vercel and .env.local, used only in lib/supabase/admin.ts (import "server-only").
  Never import it from anything a Client Component can reach; add a check that fails if it leaks into client
  bundles (grep .next/static).
- Admin "Add member" (on /team): name, email, type, title → auth.admin.createUser (email confirmed, no email sent)
  with a generated temporary password shown once with a copy button, and the profile row created with it.
- Admin "Reset password" on a member: a new temporary password, shown once.
- A temporary password must be changed at the next sign-in (profiles.must_change_password → /auth/set-password,
  min 10 characters with a strength hint; nothing else is reachable until it is changed).
- /settings: edit your own name and title, and change your password (re-enter the current password first).

### A3. Managing the team (admin)
- On /team, each member's card gets a menu: Change role (admin/agent), Deactivate / Reactivate, Edit monthly targets.
- Deactivating someone who owns active leads requires choosing who receives them (reuses reassign_leads), then sets
  status inactive (they are signed out on their next request; RLS already treats them as nobody).
- An admin cannot demote or deactivate themselves, and the team always keeps at least one active admin (enforce in a
  database function: admin_update_member(id, role, status)).
- Targets editor: won value (₹) and new leads per agent per month, writing monthly_targets (admin RLS already allows it).

### A4. Demo versus real use
- For now the current Supabase project stays the demo and is also where members are created; a separate project
  for real use comes later. One-click demo sign-in stays on the current link (NEXT_PUBLIC_DEMO_MODE=true).
- The seeded demo accounts are exempt from the email rule (they are marked as demo accounts).
- Make sure every page handles an empty database (no leads, no targets) with helpful empty states, ready for the
  move to a clean project.

## Part B: polish
- loading.tsx skeletons that match each page's layout; error.tsx boundaries for (app) with "Try again" and a support
  hint; a not-found for unknown leads; global-error.tsx.
- Command palette (Ctrl/Cmd+K, the shadcn Command component): jump to pages, and search the leads you can open by
  company or POC (server-side search, masked results never shown).
- List pages fetch only the columns they render (no history/activities for /leads and dashboards that do not need
  them); measure before/after.
- App icon, favicon, page titles and Open Graph image; consistent toast wording; numbers and dates via the existing
  helpers only.
- Vercel Speed Insights (free tier), if the user agrees.

## Part C: accessibility (WCAG 2.2 AA)
- Add Playwright + @axe-core/playwright. `npm run test:a11y` signs in as an agent and as an admin (demo mode) and scans:
  login, dashboard, leads, the lead page with dialogs open, follow-ups, team, reports. Light and dark. Zero serious or
  critical violations.
- Manual keyboard pass: a "Skip to content" link; a visible focus ring everywhere; a logical tab order; dialogs trap
  and return focus; dropdowns and popovers are fully keyboard-operable; sortable headers announce their sort state.
- Forms: errors linked with aria-describedby, required fields marked, the first invalid field focused on submit.
- Status never by colour alone (stage/priority already have labels; check the overdue indicators).
- Respect prefers-reduced-motion (chart and dialog animations off).
- Re-check the stage badge and chart colours for contrast in both themes (the dataviz validator for chart colours;
  WCAG 4.5:1 for badge text).

## Part D: mobile
- /leads and the directory below md: a card list (company, stage, priority, value, follow-up; tap opens the lead)
  instead of a sideways-scrolling table. The same URL filters, in a bottom Sheet ("Filters · 3").
- Touch targets ≥ 44px for row actions (Log, Reschedule), the pagination and the filter chips.
- The lead page: sticky bottom action bar on phones (Change stage, Log activity).
- Test at 360px and 390px widths, iOS Safari quirks (date inputs, 100vh) and Android Chrome.
- Optional: a web app manifest so the team can "Add to Home Screen".

## Part E: quality gates
- GitHub Actions on every push and pull request: install, lint, type-check, build, and the pure check scripts.
  check:rls, the Playwright e2e and the a11y scans run in CI only if the user adds the repository secrets.
- Playwright e2e (`npm run test:e2e`) for the core flows: sign in, create a lead with the duplicate warning, change
  stage, log a call, reschedule, admin rebalance, CSV export. It resets the demo data before running
  (DEMO_SEED=true db:seed) and never runs against the real-use project.

## Done when
- Admin can add an employee or a sales agent who signs in with the temporary password and must change it; a
  company-domain/allowlist violation is refused by the database; an admin password reset works; deactivating someone moves their leads; at least one
  admin is always kept.
- No code reads the team from data/mock-users.ts outside the seed.
- test:a11y passes with no serious/critical issues; the keyboard pass is documented in docs/accessibility.md.
- Phones show the card list and the bottom filter sheet with no sideways scroll.
- CI is green on GitHub; the Vercel deployment works; check:rls and every check script pass.

## Decisions (confirmed by the user)
1. Account access stays in the admin's hands: admins create members (employee or sales agent) and reset their
   passwords. No invitation or reset emails, so no email provider is needed.
2. The current Supabase project stays the demo for now; a clean project for real use comes later.
3. No self sign-up. Accounts need a company email (@getkarta.ai) or an outside email the admins allow; employees
   (admin access) need a company email, outsourced sales agents may use an allowed outside email.
4. One-click demo sign-in stays on the current link.
5. Add the demo project's Supabase keys and the demo password as GitHub repository secrets so check:rls, the e2e
   tests and the accessibility scans run in CI.
```
