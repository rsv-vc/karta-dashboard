import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { LeadsTable } from "@/components/leads/leads-table";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { getOwnLeadRows } from "@/lib/data/leads";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";

export const metadata: Metadata = { title: "My leads · Karta Lead Tracker" };

export default function MyLeadsPage() {
  return (
    <Suspense fallback={<PageSkeleton layout="table" />}>
      <MyLeadsContent />
    </Suspense>
  );
}

async function MyLeadsContent() {
  const rows = await getOwnLeadRows();
  return (
    <PageContainer>
      <PageHeader title={getNavTitle("myLeads")} description={NAV_ITEMS.myLeads.description} />
      <LeadsTable rows={rows} ownerOptions={[]} showOwner={false} />
    </PageContainer>
  );
}
