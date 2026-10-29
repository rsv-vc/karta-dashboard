import { STAGE_POINTS, leadBand, leadScore, type Band } from "@/lib/scoring";
import type { NameOf } from "@/lib/team";
import type { Lead, LeadDirectoryEntry, LeadStage } from "@/types/lead";

// DTOs sent to Client Components. They carry only what list views render:
// no contact details, notes, activities or stage history. The detail page
// fetches those itself, after its own permission check.

export type LeadRow = Pick<
  Lead,
  | "id"
  | "companyName"
  | "pocName"
  | "pocDesignation"
  | "industry"
  | "city"
  | "source"
  | "stage"
  | "priority"
  | "dealValue"
  | "volume"
  | "nextStep"
  | "ownerId"
  | "createdAt"
  | "lastContactedAt"
  | "nextFollowUpAt"
> & { ownerName: string; score: number; band: Band };

/** What sales agents see of every account: company, contact and owner (no stage). */
export type DirectoryRow = Omit<LeadDirectoryEntry, "stage"> & { ownerName: string; isMine: boolean };

/** `points` = stage points from the Stages master. */
export function toLeadRow(lead: Lead, nameOf: NameOf, points: Record<LeadStage, number> = STAGE_POINTS): LeadRow {
  return {
    id: lead.id,
    companyName: lead.companyName,
    pocName: lead.pocName,
    pocDesignation: lead.pocDesignation,
    industry: lead.industry,
    city: lead.city,
    source: lead.source,
    stage: lead.stage,
    priority: lead.priority,
    dealValue: lead.dealValue,
    volume: lead.volume,
    nextStep: lead.nextStep,
    score: leadScore(lead, points),
    band: leadBand(lead, points),
    ownerId: lead.ownerId,
    ownerName: nameOf(lead.ownerId),
    createdAt: lead.createdAt,
    lastContactedAt: lead.lastContactedAt,
    nextFollowUpAt: lead.nextFollowUpAt,
  };
}

export function toDirectoryRow(entry: LeadDirectoryEntry, viewerId: string, nameOf: NameOf): DirectoryRow {
  return {
    id: entry.id,
    companyName: entry.companyName,
    pocName: entry.pocName,
    ownerId: entry.ownerId,
    ownerName: nameOf(entry.ownerId),
    isMine: entry.ownerId === viewerId,
  };
}
