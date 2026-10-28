import { StageBadge } from "@/components/shared/stage-badge";
import { TODAY } from "@/lib/constants";
import { daysBetween } from "@/lib/dates";
import { formatDate } from "@/lib/utils";
import type { StageHistoryEntry } from "@/types/lead";

/** Each stage the lead passed through, with its dates and time spent there. */
export function StageHistory({ history }: { history: StageHistoryEntry[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {[...history].reverse().map((entry) => {
        const closed = entry.stage === "won" || entry.stage === "lost";
        const days = daysBetween(entry.startDate, entry.endDate ?? TODAY);
        return (
          <li key={`${entry.stage}-${entry.startDate}`} className="flex items-center justify-between gap-3 text-sm">
            <StageBadge stage={entry.stage} />
            <span className="text-right text-xs text-muted-foreground tabular-nums">
              {formatDate(entry.startDate)}
              {!closed && ` · ${days} ${days === 1 ? "day" : "days"}${entry.endDate ? "" : " so far"}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
