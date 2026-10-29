import { KeyRoundIcon, UserPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { AddMemberDialog } from "@/components/team/add-member-dialog";
import { AgentCard } from "@/components/team/agent-card";
import { AllocateButton, AllocateProvider } from "@/components/team/allocate-dialog";
import { AllowedEmailsCard } from "@/components/team/allowed-emails-card";
import { MembersCard } from "@/components/team/members-card";
import { Card, CardContent } from "@/components/ui/card";
import { getTeamPageData } from "@/lib/data/leads";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";

export const metadata: Metadata = { title: "Team · Karta Lead Tracker" };

export default function TeamPage() {
  return (
    <Suspense fallback={<PageSkeleton layout="cards" />}>
      <TeamContent />
    </Suspense>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

async function TeamContent() {
  // Admin only: redirects other roles to /no-access.
  const data = await getTeamPageData();
  const agents = data.members.filter((m) => m.role === "sales_agent");
  const employees = data.members.filter((m) => m.role === "admin");
  const addAgent = (variant: "default" | "outline") => (
    <AddMemberDialog
      companyDomains={data.companyDomains}
      disabled={!data.canManageAccounts}
      defaultRole="sales_agent"
      label="Add sales agent"
      variant={variant}
    />
  );

  return (
    <AllocateProvider members={data.members.map(({ id, name, role }) => ({ id, name, role }))} leads={data.leads}>
      <PageContainer>
        <PageHeader
          title={getNavTitle("team")}
          description={NAV_ITEMS.team.description}
          actions={
            <>
              {addAgent("outline")}
              <AllocateButton />
            </>
          }
        />

        <SectionTitle
          title={`Sales agents (${agents.length})`}
          description="Partners who sell for Karta. They work the accounts you allocate to them and see others' accounts as company, contact and owner only."
        />
        {agents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <UserPlusIcon className="size-5 text-muted-foreground" aria-hidden="true" />
              </span>
              <div className="flex-1 text-sm">
                <p className="font-medium">No sales agents yet</p>
                <p className="text-muted-foreground">
                  Add them with their @{data.companyDomains[0] ?? "company"} address. You get a temporary password to share;
                  they choose their own the first time they sign in. Then allocate accounts to them.
                </p>
              </div>
              {addAgent("default")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((m) => (
              <AgentCard key={m.id} member={m} />
            ))}
          </div>
        )}

        <SectionTitle title={`Employees (${employees.length})`} description="In-house team with full access. Employees can bring and own accounts too." />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {employees.map((m) => (
            <AgentCard key={m.id} member={m} />
          ))}
        </div>

        <SectionTitle title="Access" description="Accounts, passwords and who may sign in." />
        <div className="grid gap-6 *:min-w-0 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <MembersCard
              people={data.people}
              viewerId={data.viewerId}
              canManageAccounts={data.canManageAccounts}
              actions={<AddMemberDialog companyDomains={data.companyDomains} disabled={!data.canManageAccounts} />}
            />
          </div>
          <AllowedEmailsCard companyDomains={data.companyDomains} allowedEmails={data.allowedEmails} />
        </div>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <KeyRoundIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Forgot a password? Use Reset password in the member&apos;s menu: they get a new temporary password and choose
          their own again at sign-in.
        </p>
      </PageContainer>
    </AllocateProvider>
  );
}
