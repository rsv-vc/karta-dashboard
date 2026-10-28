import Link from "next/link";
import { StatTile } from "@/components/dashboard/stat-tile";
import { BandBadge } from "@/components/leads/band-badge";
import { StageBadge } from "@/components/shared/stage-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MisOverview } from "@/lib/dashboard/mis";
import { BANDS, SCORE_CRITERIA, STAGE_POINTS } from "@/lib/scoring";
import { cn, formatDate, formatMonth } from "@/lib/utils";

// Read-only sections of the home page, one per block of the workbook's
// Pipeline Overview and Monthly Funnel tabs.

const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)}%`);
const one = (n: number | null) => (n === null ? "–" : n.toFixed(1).replace(/\.0$/, ""));
const NUM = "text-right tabular-nums";

export function HomeTiles({ o, scopeLabel }: { o: MisOverview; scopeLabel: string }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatTile label="Accounts tracked" value={o.tracked} detail={scopeLabel} href="/leads" />
      <StatTile label="Discoveries held" value={o.discoveriesHeld} detail={`${o.notMetYet} not met yet`} />
      <StatTile label="Active (Hot + Warm)" value={o.hotWarm} detail="Score 20 or more" href="/leads?band=hot,warm" />
      <StatTile label="Won (paid)" value={o.won} href="/leads?stage=won" />
      <StatTile label="Average score" value={one(o.avgScore)} detail="out of 40" />
    </div>
  );
}

/** Funnel from discovery: one series, so one colour; counts and shares are printed, not just drawn. */
export function DiscoveryFunnel({ o }: { o: MisOverview }) {
  const max = Math.max(1, ...o.funnel.map((s) => s.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funnel from discovery</CardTitle>
        <CardDescription>Current stage of each account. Accounts that later deferred or were lost count only as discovery held.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-3">
          {o.funnel.map((step) => (
            <li key={step.label} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate text-muted-foreground" title={step.label}>
                {step.label}
              </span>
              <span className="h-5 overflow-hidden rounded bg-muted" aria-hidden="true">
                <span
                  className="block h-full rounded bg-[var(--series-1)]"
                  style={{ width: `${(step.count / max) * 100}%` }}
                />
              </span>
              <span className="w-20 text-right tabular-nums">
                <span className="font-medium">{step.count}</span>
                <span className="text-muted-foreground"> · {pct(step.ofDiscoveries)}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">Percentages are of discoveries held.</p>
      </CardContent>
    </Card>
  );
}

export function BandsBySource({ o }: { o: MisOverview }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bands by lead source</CardTitle>
        <CardDescription>Score out of 40: stage points plus responsiveness, decision access and timing.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table scrollLabel="Bands by lead source">
          <TableHeader>
            <TableRow>
              <TableHead>Band</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="text-right">Accounts</TableHead>
              <TableHead className="text-right">Share</TableHead>
              {o.sources.map((s) => (
                <TableHead key={s.value} className="text-right">
                  {s.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {o.bands.map((b) => (
              <TableRow key={b.band}>
                <TableCell>
                  <BandBadge band={b.band} />
                </TableCell>
                <TableCell className="text-muted-foreground">{b.range}</TableCell>
                <TableCell className={NUM}>{b.total}</TableCell>
                <TableCell className={NUM}>{pct(b.share)}</TableCell>
                {o.sources.map((s) => (
                  <TableCell key={s.value} className={NUM}>
                    {b.bySource[s.value]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Total</TableCell>
              <TableCell className={NUM}>{o.tracked}</TableCell>
              <TableCell />
              {o.sources.map((s) => (
                <TableCell key={s.value} className={NUM}>
                  {o.bandTotalsBySource[s.value]}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

export function StagesAndSegments({ o }: { o: MisOverview }) {
  return (
    <div className="grid gap-6 *:min-w-0 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>By stage</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Accounts</TableHead>
                <TableHead className="text-right">Avg score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.stages.map((s) => (
                <TableRow key={s.stage} className={cn(s.count === 0 && "text-muted-foreground")}>
                  <TableCell>
                    {s.count > 0 ? (
                      <Link href={`/leads?stage=${s.stage}`} className="hover:underline">
                        <StageBadge stage={s.stage} />
                      </Link>
                    ) : (
                      s.label
                    )}
                  </TableCell>
                  <TableCell className={NUM}>{s.count}</TableCell>
                  <TableCell className={NUM}>{one(s.avgScore)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>By segment</CardTitle>
        </CardHeader>
        <CardContent>
          {o.segments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Segment</TableHead>
                  <TableHead className="text-right">Accounts</TableHead>
                  <TableHead className="text-right">Hot + Warm</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.segments.map((s) => (
                  <TableRow key={s.segment}>
                    <TableCell>
                      <Link href={`/leads?segment=${encodeURIComponent(s.segment)}`} className="hover:underline">
                        {s.segment}
                      </Link>
                    </TableCell>
                    <TableCell className={NUM}>{s.count}</TableCell>
                    <TableCell className={NUM}>{s.hotWarm}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function MonthlyFunnel({ o }: { o: MisOverview }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Month on month</CardTitle>
        <CardDescription>
          Each row is the accounts whose discovery was that month, and how far they have moved since.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {o.months.length === 0 ? (
          <p className="text-sm text-muted-foreground">No discovery months yet.</p>
        ) : (
          <Table scrollLabel="Month on month">
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                {o.sources.map((s) => (
                  <TableHead key={s.value} className="text-right">
                    {s.label}
                  </TableHead>
                ))}
                <TableHead className="text-right">Discoveries</TableHead>
                <TableHead className="text-right">No-shows</TableHead>
                <TableHead className="text-right">Show rate</TableHead>
                <TableHead className="text-right">Now follow-up+</TableHead>
                <TableHead className="text-right">Now bot / tech+</TableHead>
                <TableHead className="text-right">Now POC+</TableHead>
                <TableHead className="text-right">Bot / tech+ %</TableHead>
                <TableHead className="text-right">Deferred or lost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.months.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="whitespace-nowrap">{formatMonth(m.month)}</TableCell>
                  {o.sources.map((s) => (
                    <TableCell key={s.value} className={NUM}>
                      {m.discoveriesBySource[s.value]}
                    </TableCell>
                  ))}
                  <TableCell className={cn(NUM, "font-medium")}>{m.discoveries}</TableCell>
                  <TableCell className={NUM}>{m.noShows}</TableCell>
                  <TableCell className={NUM}>{pct(m.showRate)}</TableCell>
                  <TableCell className={NUM}>{m.followUpPlus}</TableCell>
                  <TableCell className={NUM}>{m.technicalPlus}</TableCell>
                  <TableCell className={NUM}>{m.pocPlus}</TableCell>
                  <TableCell className={NUM}>{pct(m.technicalShare)}</TableCell>
                  <TableCell className={NUM}>{m.deferredOrLost}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function NextSteps({ o }: { o: MisOverview }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Next steps with a date</CardTitle>
        <CardDescription>Soonest first. Overdue ones are marked.</CardDescription>
      </CardHeader>
      <CardContent>
        {o.nextSteps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No dated next steps.</p>
        ) : (
          <ul className="divide-y">
            {o.nextSteps.slice(0, 12).map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-2.5 text-sm">
                <span
                  className={cn(
                    "w-24 shrink-0 tabular-nums",
                    n.overdue ? "font-medium text-red-700 dark:text-red-400" : "text-muted-foreground",
                  )}
                >
                  {formatDate(n.date)}
                  {n.overdue && <span className="block text-xs">Overdue</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <Link href={`/leads/${n.id}`} className="font-medium hover:underline">
                    {n.companyName}
                  </Link>
                  <span className="block truncate text-muted-foreground">{n.nextStep || "No next step written"}</span>
                </span>
                <BandBadge band={n.band} />
              </li>
            ))}
          </ul>
        )}
        {o.nextSteps.length > 12 && (
          <Link href="/follow-ups" className="mt-2 inline-block text-sm font-medium underline-offset-4 hover:underline">
            All {o.nextSteps.length} dated next steps
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export function ScoringGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scoring guide</CardTitle>
        <CardDescription>Score out of 40 = stage points + responsiveness + decision access + timing / budget.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 *:min-w-0 lg:grid-cols-3">
        <div>
          <h3 className="mb-2 text-sm font-medium">Stage points</h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            {(Object.entries(STAGE_POINTS) as [keyof typeof STAGE_POINTS, number][]).map(([stage, points]) => (
              <div key={stage} className="contents">
                <dt>
                  <StageBadge stage={stage} />
                </dt>
                <dd className="text-right tabular-nums">{points}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">Criteria</h3>
          <dl className="flex flex-col gap-3 text-sm">
            {SCORE_CRITERIA.map((c) => (
              <div key={c.key}>
                <dt className="font-medium">
                  {c.label} <span className="font-normal text-muted-foreground">(0–{c.max})</span>
                </dt>
                <dd className="text-muted-foreground">{c.guide}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">Bands and playbook</h3>
          <dl className="flex flex-col gap-3 text-sm">
            {BANDS.map((b) => (
              <div key={b.value}>
                <dt className="flex items-center gap-2">
                  <BandBadge band={b.value} />
                  <span className="text-muted-foreground">
                    {b.min}+ · {b.status}
                  </span>
                </dt>
                <dd className="mt-1 text-muted-foreground">{b.playbook}</dd>
              </div>
            ))}
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}
