import "server-only";
import { redirect } from "next/navigation";
import { getAgents } from "@/data/mock-users";
import { requireUser } from "@/lib/auth/dal";
import { findLead, listLeads } from "@/lib/data/store";
import { TODAY } from "@/lib/constants";
import { canEditLead, isAdmin, partitionLeadsForUser, toVisibleLead, type VisibleLead } from "@/lib/auth/permissions";
import { toDirectoryRow, toLeadRow, type DirectoryRow, type LeadRow } from "@/lib/leads/rows";
import { getFollowUpsDue, toDirectoryEntry } from "@/lib/selectors";
import type { Lead, LeadDirectoryEntry } from "@/types/lead";

// Scoped lead access for pages and Server Actions. Each getter resolves the
// current user itself, so callers cannot request another user's view by id.
// Pages must use these instead of reading the store or mock data directly.

export async function getVisibleLeads(): Promise<{ full: Lead[]; masked: LeadDirectoryEntry[] }> {
  const user = await requireUser();
  return partitionLeadsForUser(user, listLeads());
}

/** The current user's own leads (every lead for an admin). */
export async function getMyLeads(): Promise<Lead[]> {
  const user = await requireUser();
  const leads = listLeads();
  return isAdmin(user) ? leads : leads.filter((l) => l.ownerId === user.id);
}

export interface FollowUpCounts {
  overdue: number;
  today: number;
  upcoming: number;
}

/** Follow-up buckets for the current user's leads (all leads for an admin). */
export async function getFollowUpCounts(): Promise<FollowUpCounts> {
  const user = await requireUser();
  const { overdue, today, upcoming } = getFollowUpsDue(isAdmin(user) ? undefined : user.id, TODAY, listLeads());
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
  return listLeads().map((lead) => toDirectoryRow(toDirectoryEntry(lead), user.id));
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
  const lead = findLead(id);
  return lead ? toVisibleLead(user, lead) : null;
}

/**
 * The full lead for its edit page: null when it does not exist, a redirect to
 * /no-access when the viewer may not edit it.
 */
export async function getLeadForEdit(id: string): Promise<Lead | null> {
  const user = await requireUser();
  const lead = findLead(id);
  if (!lead) return null;
  if (!canEditLead(user, lead)) redirect("/no-access");
  return lead;
}
