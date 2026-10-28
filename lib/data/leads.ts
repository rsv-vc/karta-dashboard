import "server-only";
import { mockLeads } from "@/data/mock-leads";
import { requireUser } from "@/lib/auth/dal";
import { isAdmin, partitionLeadsForUser, toVisibleLead, type VisibleLead } from "@/lib/auth/permissions";
import { getFollowUpsDue } from "@/lib/selectors";
import type { Lead, LeadDirectoryEntry } from "@/types/lead";

// Scoped lead access for pages and Server Actions. Each getter resolves the
// current user itself, so callers cannot request another user's view by id.
// Pages must use these instead of importing mockLeads directly.

export async function getVisibleLeads(): Promise<{ full: Lead[]; masked: LeadDirectoryEntry[] }> {
  const user = await requireUser();
  return partitionLeadsForUser(user, mockLeads);
}

/** The current user's own leads (every lead for an admin). */
export async function getMyLeads(): Promise<Lead[]> {
  const user = await requireUser();
  return isAdmin(user) ? mockLeads : mockLeads.filter((l) => l.ownerId === user.id);
}

export interface FollowUpCounts {
  overdue: number;
  today: number;
  upcoming: number;
}

/** Follow-up buckets for the current user's leads (all leads for an admin). */
export async function getFollowUpCounts(): Promise<FollowUpCounts> {
  const user = await requireUser();
  const { overdue, today, upcoming } = getFollowUpsDue(isAdmin(user) ? undefined : user.id);
  return { overdue: overdue.length, today: today.length, upcoming: upcoming.length };
}

export async function getLeadForViewer(id: string): Promise<VisibleLead | null> {
  const user = await requireUser();
  const lead = mockLeads.find((l) => l.id === id);
  return lead ? toVisibleLead(user, lead) : null;
}
