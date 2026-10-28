import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { LeadsTable } from "@/components/leads/leads-table";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { isAdmin } from "@/lib/auth/permissions";
import { getLeadRows, getOwnerOptions } from "@/lib/data/leads";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";

export const metadata: Metadata = { title: "Leads · Karta Lead Tracker" };

export default function LeadsPage() {
  return (
    <Suspense fallback={<PageSkeleton layout="table" />}>
      <LeadsContent />
    </Suspense>
  );
}

async function LeadsContent() {
  const user = await requireUser();
  const admin = isAdmin(user);
  const [rows, ownerOptions] = await Promise.all([getLeadRows(), admin ? getOwnerOptions() : Promise.resolve([])]);

  return (
    <PageContainer>
      <PageHeader title={getNavTitle("leads", user.role)} description={NAV_ITEMS.leads.description} />
      <LeadsTable rows={rows} ownerOptions={ownerOptions} showOwner={admin} />
    </PageContainer>
  );
}
