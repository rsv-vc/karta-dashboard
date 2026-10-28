import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RoleBadge } from "@/components/auth/role-badge";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/shared/coming-soon";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { canViewReports } from "@/lib/auth/permissions";
import { getVisibleLeads } from "@/lib/data/leads";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";

export const metadata: Metadata = { title: "Dashboard · Karta Lead Tracker" };

// Placeholder dashboard: proves auth and scoping work. Real content arrives in
// Phase 6 (agents) and Phase 7 (admin). The session read sits inside the page's
// own Suspense boundary, because the layout's boundary does not re-run on navigation.
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
  const firstName = user.name.split(" ")[0];

  return (
    <PageContainer>
      <PageHeader
        title={getNavTitle("dashboard", user.role)}
        description={`Welcome back, ${firstName}.`}
        actions={<RoleBadge role={user.role} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Your lead access</CardTitle>
          <CardDescription>What the server sends to you, after permission checks.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-8">
          <div>
            <div className="text-3xl font-semibold tabular-nums">{full.length}</div>
            <div className="text-sm text-muted-foreground">leads in full</div>
          </div>
          <div>
            <div className="text-3xl font-semibold tabular-nums">{masked.length}</div>
            <div className="text-sm text-muted-foreground">as directory entries (masked)</div>
          </div>
          {canViewReports(user) && (
            <Button asChild variant="secondary" className="self-center">
              <Link href="/reports">Open reports</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <ComingSoon
        navKey="dashboard"
        phase={user.role === "admin" ? 7 : 6}
        description={
          user.role === "admin" ? "How the whole team is doing this month." : NAV_ITEMS.dashboard.description
        }
        features={
          user.role === "admin"
            ? ["Team KPIs and pipeline value", "Stage funnel", "Month-on-month trend charts", "Agent leaderboard"]
            : ["Today's follow-ups", "My pipeline by stage", "Monthly target progress", "Recent activity"]
        }
      />
    </PageContainer>
  );
}
