import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { LockIcon, PencilIcon } from "lucide-react";
import { UserAvatar } from "@/components/auth/user-avatar";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { ChangeStageDialog } from "@/components/leads/change-stage-dialog";
import { DeleteLeadButton } from "@/components/leads/delete-lead-button";
import { FollowUpEditor } from "@/components/leads/follow-up-editor";
import { LogActivityDialog } from "@/components/leads/log-activity-dialog";
import { PriorityBadge } from "@/components/leads/priority-badge";
import { StageHistory } from "@/components/leads/stage-history";
import { StageStepper } from "@/components/leads/stage-stepper";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { StageBadge } from "@/components/shared/stage-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { canDeleteLead } from "@/lib/auth/permissions";
import { COMPANY_SIZE_LABELS, SOURCE_LABELS, isActiveStage } from "@/lib/constants";
import { getLeadForViewer } from "@/lib/data/leads";
import { fetchTeam } from "@/lib/data/repo";
import { toDateKey } from "@/lib/dates";
import { allowedNextStages } from "@/lib/leads/mutations";
import { nameLookup, type NameOf } from "@/lib/team";
import { formatDate, formatINR } from "@/lib/utils";
import type { Lead, LeadDirectoryEntry } from "@/types/lead";

export const metadata: Metadata = { title: "Lead · Karta Lead Tracker" };

// Lead page. Permission is decided per lead on the server: owners and admins get
// the full record with actions, other agents only the masked directory entry.
export default function LeadPage({ params }: PageProps<"/leads/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeadContent params={params} />
    </Suspense>
  );
}

async function LeadContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, visible, team] = await Promise.all([requireUser(), getLeadForViewer(id), fetchTeam()]);
  if (!visible) notFound();
  const nameOf = nameLookup(team);
  return visible.kind === "full" ? (
    <FullLead lead={visible.lead} canDelete={canDeleteLead(user)} nameOf={nameOf} />
  ) : (
    <MaskedLead entry={visible.entry} nameOf={nameOf} />
  );
}

function MaskedLead({ entry, nameOf }: { entry: LeadDirectoryEntry; nameOf: NameOf }) {
  const owner = nameOf(entry.ownerId);
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

function FullLead({ lead, canDelete, nameOf }: { lead: Lead; canDelete: boolean; nameOf: NameOf }) {
  const owner = nameOf(lead.ownerId);
  const allowed = allowedNextStages(lead.stage);
  const active = isActiveStage(lead.stage);

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

      <div className="flex flex-wrap items-center gap-2">
        {/* Keyed by stage so the dialog resets its choice after each move. */}
        {allowed.length > 0 && (
          <ChangeStageDialog key={lead.stage} leadId={lead.id} current={lead.stage} allowed={allowed} dealValue={lead.dealValue} />
        )}
        {active && <LogActivityDialog leadId={lead.id} createdDay={toDateKey(lead.createdAt)} />}
        <Button asChild variant="outline">
          <Link href={`/leads/${lead.id}/edit`}>
            <PencilIcon />
            Edit
          </Link>
        </Button>
        {canDelete && <DeleteLeadButton leadId={lead.id} companyName={lead.companyName} />}
        {!active && lead.closedAt && (
          <span className="text-sm text-muted-foreground">Closed {formatDate(lead.closedAt)}</span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <StageStepper history={lead.stageHistory} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline activities={lead.activities} nameOf={nameOf} />
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {active && (
            <Card>
              <CardHeader>
                <CardTitle>Next follow-up</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Keyed by the stored value so it resets when another action changes it. */}
                <FollowUpEditor key={lead.nextFollowUpAt ?? "none"} leadId={lead.id} current={lead.nextFollowUpAt} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4">
                <Detail label="POC">
                  {lead.pocName}
                  <span className="block text-xs text-muted-foreground">{lead.pocDesignation}</span>
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
                {lead.pocLinkedIn && (
                  <Detail label="LinkedIn">
                    <a href={lead.pocLinkedIn} target="_blank" rel="noreferrer" className="hover:underline">
                      View profile
                    </a>
                  </Detail>
                )}
                <Detail label="Deal value">
                  <span className="tabular-nums">{formatINR(lead.dealValue)}</span>
                </Detail>
                <Detail label="Owner">{owner}</Detail>
                <Detail label="Source">{SOURCE_LABELS[lead.source]}</Detail>
                <Detail label="Company size">{COMPANY_SIZE_LABELS[lead.companySize]}</Detail>
                <Detail label="Created">{formatDate(lead.createdAt)}</Detail>
                <Detail label="Last contact">{lead.lastContactedAt ? formatDate(lead.lastContactedAt) : "Never"}</Detail>
              </dl>
            </CardContent>
          </Card>
          {lead.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{lead.notes}</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Stage history</CardTitle>
            </CardHeader>
            <CardContent>
              <StageHistory history={lead.stageHistory} />
            </CardContent>
          </Card>
        </div>
      </div>
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
