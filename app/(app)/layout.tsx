import { Suspense, type ReactNode } from "react";
import { DevUserSwitcher } from "@/components/auth/dev-user-switcher";
import { UserProvider } from "@/components/auth/user-provider";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { mockUsers } from "@/data/mock-users";
import { requireUser } from "@/lib/auth/dal";

// Authenticated area. The session read lives inside Suspense (never a top-level
// await in the layout). Pages still check access themselves via the DAL, because
// layouts do not re-run on client navigation.

async function AuthGate({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const showSwitcher = process.env.NODE_ENV === "development";
  return (
    <UserProvider user={user}>
      {children}
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
    <Suspense fallback={<PageSkeleton />}>
      <AuthGate>{children}</AuthGate>
    </Suspense>
  );
}
