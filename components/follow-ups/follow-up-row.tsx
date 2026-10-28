import Link from "next/link";
import { RescheduleMenu } from "@/components/follow-ups/reschedule-menu";
import { FollowUpLabel } from "@/components/leads/follow-up-label";
import { LogActivityDialog } from "@/components/leads/log-activity-dialog";
import { PriorityBadge } from "@/components/leads/priority-badge";
import { StageBadge } from "@/components/shared/stage-badge";
import { TODAY } from "@/lib/constants";
import { daysBetween } from "@/lib/dates";
import type { FollowUpItem } from "@/lib/dashboard/types";

function lastContactText(item: FollowUpItem): string {
  if (!item.lastContactedAt) return "Never contacted";
  const days = daysBetween(item.lastContactedAt, TODAY);
  if (days === 0) return "Contacted today";
  return `Last contact ${days} ${days === 1 ? "day" : "days"} ago`;
}

/** One follow-up with its context and the two quick actions. */
export function FollowUpRow({ item, showOwner = false }: { item: FollowUpItem; showOwner?: boolean }) {
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/leads/${item.id}`} className="font-medium hover:underline">
            {item.companyName}
          </Link>
          <StageBadge stage={item.stage} />
          <PriorityBadge priority={item.priority} />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.pocName}
          {showOwner && ` · ${item.ownerName}`} · {lastContactText(item)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-sm">
          <FollowUpLabel date={item.nextFollowUpAt} />
        </span>
        <div className="flex gap-1.5">
          <LogActivityDialog leadId={item.id} createdDay={item.createdDay} compact companyName={item.companyName} />
          <RescheduleMenu leadId={item.id} companyName={item.companyName} />
        </div>
      </div>
    </li>
  );
}
