import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/shared/coming-soon";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";

export const metadata: Metadata = { title: "Add lead · Karta Lead Tracker" };

export default function NewLeadPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewLeadContent />
    </Suspense>
  );
}

async function NewLeadContent() {
  await requireUser();
  return (
    <PageContainer>
      <PageHeader title={getNavTitle("newLead")} description={NAV_ITEMS.newLead.description} />
      <ComingSoon
        navKey="newLead"
        features={[
          "Company, POC and deal details with validation",
          "Live warning when the company is already in the pipeline",
          "Owner set to you (admins can assign any agent)",
        ]}
      />
    </PageContainer>
  );
}
