import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ReportSections } from "@/components/reports/report-sections";
import { ReportToolbar } from "@/components/reports/report-toolbar";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { TODAY } from "@/lib/constants";
import { getMonthlyReport } from "@/lib/data/leads";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";
import { previousMonth, reportMonths } from "@/lib/reports/monthly";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports · Karta Lead Tracker" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  );
}

/** Picks a valid month from the URL, falling back to the latest. */
function resolveMonths(params: Record<string, string | string[] | undefined>, months: string[]) {
  const raw = typeof params.month === "string" ? params.month : null;
  const month = raw && months.includes(raw) ? raw : months[0];
  const rawCompare = typeof params.compare === "string" ? params.compare : null;
  // "none" = no comparison; missing or unknown = the previous month when it has data.
  const fallback = months.includes(previousMonth(month)) ? previousMonth(month) : null;
  const compare = rawCompare === "none" ? null : rawCompare && months.includes(rawCompare) && rawCompare !== month ? rawCompare : fallback;
  return { month, compare };
}

async function ReportsContent({ searchParams }: { searchParams: SearchParams }) {
  const months = reportMonths(TODAY);
  const { month, compare } = resolveMonths(await searchParams, months);
  // Admin only: getMonthlyReport redirects other roles to /no-access.
  const report = await getMonthlyReport(month, compare);

  return (
    <PageContainer>
      {/* Shown only on paper: identifies the printout. */}
      <div className="hidden border-b pb-3 text-sm print:block">
        <p className="font-semibold">Karta Lead Tracker · Monthly report</p>
        <p>
          {report.monthLabel}
          {report.compareLabel && ` vs ${report.compareLabel}`} · generated {formatDate(TODAY)}
        </p>
      </div>
      <div className="print:hidden">
        <PageHeader title={getNavTitle("reports")} description={NAV_ITEMS.reports.description} />
      </div>
      <ReportToolbar months={months} month={month} compare={compare} />
      <ReportSections report={report} />
    </PageContainer>
  );
}
