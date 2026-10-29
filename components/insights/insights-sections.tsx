import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BreakdownRow, FunnelInsight, Insights, ReasonCount } from "@/lib/dashboard/insights";
import { cn, formatINRShort, formatMonth, formatNumber } from "@/lib/utils";

// The Investor view's sections. One series per chart, so one colour; every bar
// also prints its number, so nothing is read from colour or length alone.

const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)}%`);
const NUM = "text-right tabular-nums";

export function SectionHeading({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div id={id} className="scroll-mt-20 pt-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function RevenueTiles({ t }: { t: Insights["totals"] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      <StatTile label="Open pipeline" value={formatINRShort(t.openValue)} detail={`${t.openAccounts} open accounts`} href="/leads?status=active" />
      <StatTile label="Open volume" value={formatNumber(t.openVolume)} detail="Minutes a month" />
      <StatTile label="Won revenue" value={formatINRShort(t.wonValue)} detail={`${t.wonCount} customers`} href="/leads?stage=won" />
      <StatTile label="Won, last 90 days" value={formatINRShort(t.wonLast90)} />
      <StatTile label="Win rate" value={pct(t.winRate)} detail="Won ÷ (won + lost)" />
      <StatTile
        label="Average deal won"
        value={t.avgWon === null ? "–" : formatINRShort(t.avgWon)}
        detail={t.medianDaysToWin === null ? "Days to win not known yet" : `Median ${Math.round(t.medianDaysToWin)} days from discovery`}
      />
    </div>
  );
}

/** Won value by close month: a single-series column chart with the values printed. */
export function RevenueByMonth({ rows }: { rows: Insights["revenueByMonth"] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((n, r) => n + r.value, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue won by month</CardTitle>
        <CardDescription>Deal value of accounts closed as Won, last 12 months ({formatINRShort(total)} in total).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-48 items-end gap-1.5" aria-hidden="true">
          {rows.map((r) => (
            <div key={r.month} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${formatMonth(r.month)}: ${formatINRShort(r.value)} (${r.count} won)`}>
              {r.value > 0 && <span className="mb-1 truncate text-center text-[10px] text-muted-foreground tabular-nums">{formatINRShort(r.value)}</span>}
              <div className="rounded-t bg-[var(--series-1)] group-hover:opacity-80" style={{ height: `${(r.value / max) * 85}%`, minHeight: r.value > 0 ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1.5 border-t pt-1" aria-hidden="true">
          {rows.map((r) => (
            <span key={r.month} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground">
              {formatMonth(r.month).split(" ")[0]}
            </span>
          ))}
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Show as a table</summary>
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Won</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.month}>
                  <TableCell>{formatMonth(r.month)}</TableCell>
                  <TableCell className={NUM}>{r.count}</TableCell>
                  <TableCell className={NUM}>{formatINRShort(r.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </details>
      </CardContent>
    </Card>
  );
}

export function BreakdownTable({ title, description, rows, label }: { title: string; description: string; rows: BreakdownRow[]; label: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table scrollLabel={title}>
          <TableHeader>
            <TableRow>
              <TableHead>{label}</TableHead>
              <TableHead className="text-right">Open</TableHead>
              <TableHead className="text-right">Open value</TableHead>
              <TableHead className="text-right">Open min / month</TableHead>
              <TableHead className="text-right">Won</TableHead>
              <TableHead className="text-right">Won value</TableHead>
              <TableHead className="text-right">Lost</TableHead>
              <TableHead className="text-right">Win rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium whitespace-nowrap">{r.label}</TableCell>
                <TableCell className={NUM}>{r.open}</TableCell>
                <TableCell className={NUM}>{formatINRShort(r.openValue)}</TableCell>
                <TableCell className={NUM}>{formatNumber(r.openVolume)}</TableCell>
                <TableCell className={NUM}>{r.won}</TableCell>
                <TableCell className={NUM}>{formatINRShort(r.wonValue)}</TableCell>
                <TableCell className={NUM}>{r.lost}</TableCell>
                <TableCell className={NUM}>{pct(r.winRate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Horizontal bars of counts by reason, the count and value printed beside each bar. */
export function ReasonBars({ reasons, empty }: { reasons: ReasonCount[]; empty: string }) {
  if (reasons.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(1, ...reasons.map((r) => r.count));
  return (
    <ul className="flex flex-col gap-2">
      {reasons.map((r) => (
        <li key={r.reasonId ?? "none"} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3 text-sm">
          <span className={cn("truncate", r.reasonId === null && "text-muted-foreground italic")} title={r.label}>
            {r.label}
          </span>
          <span className="h-3 overflow-hidden rounded-sm bg-muted" aria-hidden="true">
            <span className="block h-full rounded-sm bg-[var(--series-1)]" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="w-24 text-right tabular-nums">
            <span className="font-medium">{r.count}</span>
            {r.value > 0 && <span className="text-muted-foreground"> · {formatINRShort(r.value)}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Trend({ recent, earlier, lag }: { recent: number | null; earlier: number | null; lag: number }) {
  if (recent === null || earlier === null) return <span className="text-muted-foreground">Not enough history to compare yet</span>;
  const diff = Math.round((recent - earlier) * 100);
  const Icon = diff > 0 ? ArrowUpRightIcon : diff < 0 ? ArrowDownRightIcon : MinusIcon;
  return (
    <span className={cn("inline-flex items-center gap-1", diff > 0 ? "text-green-700 dark:text-green-400" : diff < 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
      <Icon className="size-3.5" aria-hidden="true" />
      {diff === 0 ? "Flat" : `${diff > 0 ? "+" : "−"}${Math.abs(diff)} pts`}: {pct(recent)} for the latest 90 days vs {pct(earlier)} before (allowing {lag} days to move on)
    </span>
  );
}

/** One funnel's root-cause card: conversion, the trend, how long it takes, and why accounts drop out here. */
export function FunnelCard({ f, openFixes }: { f: FunnelInsight; openFixes: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Funnel {f.id}</CardDescription>
        <CardTitle>{f.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-semibold tabular-nums">{pct(f.rate)}</span>
          <span className="text-sm text-muted-foreground">
            {f.converted} of {f.entered} moved on
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Typical time</dt>
            <dd className="font-medium">{f.medianDays === null ? "Not known yet" : `${Math.round(f.medianDays)} days (median)`}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">In this step now</dt>
            <dd className="font-medium">
              {f.inProgress}
              {f.stuck > 0 && <span className="font-normal text-red-700 dark:text-red-400"> · {f.stuck} quiet 30+ days</span>}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Dropped here</dt>
            <dd className="font-medium">
              {f.lost} lost · {f.deferred} deferred
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fixes in progress</dt>
            <dd className="font-medium">{openFixes}</dd>
          </div>
        </dl>
        <p className="text-sm">
          <span className="text-muted-foreground">Trend: </span>
          <Trend recent={f.recentRate} earlier={f.earlierRate} lag={f.lagDays} />
        </p>
        <div>
          <h3 className="mb-2 text-sm font-medium">Why accounts drop out here</h3>
          <ReasonBars reasons={f.reasons} empty="No drop-offs at this step." />
        </div>
      </CardContent>
    </Card>
  );
}

export function DeadLeads({ insights }: { insights: Insights }) {
  const maxStage = Math.max(1, ...insights.lostAtStage.map((s) => s.count));
  return (
    <div className="grid gap-6 *:min-w-0 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Dead leads: why we lost</CardTitle>
          <CardDescription>Every account marked Lost, by reason, with the deal value lost.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReasonBars reasons={insights.lostReasons} empty="No lost accounts." />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Deferred: why it is later</CardTitle>
          <CardDescription>Accounts parked for now, by reason. These are the ones to revisit.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReasonBars reasons={insights.deferredReasons} empty="No deferred accounts." />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Where lost accounts got to</CardTitle>
          <CardDescription>The furthest stage each lost account reached.</CardDescription>
        </CardHeader>
        <CardContent>
          {insights.lostAtStage.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lost accounts.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {insights.lostAtStage.map((s) => (
                <li key={s.stage} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate">{s.label}</span>
                  <span className="h-3 overflow-hidden rounded-sm bg-muted" aria-hidden="true">
                    <span className="block h-full rounded-sm bg-[var(--series-1)]" style={{ width: `${(s.count / maxStage) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right font-medium tabular-nums">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CohortTable({ rows }: { rows: Insights["cohorts"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cohorts by discovery month</CardTitle>
        <CardDescription>
          Of the accounts first met each month, the share that has since reached each step. Newer cohorts have had less time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No discoveries yet.</p>
        ) : (
          <Table scrollLabel="Cohorts by discovery month">
            <TableHeader>
              <TableRow>
                <TableHead>Discovery month</TableHead>
                <TableHead className="text-right">Discoveries</TableHead>
                <TableHead className="text-right">Follow-up+</TableHead>
                <TableHead className="text-right">Bot / tech+</TableHead>
                <TableHead className="text-right">POC+</TableHead>
                <TableHead className="text-right">Won</TableHead>
                <TableHead className="text-right">Deferred / lost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.month}>
                  <TableCell className="whitespace-nowrap">{formatMonth(r.month)}</TableCell>
                  <TableCell className={cn(NUM, "font-medium")}>{r.discoveries}</TableCell>
                  <TableCell className={NUM}>{pct(r.followUp)}</TableCell>
                  <TableCell className={NUM}>{pct(r.technical)}</TableCell>
                  <TableCell className={NUM}>{pct(r.poc)}</TableCell>
                  <TableCell className={NUM}>{pct(r.won)}</TableCell>
                  <TableCell className={NUM}>{pct(r.dropped)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
