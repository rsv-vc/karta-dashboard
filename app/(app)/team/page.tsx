import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { AgentCard } from "@/components/team/agent-card";
import { ReassignDialog } from "@/components/team/reassign-dialog";
import { getTeamPageData } from "@/lib/data/leads";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";

export const metadata: Metadata = { title: "Team · Karta Lead Tracker" };

export default function TeamPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TeamContent />
    </Suspense>
  );
}

async function TeamContent() {
  // Admin only: redirects other roles to /no-access.
  const { members, leads } = await getTeamPageData();
  return (
    <PageContainer>
      <PageHeader
        title={getNavTitle("team")}
        description={NAV_ITEMS.team.description}
        actions={<ReassignDialog agents={members.map(({ id, name }) => ({ id, name }))} leads={leads} />}
      />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {members.map((m) => (
          <AgentCard key={m.id} member={m} />
        ))}
      </div>
    </PageContainer>
  );
}
