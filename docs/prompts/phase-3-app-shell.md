# Phase 3 prompt: app shell, role-based navigation and placeholder pages

```text
You are a senior frontend engineer continuing the Lead Tracking Dashboard.
Done so far:
- Phase 1: Next.js 16 (App Router, Cache Components ON), Tailwind 4, shadcn/ui (Radix, Zinc), types, seeded mock data,
  pure selectors.
- Phase 2: signed session cookie, DAL (lib/auth/dal.ts: getCurrentUser, requireUser, requireRole), pure permission
  rules (lib/auth/permissions.ts), scoped data getters (lib/data/leads.ts), login/logout, proxy.ts, dev user switcher,
  and placeholder /dashboard and /reports.

This is PHASE 3: the authenticated app shell (sidebar, header, user menu, theme toggle) and a placeholder page for
every route later phases fill in. Do NOT build lead tables, forms, charts or real dashboard content.

## 0. Rules carried over from Phase 2 (this Next.js differs from older versions)
- Read node_modules/next/dist/docs/ when unsure. `middleware` is `proxy`.
- Any component that reads the session (cookies) renders inside <Suspense>. Each PAGE wraps its session-reading content
  in its own <Suspense>; the layout's boundary is not enough, because layouts do not re-render on client navigation.
- No top-level await in layouts. Pages enforce access themselves (requireUser/requireRole). Hiding a nav link is
  cosmetic, never security.
- Server Components cannot pass functions (including icon components) as props to Client Components. Keep icon
  references inside client modules, or pass string keys.

## 1. Routes and who sees them
Single source of truth: lib/navigation.ts.
| Route             | Label (agent / admin)        | Roles        | Filled in |
|-------------------|------------------------------|--------------|-----------|
| /dashboard        | My dashboard / Team overview | all          | Phase 6/7 |
| /leads            | My leads / All leads         | all          | Phase 4   |
| /leads/directory  | Lead directory               | sales_agent  | Phase 4   |
| /leads/new        | Add lead (header button)     | all          | Phase 5   |
| /follow-ups       | Follow-ups                   | all          | Phase 6   |
| /team             | Team                         | admin        | Phase 7   |
| /reports          | Reports                      | admin        | Phase 8   |
| /settings         | Settings                     | all          | Phase 10  |
- NavItem: { key, href, icon (lucide component), label: string | Record<Role, string>, roles: Role[], phase: number,
  description: string, badge?: "overdueFollowUps" }
- Nav sections: "Workspace" (dashboard, leads, directory, follow-ups) and "Admin" (team, reports; hidden for agents).
  Settings sits in the sidebar footer area via the user menu.
- Helpers: getNavSections(role), findNavItem(pathname) (longest-prefix match), getNavLabel(item, role),
  getBreadcrumbs(pathname, role) → { label, href }[].
- /leads/new appears only in breadcrumbs and as the header "Add lead" button.

## 2. Layout: app/(app)/layout.tsx
- Keep <Suspense fallback={<AppShellSkeleton />}><AuthGate>{children}</AuthGate></Suspense>.
- AuthGate (server): requireUser(); read the shadcn `sidebar_state` cookie for defaultOpen; get the overdue follow-up
  count from a new scoped getter, getFollowUpCounts() in lib/data/leads.ts (agent: own leads; admin: all). Then render:
  UserProvider → SidebarProvider(defaultOpen) → AppSidebar(overdueCount) + SidebarInset(AppHeader + <main>{children}</main>)
  → DevUserSwitcher (development only, unchanged).
- AppShellSkeleton: a sidebar-shaped column (hidden on mobile) plus a header bar and content skeletons, so loading
  does not jump.

## 3. Components (components/layout/)
- app-sidebar.tsx ("use client"): shadcn Sidebar with collapsible="icon".
  - Header: brand mark (rounded square with an icon) + "Karta" / "Lead Tracker"; links to /dashboard.
  - Content: one SidebarGroup per section; SidebarMenuButton asChild <Link> with isActive (longest-prefix match via
    usePathname, so /leads/directory highlights Directory, not Leads) and tooltip = label (shown when collapsed).
  - Follow-ups shows SidebarMenuBadge with the overdue count when > 0 (red text).
  - On mobile, close the sheet after a link is clicked (setOpenMobile(false)).
  - Footer: NavUser. Add SidebarRail.
- nav-user.tsx ("use client"): SidebarMenuButton size="lg" with avatar, name and role, opening a DropdownMenu:
  label (name, email, role badge), Settings link, Theme (Light / Dark radio items), Log out (calls the logout Server
  Action in a transition).
- app-header.tsx ("use client"): sticky top bar, h-14, border-b, bg-background/95 + backdrop blur:
  SidebarTrigger | vertical Separator | Breadcrumbs (shadcn breadcrumb; the last crumb is BreadcrumbPage; hide
  intermediate crumbs below sm) | spacer | "Add lead" button (Plus icon; text hidden below sm; only if
  canCreateLead) | ThemeToggle.
- theme-toggle.tsx ("use client"): icon button toggling light/dark with next-themes. Avoid hydration mismatch WITHOUT
  setState-in-effect: render both Sun and Moon icons and switch visibility with `dark:` classes. aria-label
  "Toggle theme".
- page-header.tsx: title, optional description, optional actions slot. Used by every page.
- components/shared/coming-soon.tsx: dashed-border empty state with the nav item's icon, "Coming in Phase N" badge,
  short description and a bullet list of planned features. Placeholder pages pass props; no logic.

## 4. Pages (each: PageHeader + content; session reads wrapped in their own Suspense)
- /dashboard: keep the Phase 2 welcome + lead access counts, restyled with PageHeader; remove the standalone logout
  button (it moves to the user menu). Title by role: "My dashboard" / "Team overview".
- /leads: ComingSoon (phase 4): sortable table, filters by stage/source/priority, search, stage badges.
  Title by role: "My leads" / "All leads".
- /leads/directory: agents only in nav. Admins visiting it see a note ("You already see every lead in full") with a
  link to /leads. ComingSoon (phase 4).
- /leads/new: ComingSoon (phase 5): form with validation, duplicate warning.
- /follow-ups: ComingSoon (phase 6), but also show the real overdue / today / upcoming counts from
  getFollowUpCounts() as three small stat cards.
- /team: requireRole("admin"). ComingSoon (phase 7).
- /reports: requireRole("admin"). Restyle with PageHeader + ComingSoon (phase 8).
- /settings: ComingSoon (phase 10): profile, theme and notification preferences. Show the user's name, email and
  role read-only.
- app/not-found.tsx: simple 404 with a link to /dashboard.

## 5. Quality and verification
- No `any`. Match the existing code style. Responsive down to 375px with no horizontal scroll.
- `npm run lint`, `npm run build`, `npm run check:data` and `npm run check:permissions` pass, with no errors in the
  dev server log or browser console.
- In the browser, verify:
  1. Agent (Priya): sidebar shows Workspace (incl. Directory) and no Admin section; the follow-ups badge shows her
     overdue count; /team and /reports go to /no-access.
  2. Admin: Admin section visible, no Directory link, labels "Team overview" / "All leads".
  3. The active link and breadcrumbs follow navigation (/leads/directory → "Leads › Lead directory").
  4. Collapse to icons (button and Ctrl/Cmd+B) persists across reload (sidebar_state cookie).
  5. Theme toggle switches light/dark with no hydration warning; the user-menu theme items work too.
  6. Mobile (375px): sidebar opens as a sheet from the header trigger and closes after navigating; no horizontal scroll.
  7. User menu → Log out returns to /login.
- Commit: "Phase 3: app shell, role-based navigation and placeholder pages".
```
