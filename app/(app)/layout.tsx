import { cookies } from "next/headers";
import { Suspense, type ReactNode } from "react";
import { DevUserSwitcher } from "@/components/auth/dev-user-switcher";
import { UserProvider } from "@/components/auth/user-provider";
import { AppHeader } from "@/components/layout/app-header";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireUser } from "@/lib/auth/dal";
import { getFollowUpCounts } from "@/lib/data/leads";
import { fetchTeam } from "@/lib/data/repo";
import { isDemoMode } from "@/lib/supabase/env";

// Authenticated app shell. The session read lives inside Suspense (never a
// top-level await in the layout). Pages still check access themselves via the
// DAL, because layouts do not re-run on client navigation.

async function AuthGate({ children }: { children: ReactNode }) {
  const [user, followUps, cookieStore, team] = await Promise.all([
    requireUser(),
    getFollowUpCounts(),
    cookies(),
    fetchTeam(),
  ]);
  // shadcn's sidebar stores its open/collapsed state in this cookie.
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const showSwitcher = process.env.NODE_ENV === "development" && isDemoMode();

  return (
    <UserProvider user={user}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:ring-3 focus:ring-ring/50"
      >
        Skip to content
      </a>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar overdueCount={followUps.overdue} />
        {/* min-w-0 lets wide content (tables) scroll inside instead of widening the page. */}
        <SidebarInset className="min-w-0">
          <AppHeader />
          <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col p-4 outline-none sm:p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
      {showSwitcher && (
        <DevUserSwitcher
          currentUserId={user.id}
          users={team.filter((u) => u.status === "active").map(({ id, name, role }) => ({ id, name, role }))}
        />
      )}
    </UserProvider>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <AuthGate>{children}</AuthGate>
    </Suspense>
  );
}
