import type { NameOf } from "@/lib/team";
import type { Lead, LeadDirectoryEntry } from "@/types/lead";

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
  | "ownerId"
  | "createdAt"
  | "lastContactedAt"
  | "nextFollowUpAt"
> & { ownerName: string };

export type DirectoryRow = LeadDirectoryEntry & { ownerName: string; isMine: boolean };

export function toLeadRow(lead: Lead, nameOf: NameOf): LeadRow {
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
    stage: entry.stage,
    ownerName: nameOf(entry.ownerId),
    isMine: entry.ownerId === viewerId,
  };
}
