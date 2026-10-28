import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/shared/coming-soon";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";

export const metadata: Metadata = { title: "Leads · Karta Lead Tracker" };

export default function LeadsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeadsContent />
    </Suspense>
  );
}

async function LeadsContent() {
  const user = await requireUser();
  return (
    <PageContainer>
      <PageHeader title={getNavTitle("leads", user.role)} description={NAV_ITEMS.leads.description} />
      <ComingSoon
        navKey="leads"
        features={[
          "Sortable, paginated table",
          "Filters by stage, source, priority and owner",
          "Search by company or POC",
          "Stage badges and follow-up indicators",
        ]}
      />
    </PageContainer>
  );
}
