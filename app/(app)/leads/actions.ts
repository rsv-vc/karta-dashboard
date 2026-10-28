"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { getUserById } from "@/data/mock-users";
import { requireUser } from "@/lib/auth/dal";
import {
  canCreateLead,
  canDeleteLead,
  canEditLead,
  canReassignLead,
  canViewFullLead,
  isAdmin,
} from "@/lib/auth/permissions";
import { TODAY } from "@/lib/constants";
import { findLead, insertLead, listLeads, nextLeadId, removeLead, replaceLead } from "@/lib/data/store";
import {
  MutationError,
  applyActivity,
  applyFollowUp,
  applyLeadEdits,
  applyStageChange,
  buildNewLead,
} from "@/lib/leads/mutations";
import {
  changeStageSchema,
  createLeadSchema,
  followUpSchema,
  leadFormSchema,
  logActivitySchema,
  toFieldErrors,
} from "@/lib/leads/schemas";
import { findPossibleDuplicates } from "@/lib/selectors";
import type { Lead, LeadStage } from "@/types/lead";
import type { SessionUser } from "@/types/user";

// Lead mutations. Each action re-reads the session, checks permission against
// the CURRENT record in the store, and validates input with the same schema the
// form uses. Nothing sent by the client (ids, owner, role) is trusted as-is.

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export interface DuplicateMatch {
  id: string;
  companyName: string;
  ownerName: string;
  stage: LeadStage;
  /** True when the viewer may open the full lead (own lead, or any lead for an admin). */
  canOpen: boolean;
}

const ownerName = (id: string) => getUserById(id)?.name ?? "Unknown";

function invalid(error: z.ZodError): ActionResult {
  return { ok: false, error: "Please fix the highlighted fields", fieldErrors: toFieldErrors(error) };
}

/** Masked matches only: company, owner and stage, whoever owns the lead. */
function duplicatesFor(companyName: string, viewer: SessionUser, excludeId?: string): DuplicateMatch[] {
  return findPossibleDuplicates(companyName, excludeId, listLeads()).map((l) => ({
    id: l.id,
    companyName: l.companyName,
    ownerName: ownerName(l.ownerId),
    stage: l.stage,
    canOpen: canViewFullLead(viewer, l),
  }));
}

/** Loads a lead the current user may edit, or explains why not. */
async function editableLead(id: string): Promise<{ user: SessionUser; lead: Lead } | { error: string }> {
  const user = await requireUser();
  const lead = findLead(id);
  if (!lead) return { error: "This lead no longer exists" };
  if (!canEditLead(user, lead)) return { error: "You can only change leads you own" };
  return { user, lead };
}

/** Runs a pure mutation, turning rule violations into a friendly error. */
function attempt(fn: () => Lead): ActionResult {
  try {
    const next = fn();
    replaceLead(next);
    revalidatePath("/", "layout");
    return { ok: true, id: next.id };
  } catch (e) {
    if (e instanceof MutationError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Valid owner for a new or reassigned lead: an active sales agent. */
function isAssignableOwner(id: string): boolean {
  const user = getUserById(id);
  return user?.role === "sales_agent" && user.status === "active";
}

export async function checkDuplicates(companyName: string, excludeId?: string): Promise<DuplicateMatch[]> {
  const user = await requireUser();
  if (companyName.trim().length < 3) return [];
  return duplicatesFor(companyName, user, excludeId);
}

export async function createLead(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!canCreateLead(user)) return { ok: false, error: "You cannot create leads" };
  const parsed = createLeadSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  // Agents always own what they create; admins must pick an active agent.
  const ownerId = isAdmin(user) ? input.ownerId : user.id;
  if (!isAssignableOwner(ownerId)) {
    return { ok: false, error: "Pick an owner", fieldErrors: { ownerId: "Pick the agent who owns this lead" } };
  }
  if (duplicatesFor(input.companyName, user).length > 0 && !input.duplicateAcknowledged) {
    return { ok: false, error: "possible-duplicate" };
  }

  const lead = buildNewLead(input, { id: nextLeadId(), ownerId, byUserId: user.id });
  insertLead(lead);
  revalidatePath("/", "layout");
  return { ok: true, id: lead.id };
}

export async function updateLead(id: string, raw: unknown): Promise<ActionResult> {
  const found = await editableLead(id);
  if ("error" in found) return { ok: false, error: found.error };
  const parsed = leadFormSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  // An unchanged (possibly overdue) follow-up may stay; a new one must not be in the past.
  const currentFollowUp = found.lead.nextFollowUpAt?.slice(0, 10) ?? "";
  if (input.nextFollowUpDate && input.nextFollowUpDate !== currentFollowUp && input.nextFollowUpDate < TODAY) {
    return { ok: false, error: "Please fix the highlighted fields", fieldErrors: { nextFollowUpDate: "Pick today or a later date" } };
  }

  const canReassign = canReassignLead(found.user);
  if (canReassign && input.ownerId !== found.lead.ownerId && !isAssignableOwner(input.ownerId)) {
    return { ok: false, error: "Pick an owner", fieldErrors: { ownerId: "Pick an active sales agent" } };
  }
  const renamed = input.companyName.trim() !== found.lead.companyName;
  if (renamed && duplicatesFor(input.companyName, found.user, id).length > 0 && !input.duplicateAcknowledged) {
    return { ok: false, error: "possible-duplicate" };
  }

  return attempt(() => applyLeadEdits(found.lead, input, { byUserId: found.user.id, canReassign, ownerName }));
}

export async function changeStage(id: string, raw: unknown): Promise<ActionResult> {
  const found = await editableLead(id);
  if ("error" in found) return { ok: false, error: found.error };
  const parsed = changeStageSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  return attempt(() => applyStageChange(found.lead, parsed.data, { byUserId: found.user.id }));
}

export async function logActivity(id: string, raw: unknown): Promise<ActionResult> {
  const found = await editableLead(id);
  if ("error" in found) return { ok: false, error: found.error };
  const parsed = logActivitySchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  return attempt(() => applyActivity(found.lead, parsed.data, { byUserId: found.user.id }));
}

export async function setFollowUp(id: string, raw: unknown): Promise<ActionResult> {
  const found = await editableLead(id);
  if ("error" in found) return { ok: false, error: found.error };
  const parsed = followUpSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  return attempt(() => applyFollowUp(found.lead, parsed.data.date));
}

export async function deleteLead(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!canDeleteLead(user)) return { ok: false, error: "Only admins can delete leads" };
  if (!findLead(id)) return { ok: false, error: "This lead no longer exists" };
  removeLead(id);
  revalidatePath("/", "layout");
  return { ok: true };
}
