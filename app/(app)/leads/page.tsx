import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { DirectoryTable } from "@/components/leads/directory-table";
import { LeadsTable } from "@/components/leads/leads-table";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { isAdmin } from "@/lib/auth/permissions";
import { getDirectoryRows, getLeadRows, getOwnerOptions } from "@/lib/data/leads";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";

export const metadata: Metadata = { title: "All leads · Karta Lead Tracker" };

export default function LeadsPage() {
  return (
    <Suspense fallback={<PageSkeleton layout="table" />}>
      <LeadsContent />
    </Suspense>
  );
}

// All leads: employees get every account in full; sales agents get the masked
// list (company, POC, owner), and their own accounts in full under My leads.
async function LeadsContent() {
  const user = await requireUser();
  const header = <PageHeader title={getNavTitle("leads")} description={NAV_ITEMS.leads.description} />;

  if (!isAdmin(user)) {
    const [rows, ownerOptions] = await Promise.all([getDirectoryRows(), getOwnerOptions()]);
    return (
      <PageContainer>
        {header}
        <DirectoryTable rows={rows} ownerOptions={ownerOptions} />
      </PageContainer>
    );
  }

  const [rows, ownerOptions] = await Promise.all([getLeadRows(), getOwnerOptions()]);
  return (
    <PageContainer>
      {header}
      <LeadsTable rows={rows} ownerOptions={ownerOptions} showOwner />
    </PageContainer>
  );
}
