import "server-only";
import { redirect } from "next/navigation";
import { getTargetFor } from "@/data/mock-targets";
import { getAgents, mockUsers } from "@/data/mock-users";
import { requireRole, requireUser } from "@/lib/auth/dal";
import { findLead, listLeads } from "@/lib/data/store";
import { TODAY, isActiveStage } from "@/lib/constants";
import { daysBetween } from "@/lib/dates";
import { canEditLead, isAdmin, partitionLeadsForUser, toVisibleLead, type VisibleLead } from "@/lib/auth/permissions";
import { STALE_AFTER_DAYS, computeAgentDashboard, type AgentDashboard } from "@/lib/dashboard/agent-metrics";
import { buildFollowUpBoard, type FollowUpBoard } from "@/lib/dashboard/follow-ups";
import { computeTeamDashboard, type TeamDashboard, type TeamPeriod } from "@/lib/dashboard/team-metrics";
import { toDirectoryRow, toLeadRow, type DirectoryRow, type LeadRow } from "@/lib/leads/rows";
import { getFollowUpsDue, toDirectoryEntry } from "@/lib/selectors";
import type { Lead, LeadDirectoryEntry, LeadStage } from "@/types/lead";

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

/** The signed-in agent's dashboard, computed from their own leads. */
export async function getAgentDashboard(): Promise<AgentDashboard> {
  const user = await requireUser();
  const own = listLeads().filter((l) => l.ownerId === user.id);
  return computeAgentDashboard(own, { today: TODAY, target: getTargetFor(user.id) });
}

/** Follow-up queue: an agent's own leads; for admins every lead, optionally one owner's. */
export async function getFollowUpBoard(ownerId?: string): Promise<FollowUpBoard> {
  const user = await requireUser();
  const leads = listLeads().filter((l) =>
    isAdmin(user) ? !ownerId || l.ownerId === ownerId : l.ownerId === user.id,
  );
  return buildFollowUpBoard(leads, TODAY);
}

/** Admin team overview for a period. */
export async function getTeamDashboard(period: TeamPeriod): Promise<TeamDashboard> {
  await requireRole("admin");
  return computeTeamDashboard(listLeads(), { today: TODAY, period, agents: mockUsers });
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  dashboard: AgentDashboard;
  stale: number;
}

export interface ReassignableLead {
  id: string;
  companyName: string;
  stage: LeadStage;
  ownerId: string;
  nextFollowUpAt: string | null;
  stale: boolean;
}

/** Everything the /team page needs: per-agent summaries and the active leads that can be moved. */
export async function getTeamPageData(): Promise<{ members: TeamMember[]; leads: ReassignableLead[] }> {
  await requireRole("admin");
  const leads = listLeads();
  const agents = getAgents().filter((a) => a.status === "active");
  const isStaleLead = (l: Lead) =>
    daysBetween(l.lastContactedAt ?? l.createdAt, TODAY) >= STALE_AFTER_DAYS;

  const members = agents.map((a) => {
    const own = leads.filter((l) => l.ownerId === a.id);
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      joinedAt: a.joinedAt,
      dashboard: computeAgentDashboard(own, { today: TODAY, target: getTargetFor(a.id) }),
      stale: own.filter((l) => isActiveStage(l.stage) && isStaleLead(l)).length,
    };
  });
  const reassignable = leads
    .filter((l) => isActiveStage(l.stage))
    .map((l) => ({
      id: l.id,
      companyName: l.companyName,
      stage: l.stage,
      ownerId: l.ownerId,
      nextFollowUpAt: l.nextFollowUpAt,
      stale: isStaleLead(l),
    }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName));
  return { members, leads: reassignable };
}
