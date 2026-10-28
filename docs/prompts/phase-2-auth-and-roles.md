# Phase 2 prompt: mock auth, sessions and role permissions

```text
You are a senior frontend engineer continuing the Lead Tracking Dashboard. Phase 1 is done: Next.js 16 (App Router,
Cache Components ON, Turbopack), Tailwind 4, shadcn/ui (Radix, Zinc; `field` replaces the deprecated `form`),
types in types/, seeded mock data in data/, pure selectors in lib/selectors.ts, and /dev/data.

This is PHASE 2: mock authentication, a signed session cookie, role-based permissions and route protection.
Do NOT build the sidebar/app shell, lead tables, dashboards or charts; those come in Phases 3+. The only pages in this
phase are the login page, a bare-bones /dashboard and /reports to prove protection works, and a /no-access page.

## 0. Read first (this Next.js differs from older versions)
Read these in node_modules/next/dist/docs/01-app/ before writing code, and follow them where they differ from memory:
- 02-guides/authentication.md and 02-guides/authentication-with-cache-components.md
- 03-api-reference/03-file-conventions/proxy.md (`middleware` is renamed to `proxy`)
- 03-api-reference/04-functions/cookies.md
Key rules: with Cache Components, any component that reads cookies() must render inside <Suspense> (reading outside
one is a build error); never await the session at the top level of a layout; every Server Action re-checks the session.
Do not enable experimental flags (no authInterrupts/forbidden()).
Learned while building it:
- Each PAGE that reads the session needs its own <Suspense> around a child component. The layout's boundary is not
  enough, because layouts do not re-render on client navigation (the dev overlay reports "uncached data … outside of
  <Suspense>").
- readSession() must `await connection()` (from next/server) before checking expiry with Date.now(). Otherwise the
  dev overlay reports "unstable value Date.now() while prerendering".

## 1. Permission model (the heart of this phase)
- admin (Chief Growth Officer): full access to every lead, team dashboards, reports, reassigning and deleting leads.
- sales_agent: full access to leads they OWN. For other agents' leads they get ONLY LeadDirectoryEntry
  (id, companyName, pocName, ownerId, stage), so they can see who is working a company without its details.
  Agents cannot see reports or team dashboards, reassign leads or delete leads. Agents can create leads.
- Inactive users cannot log in, and an existing session for them is treated as logged out.
Masking must happen on the SERVER: a full Lead object for a lead the viewer does not own must never be passed
to a Client Component or returned from a Server Action.

## 2. Mock credentials: data/mock-credentials.ts
- Export DEMO_PASSWORD = "karta-demo" (every mock user shares it) with a comment: mock only, replaced by real auth
  in Phase 9.
- Export verifyCredentials(email, password): User | null (case-insensitive email, must be active).

## 3. Session: lib/auth/session.ts (import "server-only"; add the `server-only` package)
- Cookie name "karta_session". Value = base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature).
  Payload: { userId, issuedAt, expiresAt } with 7-day expiry.
- Sign with process.env.SESSION_SECRET (at least 32 chars). Create .env.local with a random secret and commit
  .env.example with a placeholder (update .gitignore so .env.example is tracked). In development only, fall back to a
  fixed dev secret with a console warning; in production, throw if it is missing.
- Use node:crypto createHmac + timingSafeEqual for verification.
- Exports: createSession(userId), readSession(): Promise<SessionPayload | null> (null if missing, tampered or
  expired), deleteSession().
- Cookie options: httpOnly, sameSite "lax", secure in production, path "/", maxAge 7 days.

## 4. Data Access Layer: lib/auth/dal.ts (server-only)
- SessionUser = Pick<User, "id" | "name" | "email" | "role" | "title"> (the narrow shape sent to the client).
- getCurrentUser(): SessionUser | null, wrapped in React cache() so it is computed once per request. Returns null if
  there is no valid session or the user is missing or inactive.
- requireUser(): SessionUser; redirects to /login if there is no user.
- requireRole(role): SessionUser; redirects to /no-access if the role does not match.

## 5. Permissions: lib/auth/permissions.ts (PURE; no cookies, so scripts can test it)
- isAdmin(user), canViewFullLead(user, lead), canEditLead(user, lead), canCreateLead(user), canReassignLead(user),
  canDeleteLead(user), canViewReports(user), canViewTeamDashboard(user)
- VisibleLead = { kind: "full"; lead: Lead } | { kind: "masked"; entry: LeadDirectoryEntry }
- toVisibleLead(user, lead): VisibleLead (masked entries are built with toDirectoryEntry from lib/selectors.ts)
- partitionLeadsForUser(user, leads): { full: Lead[]; masked: LeadDirectoryEntry[] }
  (admin: everything full, nothing masked; agent: own leads full, others masked)

## 6. Scoped lead access: lib/data/leads.ts (server-only)
Pages call ONLY these, never mockLeads directly. Each resolves the current user itself, so a caller cannot ask for
someone else's data by passing an id:
- getVisibleLeads() → partitionLeadsForUser(currentUser, mockLeads)
- getMyLeads() → the current user's own leads (all leads for admin)
- getLeadForViewer(id) → VisibleLead | null

## 7. Server Actions: app/(auth)/actions.ts ("use server")
- login(prevState, formData): validate with zod (email, password min 1). On failure, return
  { error: "Invalid email or password" } (one generic message; never reveal which part was wrong). On success,
  createSession and redirect to a safe `next` value (must start with "/" and not "//"; default /dashboard).
- loginAsDemo(userId): demo quick-login (allowed while the app runs on mock data).
- logout(): deleteSession, redirect("/login").
- switchUserDev(userId): development only. Return an error in production. Swaps the session to another user.

## 8. Proxy: proxy.ts (project root)
- An optimistic check: verify the cookie's signature and expiry with the pure helpers from lib/auth/session-token.ts,
  plus "user exists and is active" (the proxy runs on Node in Next 16). It must apply the SAME rules as the DAL;
  otherwise a valid-looking cookie for an inactive user loops between /login and /dashboard.
- No valid session on a protected path → redirect to /login?next=<path+search> and delete any bad cookie.
- Valid session on /login → redirect to /dashboard.
- "/" → /dashboard.
- Public paths: /login, /no-access, /dev/*. The matcher excludes _next/static, _next/image, favicon.ico and files
  with an extension.

## 9. Pages and components
- app/(auth)/login/page.tsx: centered Card on a muted background with the app name.
  - Email + password form (client component using useActionState, shadcn Field, Input and Button; inline error; a
    pending state on the submit button). Pre-fill nothing.
  - "Demo accounts" list below it: one row per mock user (Avatar with initials, name, title, role Badge) with a
    "Sign in" button calling loginAsDemo. A muted hint shows the demo password.
  - Reads `next` from searchParams inside a Suspense boundary.
- app/(app)/layout.tsx: no top-level await. Render <Suspense fallback={<skeleton/>}><AuthGate>{children}</AuthGate></Suspense>,
  where AuthGate awaits requireUser() and wraps children in <UserProvider user={user}>.
- components/auth/user-provider.tsx ("use client"): UserProvider + useUser() hook (throws outside the provider).
- components/auth/logout-button.tsx: form with the logout action.
- components/auth/dev-user-switcher.tsx: small floating card, bottom-right, rendered ONLY when
  NODE_ENV === "development" (check on the server). It has a Select of all users ("Viewing as …") that calls
  switchUserDev, plus a toast on switch.
- app/(app)/dashboard/page.tsx (placeholder): "Welcome, {name}", role badge and title; "You can see N leads in full and
  M as directory entries" from getVisibleLeads(); for admins, a link to /reports; a logout button.
- app/(app)/reports/page.tsx (placeholder): requireRole("admin"), then "Reports: coming in Phase 8".
- app/no-access/page.tsx: static 403 message with a link back to /dashboard.
- app/page.tsx: delete it (the proxy handles "/"), or make it redirect to /dashboard.

## 10. Verification script: scripts/check-permissions.ts (`npm run check:permissions`)
Assert (throw on failure, print a ✓ per check):
- admin: 75 full, 0 masked; canViewReports true
- each agent: full count = getLeadsByOwner(agent).length; full + masked = 75; canViewReports false
- every masked entry has exactly the 5 directory keys
- an agent's toVisibleLead on another agent's lead → masked; on own lead → full
- verifyCredentials: correct → user; wrong password → null; uppercase email → user
- session round-trip: sign → verify OK; tampered payload → null; expired → null
  (put the pure sign/verify helpers in lib/auth/session-token.ts so the script can import them without next/headers)

## 11. Quality rules
- No `any`. Small functions with brief intent comments. Match the Phase 1 code style.
- `npm run lint`, `npm run build`, `npm run check:data` and `npm run check:permissions` all pass.
- Commit at the end: "Phase 2: mock auth, signed sessions and role permissions".

## Done when (verify in the browser)
- Visiting /dashboard while logged out redirects to /login?next=/dashboard; after login you land back on /dashboard.
- A wrong password shows "Invalid email or password".
- Admin login: the dashboard shows 75 full / 0 masked, and /reports opens.
- Priya login: 26 full / 49 masked; /reports redirects to /no-access.
- The dev switcher changes user instantly, and the counts update.
- Logout returns to /login; /dashboard redirects to login again.
- Editing the cookie value by hand (tampering) logs you out instead of erroring.
- Finish with a summary: files created, deviations from this spec and test results.
```
