import "server-only";
import { redirect } from "next/navigation";
import { requireRole, requireUser } from "@/lib/auth/dal";
import { isAdmin, partitionLeadsForUser, type VisibleLead } from "@/lib/auth/permissions";
import { TODAY, isActiveStage } from "@/lib/constants";
import { STALE_AFTER_DAYS, computeAgentDashboard, type AgentDashboard } from "@/lib/dashboard/agent-metrics";
import { buildFollowUpBoard, type FollowUpBoard } from "@/lib/dashboard/follow-ups";
import { computeTeamDashboard, type TeamDashboard, type TeamPeriod } from "@/lib/dashboard/team-metrics";
import { fetchAccessRules, fetchDirectory, fetchLead, fetchTargets, fetchTeam, fetchVisibleLeads } from "@/lib/data/repo";
import { daysBetween } from "@/lib/dates";
import { toDirectoryRow, toLeadRow, type DirectoryRow, type LeadRow } from "@/lib/leads/rows";
import { buildMonthlyReport, type MonthlyReport } from "@/lib/reports/monthly";
import { getFollowUpsDue } from "@/lib/selectors";
import { isAdminApiConfigured } from "@/lib/supabase/admin";
import { activeAgents, nameLookup } from "@/lib/team";
import type { Lead, LeadDirectoryEntry, LeadStage } from "@/types/lead";
import type { Member } from "@/types/user";

// Scoped lead access for pages and Server Actions. Each getter resolves the
// current user itself, and the database's Row Level Security limits what each
// query returns, so a caller can never widen its own view.

export async function getVisibleLeads(): Promise<{ full: Lead[]; masked: LeadDirectoryEntry[] }> {
  const user = await requireUser();
  const [leads, directory] = await Promise.all([
    fetchVisibleLeads(),
    isAdmin(user) ? Promise.resolve([]) : fetchDirectory(),
  ]);
  // partitionLeadsForUser re-applies the app rule on top of RLS (defense in depth).
  const { full } = partitionLeadsForUser(user, leads);
  const fullIds = new Set(full.map((l) => l.id));
  return { full, masked: directory.filter((e) => !fullIds.has(e.id)) };
}

/** The current user's own leads (every lead for an admin). */
export async function getMyLeads(): Promise<Lead[]> {
  const user = await requireUser();
  return partitionLeadsForUser(user, await fetchVisibleLeads()).full;
}

export interface FollowUpCounts {
  overdue: number;
  today: number;
  upcoming: number;
}

/** Follow-up buckets for the current user's leads (all leads for an admin). */
export async function getFollowUpCounts(): Promise<FollowUpCounts> {
  const user = await requireUser();
  const leads = await fetchVisibleLeads();
  const { overdue, today, upcoming } = getFollowUpsDue(isAdmin(user) ? undefined : user.id, TODAY, leads);
  return { overdue: overdue.length, today: today.length, upcoming: upcoming.length };
}

/** List rows for every lead the viewer may see in full (agent: own; admin: all). */
export async function getLeadRows(): Promise<LeadRow[]> {
  const [{ full }, team] = await Promise.all([getVisibleLeads(), fetchTeam()]);
  const nameOf = nameLookup(team);
  return full.map((lead) => toLeadRow(lead, nameOf));
}

/** Every lead as a masked directory row; the viewer's own rows are flagged isMine. */
export async function getDirectoryRows(): Promise<DirectoryRow[]> {
  const user = await requireUser();
  const [directory, team] = await Promise.all([fetchDirectory(), fetchTeam()]);
  const nameOf = nameLookup(team);
  return directory.map((entry) => toDirectoryRow(entry, user.id, nameOf));
}

export interface OwnerOption {
  id: string;
  name: string;
}

/** Active sales agents, for owner filters. */
export async function getOwnerOptions(): Promise<OwnerOption[]> {
  await requireUser();
  return activeAgents(await fetchTeam()).map(({ id, name }) => ({ id, name }));
}

/** Full lead if the viewer may see it, the masked entry otherwise, or null if it does not exist. */
export async function getLeadForViewer(id: string): Promise<VisibleLead | null> {
  await requireUser();
  const lead = await fetchLead(id);
  if (lead) return { kind: "full", lead };
  const entry = (await fetchDirectory()).find((e) => e.id === id);
  return entry ? { kind: "masked", entry } : null;
}

/**
 * The full lead for its edit page: null when it does not exist, a redirect to
 * /no-access when the viewer may not edit it.
 */
export async function getLeadForEdit(id: string): Promise<Lead | null> {
  await requireUser();
  const lead = await fetchLead(id);
  if (lead) return lead;
  if ((await fetchDirectory()).some((e) => e.id === id)) redirect("/no-access");
  return null;
}

/** The signed-in agent's dashboard, computed from their own leads. */
export async function getAgentDashboard(): Promise<AgentDashboard> {
  const user = await requireUser();
  const [leads, targetFor] = await Promise.all([fetchVisibleLeads(), fetchTargets(TODAY.slice(0, 7))]);
  const own = leads.filter((l) => l.ownerId === user.id);
  return computeAgentDashboard(own, { today: TODAY, target: targetFor(user.id) });
}

/** Follow-up queue: an agent's own leads; for admins every lead, optionally one owner's. */
export async function getFollowUpBoard(ownerId?: string): Promise<FollowUpBoard> {
  const user = await requireUser();
  const [all, team] = await Promise.all([fetchVisibleLeads(), fetchTeam()]);
  const leads = all.filter((l) => (isAdmin(user) ? !ownerId || l.ownerId === ownerId : l.ownerId === user.id));
  return buildFollowUpBoard(leads, TODAY, nameLookup(team));
}

/** Admin team overview for a period. */
export async function getTeamDashboard(period: TeamPeriod): Promise<TeamDashboard> {
  await requireRole("admin");
  const [leads, team] = await Promise.all([fetchVisibleLeads(), fetchTeam()]);
  return computeTeamDashboard(leads, { today: TODAY, period, agents: team });
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

/** A row of the admin "Members & access" table. */
export interface MemberRow extends Member {
  activeLeads: number;
  /** This month's targets (sales agents only). */
  target: { wonValue: number; newLeads: number } | null;
}

export interface TeamPageData {
  members: TeamMember[];
  leads: ReassignableLead[];
  people: MemberRow[];
  companyDomains: string[];
  allowedEmails: string[];
  /** Whether the server can create accounts and set passwords (SUPABASE_SECRET_KEY). */
  canManageAccounts: boolean;
  viewerId: string;
}

/** Everything the /team page needs: agent summaries, movable leads, and every member's access. */
export async function getTeamPageData(): Promise<TeamPageData> {
  const viewer = await requireRole("admin");
  const [leads, targetFor, team, rules] = await Promise.all([
    fetchVisibleLeads(),
    fetchTargets(TODAY.slice(0, 7)),
    fetchTeam(),
    fetchAccessRules(),
  ]);
  const agents = activeAgents(team);
  const isStaleLead = (l: Lead) => daysBetween(l.lastContactedAt ?? l.createdAt, TODAY) >= STALE_AFTER_DAYS;

  const members = agents.map((a) => {
    const own = leads.filter((l) => l.ownerId === a.id);
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      joinedAt: a.joinedAt,
      dashboard: computeAgentDashboard(own, { today: TODAY, target: targetFor(a.id) }),
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
  const people = team.map((m) => ({
    ...m,
    activeLeads: leads.filter((l) => l.ownerId === m.id && isActiveStage(l.stage)).length,
    target: m.role === "sales_agent" ? targetFor(m.id) : null,
  }));
  return {
    members,
    leads: reassignable,
    people,
    ...rules,
    canManageAccounts: isAdminApiConfigured(),
    viewerId: viewer.id,
  };
}

/** Admin monthly report; month keys are validated by the page. */
export async function getMonthlyReport(month: string, compareTo: string | null): Promise<MonthlyReport> {
  await requireRole("admin");
  const [leads, team] = await Promise.all([fetchVisibleLeads(), fetchTeam()]);
  return buildMonthlyReport(leads, { month, compareTo, team });
}
