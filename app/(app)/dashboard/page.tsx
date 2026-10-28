import type { Metadata } from "next";
import { Suspense } from "react";
import { FunnelHealth } from "@/components/home/funnel-health";
import {
  BandsBySource,
  DiscoveryFunnel,
  HomeTiles,
  MonthlyFunnel,
  NextSteps,
  ScoringGuide,
  StagesAndSegments,
} from "@/components/home/home-sections";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { isAdmin } from "@/lib/auth/permissions";
import { TODAY } from "@/lib/constants";
import { getHomeData } from "@/lib/data/leads";
import { getNavTitle } from "@/lib/navigation";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Home · Karta Lead Tracker" };

// The home page for every role, built from the sales MIS workbook's overview
// tabs. Agents see their own accounts; admins see the whole team's. The session
// read sits inside the page's own Suspense boundary.
export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton layout="dashboard" />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const [user, { overview, actions, canEdit }] = await Promise.all([requireUser(), getHomeData()]);
  const scope = isAdmin(user) ? "Whole team" : "Your accounts";
  return (
    <PageContainer>
      <PageHeader
        title={getNavTitle("dashboard", user.role)}
        description={`Welcome back, ${user.name.split(" ")[0]}. ${scope} as of ${formatDate(TODAY)}.`}
      />
      <HomeTiles o={overview} scopeLabel={scope} />
      <div className="grid gap-6 *:min-w-0 xl:grid-cols-2">
        <DiscoveryFunnel o={overview} />
        <NextSteps o={overview} />
      </div>
      <BandsBySource o={overview} />
      <MonthlyFunnel o={overview} />
      <StagesAndSegments o={overview} />
      <FunnelHealth actions={actions} canEdit={canEdit} />
      <ScoringGuide />
    </PageContainer>
  );
}
