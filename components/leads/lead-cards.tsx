import Link from "next/link";
import type { ReactNode } from "react";
import { UserAvatar } from "@/components/auth/user-avatar";
import { FollowUpLabel } from "@/components/leads/follow-up-label";
import { PriorityBadge } from "@/components/leads/priority-badge";
import { StageBadge } from "@/components/shared/stage-badge";
import { Badge } from "@/components/ui/badge";
import type { DirectoryRow, LeadRow } from "@/lib/leads/rows";
import { cn, formatINRShort } from "@/lib/utils";

// Phone layouts of the lead tables: one card per row, the same sorted and
// paginated rows as the table, so filters, sort and paging behave identically.

const CARD = "flex flex-col gap-2 rounded-xl border bg-card p-4";

export function LeadCardList({
  rows,
  showOwner,
  empty,
  className,
}: {
  rows: LeadRow[];
  showOwner: boolean;
  empty: ReactNode;
  className?: string;
}) {
  if (rows.length === 0) return <div className={cn("rounded-xl border p-8", className)}>{empty}</div>;
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/leads/${r.id}`}
            className={cn(CARD, "transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.companyName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {r.pocName} · {r.city}
                </p>
              </div>
              <StageBadge stage={r.stage} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium tabular-nums">{formatINRShort(r.dealValue)}</span>
              <PriorityBadge priority={r.priority} />
              <span className="inline-flex items-center gap-1">
                <span className="text-muted-foreground">Follow-up</span>
                <FollowUpLabel date={r.nextFollowUpAt} />
              </span>
            </div>
            {showOwner && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserAvatar name={r.ownerName} className="size-5" />
                {r.ownerName}
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DirectoryCardList({ rows, empty, className }: { rows: DirectoryRow[]; empty: ReactNode; className?: string }) {
  if (rows.length === 0) return <div className={cn("rounded-xl border p-8", className)}>{empty}</div>;
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {rows.map((r) => {
        const body = (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.companyName}</p>
                <p className="truncate text-sm text-muted-foreground">{r.pocName}</p>
              </div>
              <StageBadge stage={r.stage} />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserAvatar name={r.ownerName} className="size-5" />
              {r.ownerName}
              {r.isMine && <Badge variant="secondary">You</Badge>}
            </div>
          </>
        );
        return (
          <li key={r.id}>
            {/* Only your own leads open; everyone else's are read-only entries. */}
            {r.isMine ? (
              <Link
                href={`/leads/${r.id}`}
                className={cn(CARD, "transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none")}
              >
                {body}
              </Link>
            ) : (
              <div className={CARD}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
