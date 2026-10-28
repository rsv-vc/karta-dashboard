import "server-only";
import { mockLeads } from "@/data/mock-leads";
import { getAgents } from "@/data/mock-users";
import { requireUser } from "@/lib/auth/dal";
import { isAdmin, partitionLeadsForUser, toVisibleLead, type VisibleLead } from "@/lib/auth/permissions";
import { toDirectoryRow, toLeadRow, type DirectoryRow, type LeadRow } from "@/lib/leads/rows";
import { getFollowUpsDue, toDirectoryEntry } from "@/lib/selectors";
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

/** List rows for every lead the viewer may see in full (agent: own; admin: all). */
export async function getLeadRows(): Promise<LeadRow[]> {
  const { full } = await getVisibleLeads();
  return full.map(toLeadRow);
}

/** Every lead as a masked directory row; the viewer's own rows are flagged isMine. */
export async function getDirectoryRows(): Promise<DirectoryRow[]> {
  const user = await requireUser();
  return mockLeads.map((lead) => toDirectoryRow(toDirectoryEntry(lead), user.id));
}

export interface OwnerOption {
  id: string;
  name: string;
}

/** Active sales agents, for owner filters. */
export async function getOwnerOptions(): Promise<OwnerOption[]> {
  await requireUser();
  return getAgents()
    .filter((a) => a.status === "active")
    .map(({ id, name }) => ({ id, name }));
}

export async function getLeadForViewer(id: string): Promise<VisibleLead | null> {
  const user = await requireUser();
  const lead = mockLeads.find((l) => l.id === id);
  return lead ? toVisibleLead(user, lead) : null;
}
