import { AlertCircleIcon, ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { LeaderboardTable, SourceTable } from "@/components/dashboard/leaderboard-table";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { PipelineValueChart } from "@/components/dashboard/pipeline-value-chart";
import { StatTile } from "@/components/dashboard/stat-tile";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TEAM_PERIODS, type TeamDashboard, type TeamPeriod } from "@/lib/dashboard/team-metrics";
import { formatINRShort } from "@/lib/utils";

/** Month-over-month change in plain text tokens with a direction icon (never color alone). */
function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  const Icon = now > before ? ArrowUpRightIcon : now < before ? ArrowDownRightIcon : MinusIcon;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3.5" aria-hidden />
      vs {before} in {label}
    </span>
  );
}

/** The admin's team overview: KPIs, conversion, trends, then period-scoped tables. */
export function AdminDashboard({ data, period }: { data: TeamDashboard; period: TeamPeriod }) {
  const { kpis } = data;
  const periodLabel = TEAM_PERIODS.find((p) => p.value === period)?.label.toLowerCase();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatTile
          label="Team pipeline"
          value={formatINRShort(kpis.openPipeline.value)}
          detail={`${kpis.openPipeline.count} active leads`}
          href="/leads?status=active"
        />
        <StatTile
          label={`Won in ${kpis.newLeads.monthLabel}`}
          value={formatINRShort(kpis.wonThisMonth.value)}
          detail={`${kpis.wonThisMonth.count} ${kpis.wonThisMonth.count === 1 ? "deal" : "deals"}`}
        />
        <StatTile
          label="Win rate · last 90 days"
          value={kpis.winRate90d.rate === null ? "—" : `${Math.round(kpis.winRate90d.rate * 100)}%`}
          detail={`${kpis.winRate90d.won} won · ${kpis.winRate90d.lost} lost`}
        />
        <StatTile
          label={`New leads in ${kpis.newLeads.monthLabel}`}
          value={kpis.newLeads.thisMonth}
          detail={<Delta now={kpis.newLeads.thisMonth} before={kpis.newLeads.lastMonth} label={kpis.newLeads.lastMonthLabel} />}
        />
        <StatTile
          label="Overdue follow-ups"
          value={kpis.overdueFollowUps}
          detail="Across all agents"
          tone={kpis.overdueFollowUps > 0 ? "alert" : "default"}
          icon={kpis.overdueFollowUps > 0 ? <AlertCircleIcon className="size-5" aria-label="Overdue" /> : undefined}
          href="/follow-ups"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversion funnel</CardTitle>
            <CardDescription>Leads that ever reached each stage, with step-to-step conversion. All time.</CardDescription>
          </CardHeader>
          <CardContent>
            <FunnelChart steps={data.funnel} />
            <p className="mt-2 text-xs text-muted-foreground">{data.lostTotal} leads were lost along the way.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Last 6 months</CardTitle>
            <CardDescription>New leads added vs deals won, team-wide.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={data.trend} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline value at month end</CardTitle>
          <CardDescription>Deal value of all active leads on the last day of each month.</CardDescription>
        </CardHeader>
        <CardContent>
          <PipelineValueChart data={data.trend} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Team performance</h2>
          <p className="text-sm text-muted-foreground">
            Won, lost and win rate: closed {periodLabel}. New: created {periodLabel}. Pipeline, overdue and stale: right
            now.
          </p>
        </div>
        <PeriodFilter value={period} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent leaderboard</CardTitle>
          <CardDescription>Ranked by won value. Stale = active with no contact in 14+ days.</CardDescription>
        </CardHeader>
        <CardContent>
          <LeaderboardTable rows={data.leaderboard} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Source performance</CardTitle>
          <CardDescription>Where leads come from and how they convert.</CardDescription>
        </CardHeader>
        <CardContent>
          <SourceTable rows={data.sources} />
        </CardContent>
      </Card>
    </div>
  );
}
