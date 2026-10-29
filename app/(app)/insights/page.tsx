import type { Metadata } from "next";
import { Suspense } from "react";
import { FunnelHealth } from "@/components/home/funnel-health";
import { BandsBySource, MonthlyFunnel, StagesAndSegments } from "@/components/home/home-sections";
import {
  BreakdownTable,
  CohortTable,
  DeadLeads,
  FunnelCard,
  RevenueByMonth,
  RevenueTiles,
  SectionHeading,
} from "@/components/insights/insights-sections";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { stageLabelsOf } from "@/lib/config";
import { TODAY } from "@/lib/constants";
import { computeInsights } from "@/lib/dashboard/insights";
import { getInsightsData } from "@/lib/data/leads";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Investor view · Karta Lead Tracker" };

const SECTIONS = [
  { id: "revenue", label: "Pipeline & revenue" },
  { id: "funnels", label: "Funnels & drop-offs" },
  { id: "cohorts", label: "Cohort trends" },
  { id: "mix", label: "Pipeline mix" },
];

// Employees only: the whole team's numbers, with the root causes behind each funnel.
export default function InsightsPage() {
  return (
    <Suspense fallback={<PageSkeleton layout="dashboard" />}>
      <InsightsContent />
    </Suspense>
  );
}

async function InsightsContent() {
  // Admin only: redirects other roles to /no-access.
  const { leads, config, overview, actions } = await getInsightsData();
  const insights = computeInsights(leads, { today: TODAY, reasons: config.dropReasons, labels: stageLabelsOf(config) });
  const openFixes = (funnel: number) => actions.filter((a) => a.funnel === funnel && a.status !== "done").length;

  return (
    <PageContainer>
      <PageHeader title={getNavTitle("insights")} description={`${NAV_ITEMS.insights.description} Every account, as of ${formatDate(TODAY)}.`} />
      <nav aria-label="Sections" className="-mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {s.label}
          </a>
        ))}
      </nav>

      <SectionHeading id="revenue" title="Pipeline & revenue" description="What is open, what has closed, and where the value sits." />
      <RevenueTiles t={insights.totals} />
      <RevenueByMonth rows={insights.revenueByMonth} />
      <div className="grid gap-6 *:min-w-0 2xl:grid-cols-2">
        <BreakdownTable title="By segment" description="Open pipeline and wins per industry." rows={insights.bySegment} label="Segment" />
        <BreakdownTable title="By source" description="Which channels bring the value." rows={insights.bySource} label="Source" />
      </div>

      <SectionHeading
        id="funnels"
        title="Funnels & drop-offs"
        description="Each step from discovery to paid: how many move on, how long it takes, whether it is improving, and why accounts drop out."
      />
      <div className="grid gap-6 *:min-w-0 xl:grid-cols-3">
        {insights.funnels.map((f) => (
          <FunnelCard key={f.id} f={f} openFixes={openFixes(f.id)} />
        ))}
      </div>
      <DeadLeads insights={insights} />
      <FunnelHealth actions={actions} canEdit />

      <SectionHeading id="cohorts" title="Cohort trends" description="Accounts grouped by the month of their first meeting." />
      <CohortTable rows={insights.cohorts} />
      <MonthlyFunnel o={overview} />

      <SectionHeading id="mix" title="Pipeline mix" description="Scores, stages and segments across every account." />
      <BandsBySource o={overview} />
      <StagesAndSegments o={overview} />
    </PageContainer>
  );
}
