import type { Metadata } from "next";
import { CalendarCheckIcon } from "lucide-react";
import { Suspense } from "react";
import { StatTile } from "@/components/dashboard/stat-tile";
import { FollowUpRow } from "@/components/follow-ups/follow-up-row";
import { OwnerFilter } from "@/components/follow-ups/owner-filter";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { isAdmin } from "@/lib/auth/permissions";
import { FOLLOW_UP_SECTIONS } from "@/lib/dashboard/follow-ups";
import { getFollowUpBoard, getOwnerOptions } from "@/lib/data/leads";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Follow-ups · Karta Lead Tracker" };

const EMPTY_TEXT = {
  overdue: "Nothing overdue. Nice work.",
  today: "Nothing due today.",
  thisWeek: "Nothing scheduled for the next 7 days.",
  later: "Nothing scheduled further out.",
} as const;

export default function FollowUpsPage({ searchParams }: PageProps<"/follow-ups">) {
  return (
    <Suspense fallback={<PageSkeleton layout="table" />}>
      <FollowUpsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function FollowUpsContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const admin = isAdmin(user);
  const owners = admin ? await getOwnerOptions() : [];
  // Only an admin's ?owner= counts, and only for a known agent.
  const rawOwner = typeof params.owner === "string" ? params.owner : null;
  const ownerId = admin && owners.some((o) => o.id === rawOwner) ? rawOwner : null;
  const board = await getFollowUpBoard(ownerId ?? undefined);
  const total = FOLLOW_UP_SECTIONS.reduce((n, s) => n + board[s.key].length, 0);

  return (
    <PageContainer>
      <PageHeader
        title={getNavTitle("followUps")}
        description={admin ? "Every agent's scheduled follow-ups." : NAV_ITEMS.followUps.description}
        actions={admin ? <OwnerFilter value={ownerId} options={owners} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {FOLLOW_UP_SECTIONS.map((s) => (
          <StatTile
            key={s.key}
            label={s.label}
            value={board[s.key].length}
            href={`#${s.key}`}
            tone={s.key === "overdue" && board.overdue.length > 0 ? "alert" : "default"}
          />
        ))}
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center">
          <CalendarCheckIcon className="size-8 text-muted-foreground" />
          <p className="font-medium">No follow-ups scheduled</p>
          <p className="text-sm text-muted-foreground">Set one from any lead page.</p>
        </div>
      ) : (
        FOLLOW_UP_SECTIONS.map((s) => (
          <Card key={s.key} id={s.key} className="scroll-mt-20">
            <CardHeader>
              <CardTitle className={cn(s.key === "overdue" && board.overdue.length > 0 && "text-red-600 dark:text-red-400")}>
                {s.label} <span className="font-normal text-muted-foreground">· {board[s.key].length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {board[s.key].length === 0 ? (
                <p className="text-sm text-muted-foreground">{EMPTY_TEXT[s.key]}</p>
              ) : (
                <ul className="divide-y">
                  {board[s.key].map((item) => (
                    <FollowUpRow key={item.id} item={item} showOwner={admin} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </PageContainer>
  );
}
