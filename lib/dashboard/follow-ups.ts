import { isActiveStage } from "@/lib/constants";
import { daysBetween, toDateKey } from "@/lib/dates";
import { toFollowUpItem, type FollowUpItem } from "@/lib/dashboard/types";
import type { NameOf } from "@/lib/team";
import type { Lead } from "@/types/lead";

// Follow-up queue buckets. Pure: takes leads and a "today" date key.

export interface FollowUpBoard {
  overdue: FollowUpItem[];
  today: FollowUpItem[];
  /** Due in the next 7 days (tomorrow through today + 7). */
  thisWeek: FollowUpItem[];
  later: FollowUpItem[];
}

export const FOLLOW_UP_SECTIONS = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Due today" },
  { key: "thisWeek", label: "This week" },
  { key: "later", label: "Later" },
] as const satisfies readonly { key: keyof FollowUpBoard; label: string }[];

/** Every active lead with a follow-up lands in exactly one bucket, soonest first. */
export function buildFollowUpBoard(leads: Lead[], today: string, nameOf: NameOf): FollowUpBoard {
  const board: FollowUpBoard = { overdue: [], today: [], thisWeek: [], later: [] };
  const scheduled = leads
    .filter((l) => isActiveStage(l.stage) && l.nextFollowUpAt)
    .sort((a, b) => a.nextFollowUpAt!.localeCompare(b.nextFollowUpAt!));

  for (const lead of scheduled) {
    const days = daysBetween(today, toDateKey(lead.nextFollowUpAt!));
    const item = toFollowUpItem(lead, nameOf);
    if (days < 0) board.overdue.push(item);
    else if (days === 0) board.today.push(item);
    else if (days <= 7) board.thisWeek.push(item);
    else board.later.push(item);
  }
  return board;
}
