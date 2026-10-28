import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { LeadForm } from "@/components/leads/lead-form";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { canReassignLead } from "@/lib/auth/permissions";
import { getLeadForEdit, getOwnerOptions } from "@/lib/data/leads";
import { leadToForm } from "@/lib/leads/form-defaults";

export const metadata: Metadata = { title: "Edit lead · Karta Lead Tracker" };

export default function EditLeadPage({ params }: PageProps<"/leads/[id]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditLeadContent params={params} />
    </Suspense>
  );
}

async function EditLeadContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  // Redirects to /no-access when the viewer may not edit this lead.
  const lead = await getLeadForEdit(id);
  if (!lead) notFound();
  const ownerOptions = canReassignLead(user)
    ? (await getOwnerOptions()).map((o) => ({ value: o.id, label: o.name }))
    : undefined;

  return (
    <PageContainer>
      <PageHeader title={`Edit ${lead.companyName}`} description="Changes are saved to this lead and visible to admins." />
      <div className="max-w-3xl">
        <LeadForm
          mode="edit"
          leadId={lead.id}
          defaultValues={leadToForm(lead)}
          ownerOptions={ownerOptions}
          cancelHref={`/leads/${lead.id}`}
        />
      </div>
    </PageContainer>
  );
}
