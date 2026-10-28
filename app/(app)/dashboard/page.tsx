import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RoleBadge } from "@/components/auth/role-badge";
import { AgentDashboard } from "@/components/dashboard/agent-dashboard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/shared/coming-soon";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { isAdmin } from "@/lib/auth/permissions";
import { TODAY } from "@/lib/constants";
import { getAgentDashboard, getVisibleLeads } from "@/lib/data/leads";
import { getNavTitle } from "@/lib/navigation";
import { formatDate } from "@/lib/utils";
import type { SessionUser } from "@/types/user";

export const metadata: Metadata = { title: "Dashboard · Karta Lead Tracker" };

// Agents get their working dashboard (Phase 6); the admin team overview arrives
// in Phase 7. The session read sits inside the page's own Suspense boundary,
// because the layout's boundary does not re-run on navigation.
export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const user = await requireUser();
  return isAdmin(user) ? <AdminPlaceholder user={user} /> : <AgentHome user={user} />;
}

async function AgentHome({ user }: { user: SessionUser }) {
  const data = await getAgentDashboard();
  const firstName = user.name.split(" ")[0];
  return (
    <PageContainer>
      <PageHeader
        title={getNavTitle("dashboard", user.role)}
        description={`Welcome back, ${firstName}. Here is your day, ${formatDate(TODAY)}.`}
      />
      <AgentDashboard data={data} />
    </PageContainer>
  );
}

async function AdminPlaceholder({ user }: { user: SessionUser }) {
  const { full } = await getVisibleLeads();
  return (
    <PageContainer>
      <PageHeader
        title={getNavTitle("dashboard", user.role)}
        description={`Welcome back, ${user.name.split(" ")[0]}.`}
        actions={<RoleBadge role={user.role} />}
      />
      <Card>
        <CardHeader>
          <CardTitle>Team at a glance</CardTitle>
          <CardDescription>You can see every lead in full.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-8">
          <div>
            <div className="text-3xl font-semibold">{full.length}</div>
            <div className="text-sm text-muted-foreground">leads across the team</div>
          </div>
          <Button asChild variant="secondary">
            <Link href="/follow-ups">Team follow-ups</Link>
          </Button>
        </CardContent>
      </Card>
      <ComingSoon
        navKey="dashboard"
        phase={7}
        description="How the whole team is doing this month."
        features={["Team KPIs and pipeline value", "Stage funnel", "Month-on-month trend charts", "Agent leaderboard"]}
      />
    </PageContainer>
  );
}
