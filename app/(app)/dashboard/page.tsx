import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { AgentDashboard } from "@/components/dashboard/agent-dashboard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { isAdmin } from "@/lib/auth/permissions";
import { TODAY } from "@/lib/constants";
import { parsePeriod } from "@/lib/dashboard/team-metrics";
import { getAgentDashboard, getTeamDashboard } from "@/lib/data/leads";
import { getNavTitle } from "@/lib/navigation";
import { formatDate } from "@/lib/utils";
import type { SessionUser } from "@/types/user";

export const metadata: Metadata = { title: "Dashboard · Karta Lead Tracker" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Agents get their working dashboard; admins get the team overview. The session
// read sits inside the page's own Suspense boundary, because the layout's
// boundary does not re-run on navigation.
export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<PageSkeleton layout="dashboard" />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  return isAdmin(user) ? <AdminHome user={user} searchParams={searchParams} /> : <AgentHome user={user} />;
}

function greeting(user: SessionUser): string {
  return `Welcome back, ${user.name.split(" ")[0]}. Here is your day, ${formatDate(TODAY)}.`;
}

async function AgentHome({ user }: { user: SessionUser }) {
  const data = await getAgentDashboard();
  return (
    <PageContainer>
      <PageHeader title={getNavTitle("dashboard", user.role)} description={greeting(user)} />
      <AgentDashboard data={data} />
    </PageContainer>
  );
}

async function AdminHome({ user, searchParams }: { user: SessionUser; searchParams: SearchParams }) {
  const period = parsePeriod((await searchParams).period);
  const data = await getTeamDashboard(period);
  return (
    <PageContainer>
      <PageHeader title={getNavTitle("dashboard", user.role)} description={greeting(user)} />
      <AdminDashboard data={data} period={period} />
    </PageContainer>
  );
}
