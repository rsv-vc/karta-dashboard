import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/shared/coming-soon";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireRole } from "@/lib/auth/dal";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";

export const metadata: Metadata = { title: "Reports · Karta Lead Tracker" };

export default function ReportsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportsContent />
    </Suspense>
  );
}

async function ReportsContent() {
  await requireRole("admin");
  return (
    <PageContainer>
      <PageHeader title={getNavTitle("reports")} description={NAV_ITEMS.reports.description} />
      <ComingSoon
        navKey="reports"
        features={["Monthly report: new, qualified, won, lost", "Compare date ranges", "CSV export", "Print-friendly view"]}
      />
    </PageContainer>
  );
}
