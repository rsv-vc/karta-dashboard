import { followUpBucket } from "@/lib/leads/filters";
import { cn, formatDate, formatRelativeDays } from "@/lib/utils";

/** "2 days overdue" in red, "Today" in amber, otherwise muted; "—" when unset. */
export function FollowUpLabel({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const bucket = followUpBucket({ nextFollowUpAt: date });
  return (
    <span
      title={formatDate(date)}
      className={cn(
        "whitespace-nowrap",
        bucket === "overdue" && "font-medium text-red-600 dark:text-red-400",
        bucket === "today" && "font-medium text-amber-600 dark:text-amber-400",
        bucket === "upcoming" && "text-muted-foreground",
      )}
    >
      {formatRelativeDays(date)}
    </span>
  );
}
