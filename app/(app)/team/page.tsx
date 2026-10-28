import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/shared/coming-soon";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireRole } from "@/lib/auth/dal";
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
  await requireRole("admin");
  return (
    <PageContainer>
      <PageHeader title={getNavTitle("team")} description={NAV_ITEMS.team.description} />
      <ComingSoon
        navKey="team"
        features={["Agent leaderboard", "Win rate and pipeline per agent", "Workload and overdue follow-ups", "Reassign leads"]}
      />
    </PageContainer>
  );
}
