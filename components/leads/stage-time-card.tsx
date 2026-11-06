import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TODAY } from "@/lib/constants";
import { daysInStages } from "@/lib/dashboard/stage-time";
import { cn, formatDate } from "@/lib/utils";
import type { Lead, LeadStage } from "@/types/lead";

const plural = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** How long this account has spent in each stage. One series, one colour; every bar prints its number. */
export function StageTimeCard({ lead, labels }: { lead: Lead; labels: Record<LeadStage, string> }) {
  const rows = daysInStages(lead.stageHistory, TODAY);
  const max = Math.max(1, ...rows.map((r) => r.days ?? 0));
  const total = rows.reduce((n, r) => n + (r.days ?? 0), 0);
  const imported = lead.activities.some((a) => a.description.startsWith("Imported from"));
  const start = lead.stageHistory[0]?.startDate;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Days in each stage</CardTitle>
        <CardDescription>
          {plural(total)} in total{start ? ` since ${formatDate(start)}` : ""}.
          {imported && " Imported from the tracker, which didn't record earlier moves, so that time all shows in the stage it was imported at."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.stage} className="grid grid-cols-[minmax(0,10rem)_1fr_5.5rem] items-center gap-3 text-sm">
              <span className={cn("truncate", r.current ? "font-medium" : r.days === null && "text-muted-foreground")} title={labels[r.stage]}>
                {labels[r.stage]}
              </span>
              <span className="h-2.5 overflow-hidden rounded-sm bg-muted" aria-hidden="true">
                {r.days !== null && (
                  <span className="block h-full rounded-sm bg-[var(--series-1)]" style={{ width: `${(r.days / max) * 100}%`, minWidth: r.days > 0 ? 2 : 0 }} />
                )}
              </span>
              <span className={cn("text-right tabular-nums", r.days === null ? "text-muted-foreground" : "font-medium")}>
                {r.days === null ? "–" : r.days}
                {r.current && <span className="text-xs font-normal text-muted-foreground"> so far</span>}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
