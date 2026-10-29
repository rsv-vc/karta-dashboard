import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EventsCard, KpiGrid, TargetsCard, TeamOverdueCard, TodayCard } from "@/components/home/home-overview";
import { DiscoveryFunnel, ScoringGuide } from "@/components/home/home-sections";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { isAdmin } from "@/lib/auth/permissions";
import { TODAY } from "@/lib/constants";
import { getHomeData } from "@/lib/data/leads";
import { getNavTitle } from "@/lib/navigation";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Home · Karta Lead Tracker" };

// The home page for every role: headline numbers with month-on-month change,
// today's action points on your own accounts, targets, and recent wins. Agents
// see their own accounts; employees the whole team's (the deeper analysis is
// in the Investor view). The session read sits inside the page's Suspense.
export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton layout="dashboard" />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const [user, { home, overview, names, points }] = await Promise.all([requireUser(), getHomeData()]);
  const admin = isAdmin(user);
  const scope = admin ? "Whole team" : "Your accounts";
  return (
    <PageContainer>
      <PageHeader
        title={getNavTitle("dashboard", user.role)}
        description={`Welcome back, ${user.name.split(" ")[0]}. ${scope} as of ${formatDate(TODAY)}.`}
        actions={
          admin && (
            <Button asChild variant="outline">
              <Link href="/insights">
                Investor view
                <ArrowRightIcon />
              </Link>
            </Button>
          )
        }
      />
      <KpiGrid kpis={home.kpis} />
      <div className="grid gap-6 *:min-w-0 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TodayCard actions={home.actions} />
        </div>
        <div className="flex flex-col gap-6">
          {home.targets && <TargetsCard targets={home.targets} scope={admin ? "Everyone with accounts, added up" : "Yours"} />}
          {admin && <TeamOverdueCard rows={home.teamOverdue} names={names} />}
        </div>
      </div>
      <div className="grid gap-6 *:min-w-0 lg:grid-cols-2 xl:grid-cols-3">
        <EventsCard title="Recent wins" description="Closed in the last 60 days" events={home.wins} names={names} kind="win" />
        <EventsCard title="New accounts" description="Added in the last two weeks" events={home.newAccounts} names={names} kind="new" />
        <div className="lg:col-span-2 xl:col-span-1">
          <DiscoveryFunnel o={overview} />
        </div>
      </div>
      <ScoringGuide points={points} />
    </PageContainer>
  );
}
