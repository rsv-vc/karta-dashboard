import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon, CheckCircle2Icon, MinusIcon, PartyPopperIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { TargetMeter } from "@/components/dashboard/target-meter";
import { BandBadge } from "@/components/leads/band-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionList, HomeData, HomeEvent, Kpi } from "@/lib/dashboard/home";
import { cn, formatDate, formatINRShort, formatNumber } from "@/lib/utils";

// The home page's blocks: headline numbers, today's action points, targets,
// and recent wins and new accounts. Server Components (no client state).

function formatKpi(k: Pick<Kpi, "format">, n: number) {
  return k.format === "money" ? formatINRShort(n) : k.format === "score" ? n.toFixed(1) : formatNumber(n);
}

/** Month-on-month change, always as text and an arrow (never colour alone). */
function Delta({ kpi }: { kpi: Kpi }) {
  if (kpi.previous === null) return null;
  const diff = kpi.value - kpi.previous;
  const Icon = diff > 0 ? ArrowUpRightIcon : diff < 0 ? ArrowDownRightIcon : MinusIcon;
  const text = diff === 0 ? "Same as last month" : `${diff > 0 ? "+" : "−"}${formatKpi(kpi, Math.abs(diff))} vs last month`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        diff > 0 ? "text-green-700 dark:text-green-400" : diff < 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {text}
    </span>
  );
}

export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((k) => {
        const body = (
          <Card className={cn("h-full gap-2", k.href && "transition-colors hover:bg-muted/40")}>
            <CardContent className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">{k.label}</span>
              <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatKpi(k, k.value)}</span>
              <Delta kpi={k} />
              <span className="text-xs text-muted-foreground">{k.detail}</span>
            </CardContent>
          </Card>
        );
        return k.href ? (
          <Link key={k.key} href={k.href} className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            {body}
          </Link>
        ) : (
          <div key={k.key}>{body}</div>
        );
      })}
    </div>
  );
}

/** Today's action points on the viewer's own accounts: one group per kind of nudge. */
export function TodayCard({ actions }: { actions: ActionList[] }) {
  const open = actions.filter((a) => a.total > 0);
  const urgent = actions.filter((a) => a.key === "overdue" || a.key === "today").reduce((n, a) => n + a.total, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s action points</CardTitle>
        <CardDescription>
          {open.length === 0
            ? "Nothing waiting on your accounts. Nice work."
            : urgent > 0
              ? `${urgent} follow-up${urgent === 1 ? "" : "s"} need you today; the rest keep your accounts healthy.`
              : "No follow-ups due; tidy up the accounts below."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {open.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2Icon className="size-4 text-green-600 dark:text-green-400" aria-hidden="true" />
            All caught up.
          </p>
        ) : (
          <div className="grid gap-6 *:min-w-0 md:grid-cols-2">
            {open.map((a) => (
              <section key={a.key} aria-labelledby={`action-${a.key}`}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <h3 id={`action-${a.key}`} className={cn("text-sm font-medium", a.key === "overdue" && "text-red-700 dark:text-red-400")}>
                    {a.title} <span className="tabular-nums">({a.total})</span>
                  </h3>
                  {a.total > a.items.length && (
                    <Link href={a.href} className="text-xs font-medium underline-offset-4 hover:underline">
                      See all
                    </Link>
                  )}
                </div>
                <p className="mb-2 text-xs text-muted-foreground">{a.hint}</p>
                <ul className="divide-y rounded-lg border">
                  {a.items.map((i) => (
                    <li key={i.id}>
                      <Link href={`/leads/${i.id}`} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{i.companyName}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {i.date && (a.key === "overdue" || a.key === "today") ? `${formatDate(i.date)} · ` : ""}
                            {i.note}
                          </span>
                        </span>
                        <BandBadge band={i.band} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TargetsCard({ targets, scope }: { targets: NonNullable<HomeData["targets"]>; scope: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>This month&apos;s targets</CardTitle>
        <CardDescription>{scope}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <TargetMeter label="Won value" actual={targets.wonValue} target={targets.wonTarget} format={formatINRShort} />
        <TargetMeter label="New accounts" actual={targets.newAccounts} target={targets.newTarget} format={formatNumber} />
      </CardContent>
    </Card>
  );
}

export function TeamOverdueCard({ rows, names }: { rows: HomeData["teamOverdue"]; names: Record<string, string> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team follow-ups overdue</CardTitle>
        <CardDescription>{rows.length === 0 ? "Nobody on the team is behind." : "By owner. Nudge them or reassign on Team."}</CardDescription>
        <CardAction>
          <Link href="/follow-ups" className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
            Follow-ups
            <ArrowRightIcon className="size-3.5" aria-hidden="true" />
          </Link>
        </CardAction>
      </CardHeader>
      {rows.length > 0 && (
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            {rows.map((r) => (
              <li key={r.ownerId} className="flex items-center justify-between gap-2">
                <span>{names[r.ownerId] ?? "Unknown"}</span>
                <span className="font-medium text-red-700 tabular-nums dark:text-red-400">{r.count}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}

export function EventsCard({
  title,
  description,
  events,
  names,
  kind,
}: {
  title: string;
  description: string;
  events: HomeEvent[];
  names: Record<string, string>;
  kind: "win" | "new";
}) {
  const Icon = kind === "win" ? PartyPopperIcon : SparklesIcon;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{kind === "win" ? "No wins in the last 60 days yet." : "No new accounts in the last two weeks."}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                    kind === "win" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <Link href={`/leads/${e.id}`} className="block truncate font-medium hover:underline">
                    {e.companyName}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {names[e.ownerId] ?? "Unknown"} · {formatDate(e.date)}
                  </span>
                </span>
                {kind === "win" && e.value > 0 && <span className="shrink-0 font-medium tabular-nums">{formatINRShort(e.value)}</span>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
