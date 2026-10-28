import { AlertCircleIcon, ArrowRightIcon, PartyPopperIcon } from "lucide-react";
import Link from "next/link";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { StatTile } from "@/components/dashboard/stat-tile";
import { TargetMeter } from "@/components/dashboard/target-meter";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { FollowUpRow } from "@/components/follow-ups/follow-up-row";
import { StageBadge } from "@/components/shared/stage-badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentDashboard as Data } from "@/lib/dashboard/agent-metrics";
import { formatDateTime, formatINRShort } from "@/lib/utils";

const ACTIVITY_VERB = { call: "Call", email: "Email", meeting: "Meeting", note: "Note", stage_change: "Stage" } as const;

/** The sales agent's home screen. Pure presentation over the computed dashboard DTO. */
export function AgentDashboard({ data }: { data: Data }) {
  const { kpis, target } = data;
  const due = kpis.followUpsDue;
  const winRate = kpis.winRate90d;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          label="Open pipeline"
          value={formatINRShort(kpis.openPipeline.value)}
          detail={`${kpis.openPipeline.count} active leads`}
          href="/leads?status=active"
        />
        <StatTile
          label={`Won in ${target.monthLabel}`}
          value={formatINRShort(kpis.wonThisMonth.value)}
          detail={`${kpis.wonThisMonth.count} ${kpis.wonThisMonth.count === 1 ? "deal" : "deals"}`}
        />
        <StatTile
          label="Win rate · last 90 days"
          value={winRate.rate === null ? "—" : `${Math.round(winRate.rate * 100)}%`}
          detail={winRate.rate === null ? "No closed deals yet" : `${winRate.won} won · ${winRate.lost} lost`}
        />
        <StatTile
          label="Follow-ups due"
          value={due.overdue + due.today}
          detail={`${due.overdue} overdue · ${due.today} today`}
          tone={due.overdue > 0 ? "alert" : "default"}
          icon={due.overdue > 0 ? <AlertCircleIcon className="size-5" aria-label="Overdue follow-ups" /> : undefined}
          href="/follow-ups"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Due now</CardTitle>
            <CardDescription>Overdue and today&apos;s follow-ups, most overdue first.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.dueNow.length === 0 ? (
              <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <PartyPopperIcon className="size-4" />
                You&apos;re all caught up.
              </p>
            ) : (
              <ul className="divide-y">
                {data.dueNow.map((item) => (
                  <FollowUpRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </CardContent>
          {data.dueNowTotal > data.dueNow.length && (
            <CardFooter>
              <Link href="/follow-ups" className="flex items-center gap-1 text-sm font-medium hover:underline">
                View all {data.dueNowTotal} due follow-ups
                <ArrowRightIcon className="size-4" />
              </Link>
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{target.monthLabel} target</CardTitle>
            <CardDescription>Your monthly goals.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <TargetMeter label="Won value" actual={target.wonValue.actual} target={target.wonValue.target} format={formatINRShort} />
            <TargetMeter label="New leads" actual={target.newLeads.actual} target={target.newLeads.target} format={String} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My pipeline</CardTitle>
            <CardDescription>Active leads by stage. Hover for value.</CardDescription>
          </CardHeader>
          <CardContent>
            <PipelineChart data={data.pipelineByStage} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Last 6 months</CardTitle>
            <CardDescription>New leads added vs deals won.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={data.trend} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Active leads with no contact in 14+ days.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.needsAttention.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every active lead has been contacted recently.</p>
            ) : (
              <ul className="divide-y">
                {data.needsAttention.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link href={`/leads/${l.id}`} className="truncate font-medium hover:underline">
                        {l.companyName}
                      </Link>
                      <StageBadge stage={l.stage} />
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {l.neverContacted ? "Never contacted · " : "No contact in "}
                      {l.daysSinceContact} days
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>The latest on your leads.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="font-medium text-muted-foreground">{ACTIVITY_VERB[a.type]} · </span>
                  <Link href={`/leads/${a.leadId}`} className="font-medium hover:underline">
                    {a.companyName}
                  </Link>
                  <p className="truncate text-muted-foreground">{a.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(a.date)}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
