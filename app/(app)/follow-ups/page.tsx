import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/shared/coming-soon";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { getFollowUpCounts } from "@/lib/data/leads";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";

export const metadata: Metadata = { title: "Follow-ups · Karta Lead Tracker" };

export default function FollowUpsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FollowUpsContent />
    </Suspense>
  );
}

async function FollowUpsContent() {
  const counts = await getFollowUpCounts();
  const stats = [
    { label: "Overdue", value: counts.overdue, className: "text-red-600 dark:text-red-400" },
    { label: "Due today", value: counts.today, className: "text-amber-600 dark:text-amber-400" },
    { label: "Upcoming", value: counts.upcoming, className: "" },
  ];

  return (
    <PageContainer>
      <PageHeader title={getNavTitle("followUps")} description={NAV_ITEMS.followUps.description} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent>
              <div className={`text-3xl font-semibold tabular-nums ${s.className}`}>{s.value}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ComingSoon
        navKey="followUps"
        features={["Grouped list: overdue, today, upcoming", "Log a call or email in one click", "Reschedule or snooze"]}
      />
    </PageContainer>
  );
}
