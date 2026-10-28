import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { RoleBadge } from "@/components/auth/role-badge";
import { UserAvatar } from "@/components/auth/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { canViewReports } from "@/lib/auth/permissions";
import { getVisibleLeads } from "@/lib/data/leads";

export const metadata: Metadata = { title: "Dashboard · Karta Lead Tracker" };

// Placeholder dashboard proving auth and scoping work. Replaced in Phases 3, 6 and 7.
// The session read sits inside the page's own Suspense boundary: the layout's
// boundary does not re-run on client navigation.
export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const user = await requireUser();
  const { full, masked } = await getVisibleLeads();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserAvatar name={user.name} className="size-10" />
          <div>
            <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RoleBadge role={user.role} />
              {user.title}
            </div>
          </div>
        </div>
        <LogoutButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your lead access</CardTitle>
          <CardDescription>What the server sends to you, after permission checks.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-8">
          <div>
            <div className="text-3xl font-semibold tabular-nums" data-testid="full-count">
              {full.length}
            </div>
            <div className="text-sm text-muted-foreground">leads in full</div>
          </div>
          <div>
            <div className="text-3xl font-semibold tabular-nums" data-testid="masked-count">
              {masked.length}
            </div>
            <div className="text-sm text-muted-foreground">as directory entries (masked)</div>
          </div>
        </CardContent>
      </Card>

      {canViewReports(user) && (
        <Button asChild variant="secondary" className="self-start">
          <Link href="/reports">Open reports (admin only)</Link>
        </Button>
      )}
    </main>
  );
}
