import { cookies } from "next/headers";
import { Suspense, type ReactNode } from "react";
import { DevUserSwitcher } from "@/components/auth/dev-user-switcher";
import { UserProvider } from "@/components/auth/user-provider";
import { AppHeader } from "@/components/layout/app-header";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { mockUsers } from "@/data/mock-users";
import { requireUser } from "@/lib/auth/dal";
import { getFollowUpCounts } from "@/lib/data/leads";

// Authenticated app shell. The session read lives inside Suspense (never a
// top-level await in the layout). Pages still check access themselves via the
// DAL, because layouts do not re-run on client navigation.

async function AuthGate({ children }: { children: ReactNode }) {
  const [user, followUps, cookieStore] = await Promise.all([requireUser(), getFollowUpCounts(), cookies()]);
  // shadcn's sidebar stores its open/collapsed state in this cookie.
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const showSwitcher = process.env.NODE_ENV === "development";

  return (
    <UserProvider user={user}>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar overdueCount={followUps.overdue} />
        <SidebarInset>
          <AppHeader />
          <main className="flex flex-1 flex-col p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      {showSwitcher && (
        <DevUserSwitcher
          currentUserId={user.id}
          users={mockUsers.filter((u) => u.status === "active").map(({ id, name, role }) => ({ id, name, role }))}
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
