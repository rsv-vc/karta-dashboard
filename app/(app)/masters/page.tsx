import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { CitiesCard, IndustriesCard, PricingCard, ReasonsCard, StagesCard } from "@/components/masters/master-cards";
import { MastersTabs } from "@/components/masters/masters-tabs";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { AddMemberDialog } from "@/components/team/add-member-dialog";
import { MembersCard } from "@/components/team/members-card";
import { getTeamPageData } from "@/lib/data/leads";
import { getMastersData } from "@/lib/data/masters";
import { MASTER_TABS, type MasterTab } from "@/lib/masters";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";

export const metadata: Metadata = { title: "Masters · Karta Lead Tracker" };

export default function MastersPage({ searchParams }: PageProps<"/masters">) {
  return (
    <Suspense fallback={<PageSkeleton layout="table" />}>
      <MastersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MastersContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Admin only: both loaders redirect other roles to /no-access.
  const [masters, team, params] = await Promise.all([getMastersData(), getTeamPageData(), searchParams]);
  const tab = MASTER_TABS.find((t) => t.value === params.tab)?.value ?? "team";
  const members = (role: "admin" | "sales_agent") => team.people.filter((p) => p.role === role);
  const add = (role: "admin" | "sales_agent") => (
    <AddMemberDialog companyDomains={team.companyDomains} disabled={!team.canManageAccounts} defaultRole={role} />
  );

  const panels: Record<MasterTab, React.ReactNode> = {
    team: (
      <MembersCard
        title="Team members"
        description="Employees: full access to every account, the Investor view and the masters."
        people={members("admin")}
        viewerId={team.viewerId}
        canManageAccounts={team.canManageAccounts}
        actions={add("admin")}
      />
    ),
    agents: (
      <MembersCard
        title="Sales agents"
        description="Outsourced partners: their own accounts in full; others' as company, contact and owner only."
        people={members("sales_agent")}
        viewerId={team.viewerId}
        canManageAccounts={team.canManageAccounts}
        actions={add("sales_agent")}
      />
    ),
    industries: <IndustriesCard industries={masters.industries} />,
    cities: <CitiesCard cities={masters.cities} />,
    pricing: <PricingCard pricing={masters.pricing} />,
    stages: <StagesCard stages={masters.stages} />,
    reasons: <ReasonsCard reasons={masters.reasons} />,
  };

  return (
    <PageContainer>
      <PageHeader title={getNavTitle("masters")} description={NAV_ITEMS.masters.description} />
      <MastersTabs initial={tab} panels={panels} />
    </PageContainer>
  );
}
