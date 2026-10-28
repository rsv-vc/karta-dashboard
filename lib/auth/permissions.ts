import { toDirectoryEntry } from "@/lib/selectors";
import type { Lead, LeadDirectoryEntry } from "@/types/lead";
import type { User } from "@/types/user";

// Pure permission rules. No cookies or server APIs, so they work in scripts,
// Server Components and (later) Client Components for hiding UI.
//
// admin: full access to everything.
// sales_agent: full access to own leads; other agents' leads only as directory entries.

export type Viewer = Pick<User, "id" | "role">;

export type VisibleLead = { kind: "full"; lead: Lead } | { kind: "masked"; entry: LeadDirectoryEntry };

export function isAdmin(user: Viewer): boolean {
  return user.role === "admin";
}

export function canViewFullLead(user: Viewer, lead: Pick<Lead, "ownerId">): boolean {
  return isAdmin(user) || lead.ownerId === user.id;
}

export function canEditLead(user: Viewer, lead: Pick<Lead, "ownerId">): boolean {
  return canViewFullLead(user, lead);
}

export function canCreateLead(user: Viewer): boolean {
  return user.role === "admin" || user.role === "sales_agent";
}

export function canReassignLead(user: Viewer): boolean {
  return isAdmin(user);
}

export function canDeleteLead(user: Viewer): boolean {
  return isAdmin(user);
}

export function canViewReports(user: Viewer): boolean {
  return isAdmin(user);
}

export function canViewTeamDashboard(user: Viewer): boolean {
  return isAdmin(user);
}

/** The lead as this viewer may see it: in full, or masked to the directory fields. */
export function toVisibleLead(user: Viewer, lead: Lead): VisibleLead {
  return canViewFullLead(user, lead) ? { kind: "full", lead } : { kind: "masked", entry: toDirectoryEntry(lead) };
}

/** Splits leads into what the viewer sees in full and what they see masked. */
export function partitionLeadsForUser(
  user: Viewer,
  leads: Lead[],
): { full: Lead[]; masked: LeadDirectoryEntry[] } {
  const full: Lead[] = [];
  const masked: LeadDirectoryEntry[] = [];
  for (const lead of leads) {
    if (canViewFullLead(user, lead)) full.push(lead);
    else masked.push(toDirectoryEntry(lead));
  }
  return { full, masked };
}
