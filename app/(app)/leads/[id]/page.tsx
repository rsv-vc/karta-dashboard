import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { LockIcon } from "lucide-react";
import { UserAvatar } from "@/components/auth/user-avatar";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { FollowUpLabel } from "@/components/leads/follow-up-label";
import { PriorityBadge } from "@/components/leads/priority-badge";
import { ComingSoon } from "@/components/shared/coming-soon";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { StageBadge } from "@/components/shared/stage-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserById } from "@/data/mock-users";
import { COMPANY_SIZE_LABELS, SOURCE_LABELS } from "@/lib/constants";
import { getLeadForViewer } from "@/lib/data/leads";
import { formatDate, formatINR } from "@/lib/utils";
import type { Lead, LeadDirectoryEntry } from "@/types/lead";

export const metadata: Metadata = { title: "Lead · Karta Lead Tracker" };

// Read-only lead view. Permission is decided per lead on the server: owners and
// admins get the full record, other agents only the masked directory entry.
// Phase 5 adds editing, the activity timeline and stage changes.
export default function LeadPage({ params }: PageProps<"/leads/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeadContent params={params} />
    </Suspense>
  );
}

async function LeadContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const visible = await getLeadForViewer(id);
  if (!visible) notFound();
  return visible.kind === "full" ? <FullLead lead={visible.lead} /> : <MaskedLead entry={visible.entry} />;
}

function ownerName(id: string): string {
  return getUserById(id)?.name ?? "Unknown";
}

function MaskedLead({ entry }: { entry: LeadDirectoryEntry }) {
  const owner = ownerName(entry.ownerId);
  return (
    <PageContainer>
      <PageHeader title={entry.companyName} actions={<StageBadge stage={entry.stage} />} />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="POC">{entry.pocName}</Detail>
            <Detail label="Owner">
              <span className="flex items-center gap-2">
                <UserAvatar name={owner} className="size-6" />
                {owner}
              </span>
            </Detail>
          </dl>
          <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <LockIcon className="mt-0.5 size-4 shrink-0" />
            This lead belongs to {owner}. Contact details and deal information are only visible to them.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function FullLead({ lead }: { lead: Lead }) {
  const owner = ownerName(lead.ownerId);
  return (
    <PageContainer>
      <PageHeader
        title={lead.companyName}
        description={`${lead.industry} · ${lead.city}`}
        actions={
          <>
            <PriorityBadge priority={lead.priority} />
            <StageBadge stage={lead.stage} />
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <Detail label="POC">
              {lead.pocName}
              <span className="block text-xs text-muted-foreground">{lead.pocDesignation}</span>
            </Detail>
            <Detail label="Deal value">
              <span className="tabular-nums">{formatINR(lead.dealValue)}</span>
            </Detail>
            <Detail label="Email">
              <a href={`mailto:${lead.pocEmail}`} className="break-all hover:underline">
                {lead.pocEmail}
              </a>
            </Detail>
            <Detail label="Phone">
              <a href={`tel:${lead.pocPhone.replace(/\s/g, "")}`} className="hover:underline">
                {lead.pocPhone}
              </a>
            </Detail>
            <Detail label="LinkedIn">
              {lead.pocLinkedIn ? (
                <a href={lead.pocLinkedIn} target="_blank" rel="noreferrer" className="break-all hover:underline">
                  View profile
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Detail>
            <Detail label="Owner">{owner}</Detail>
            <Detail label="Source">{SOURCE_LABELS[lead.source]}</Detail>
            <Detail label="Company size">{COMPANY_SIZE_LABELS[lead.companySize]}</Detail>
            <Detail label="Created">{formatDate(lead.createdAt)}</Detail>
            <Detail label="Last contact">{lead.lastContactedAt ? formatDate(lead.lastContactedAt) : "Never"}</Detail>
            <Detail label="Next follow-up">
              <FollowUpLabel date={lead.nextFollowUpAt} />
            </Detail>
            {lead.closedAt && <Detail label="Closed">{formatDate(lead.closedAt)}</Detail>}
          </dl>
        </CardContent>
      </Card>
      <ComingSoon
        navKey="newLead"
        phase={5}
        description="Next up for this page:"
        features={["Activity timeline", "Edit details", "Change stage", "Log a call, email or meeting"]}
      />
    </PageContainer>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
