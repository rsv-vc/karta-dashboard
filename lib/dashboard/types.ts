import { toDateKey } from "@/lib/dates";
import type { NameOf } from "@/lib/team";
import type { Lead } from "@/types/lead";

// Small DTOs for dashboard and follow-up views: enough to render a row and
// act on it, nothing more.

export type FollowUpItem = Pick<
  Lead,
  "id" | "companyName" | "pocName" | "stage" | "priority" | "nextFollowUpAt" | "lastContactedAt"
> & {
  /** YYYY-MM-DD the lead was created (lower bound for logging activities). */
  createdDay: string;
  ownerName: string;
};

export function toFollowUpItem(lead: Lead, nameOf: NameOf): FollowUpItem {
  return {
    id: lead.id,
    companyName: lead.companyName,
    pocName: lead.pocName,
    stage: lead.stage,
    priority: lead.priority,
    nextFollowUpAt: lead.nextFollowUpAt,
    lastContactedAt: lead.lastContactedAt,
    createdDay: toDateKey(lead.createdAt),
    ownerName: nameOf(lead.ownerId),
  };
}
