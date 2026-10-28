import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { LeadForm } from "@/components/leads/lead-form";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { isAdmin } from "@/lib/auth/permissions";
import { getOwnerOptions } from "@/lib/data/leads";
import { emptyLeadForm } from "@/lib/leads/form-defaults";
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
  const user = await requireUser();
  // Agents own what they create; only admins choose an owner.
  const ownerOptions = isAdmin(user)
    ? (await getOwnerOptions()).map((o) => ({ value: o.id, label: o.name }))
    : undefined;

  return (
    <PageContainer>
      <PageHeader title={getNavTitle("newLead")} description={NAV_ITEMS.newLead.description} />
      <div className="max-w-3xl">
        <LeadForm mode="create" defaultValues={emptyLeadForm()} ownerOptions={ownerOptions} cancelHref="/leads" />
      </div>
    </PageContainer>
  );
}
