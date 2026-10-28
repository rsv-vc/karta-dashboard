"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserById, toAuthId } from "@/data/mock-users";
import { requireUser } from "@/lib/auth/dal";
import { canCreateLead, canDeleteLead, canReassignLead, canViewFullLead, isAdmin } from "@/lib/auth/permissions";
import { TODAY } from "@/lib/constants";
import { toAppUserId } from "@/lib/data/mappers";
import { fetchLead } from "@/lib/data/repo";
import { followUpIso, normalizePhone } from "@/lib/leads/mutations";
import {
  changeStageSchema,
  createLeadSchema,
  followUpSchema,
  leadFormSchema,
  logActivitySchema,
  toFieldErrors,
  type LeadFormValues,
} from "@/lib/leads/schemas";
import { createClient } from "@/lib/supabase/server";
import type { LeadStage } from "@/types/lead";
import type { SessionUser } from "@/types/user";

// Lead mutations. Each action re-reads the session and validates input with the
// same schema the form uses; the database then enforces ownership (RLS) and the
// stage rules (change_lead_stage etc.). Nothing sent by the client is trusted.

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

/** Turns a database error into a user-facing result (the functions raise readable messages). */
function dbError(error: { message: string }): ActionResult {
  return { ok: false, error: error.message || "Something went wrong. Please try again." };
}

function done(id?: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, id };
}

/** Valid owner for a new or reassigned lead: an active sales agent. */
function isAssignableOwner(id: string): boolean {
  const user = getUserById(id);
  return user?.role === "sales_agent" && user.status === "active";
}

/** Masked matches only: company, owner and stage, whoever owns the lead. */
async function duplicatesFor(companyName: string, viewer: SessionUser, excludeId?: string): Promise<DuplicateMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_possible_duplicates", {
    p_name: companyName,
    p_exclude_id: excludeId,
  });
  if (error) return [];
  return data.map((row) => {
    const ownerId = toAppUserId(row.owner_id);
    return {
      id: row.id,
      companyName: row.company_name,
      ownerName: ownerName(ownerId),
      stage: row.stage,
      canOpen: canViewFullLead(viewer, { ownerId }),
    };
  });
}

/** Lead detail columns shared by create and edit, normalized. */
function detailColumns(input: LeadFormValues) {
  return {
    company_name: input.companyName.trim(),
    poc_name: input.pocName.trim(),
    poc_designation: input.pocDesignation.trim(),
    poc_email: input.pocEmail.trim().toLowerCase(),
    poc_phone: normalizePhone(input.pocPhone),
    poc_linkedin: input.pocLinkedIn.trim() || null,
    industry: input.industry,
    company_size: input.companySize,
    city: input.city,
    source: input.source,
    priority: input.priority,
    deal_value: input.dealValue,
    notes: input.notes.trim(),
  };
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
  if ((await duplicatesFor(input.companyName, user)).length > 0 && !input.duplicateAcknowledged) {
    return { ok: false, error: "possible-duplicate" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_lead", {
    p: {
      ...detailColumns(input),
      owner_id: toAuthId(ownerId),
      next_follow_up_at: followUpIso(input.nextFollowUpDate) ?? "",
    },
  });
  return error ? dbError(error) : done(data);
}

export async function updateLead(id: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const lead = await fetchLead(id);
  if (!lead) return { ok: false, error: "You can only change leads you own" };
  const parsed = leadFormSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  // An unchanged (possibly overdue) follow-up may stay; a new one must not be in the past.
  const currentFollowUp = lead.nextFollowUpAt?.slice(0, 10) ?? "";
  if (input.nextFollowUpDate && input.nextFollowUpDate !== currentFollowUp && input.nextFollowUpDate < TODAY) {
    return { ok: false, error: "Please fix the highlighted fields", fieldErrors: { nextFollowUpDate: "Pick today or a later date" } };
  }
  const reassignTo = canReassignLead(user) && input.ownerId && input.ownerId !== lead.ownerId ? input.ownerId : null;
  if (reassignTo && !isAssignableOwner(reassignTo)) {
    return { ok: false, error: "Pick an owner", fieldErrors: { ownerId: "Pick an active sales agent" } };
  }
  const renamed = input.companyName.trim() !== lead.companyName;
  if (renamed && (await duplicatesFor(input.companyName, user, id)).length > 0 && !input.duplicateAcknowledged) {
    return { ok: false, error: "possible-duplicate" };
  }

  const supabase = await createClient();
  const closed = lead.stage === "won" || lead.stage === "lost";
  const { data, error } = await supabase
    .from("leads")
    .update({
      ...detailColumns(input),
      // A closed lead has no follow-up; ignore any date sent for one.
      next_follow_up_at: closed ? null : followUpIso(input.nextFollowUpDate),
    })
    .eq("id", id)
    .select("id");
  if (error) return dbError(error);
  if (data.length === 0) return { ok: false, error: "You can only change leads you own" };

  if (reassignTo) {
    const { error: moveError } = await supabase.rpc("reassign_leads", { p_lead_ids: [id], p_to: toAuthId(reassignTo) });
    if (moveError) return dbError(moveError);
  }
  return done(id);
}

export async function changeStage(id: string, raw: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = changeStageSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_lead_stage", {
    p_lead_id: id,
    p_to: v.to,
    p_note: v.note,
    p_lost_reason: v.lostReason,
    p_final_deal_value: v.finalDealValue,
  });
  return error ? dbError(error) : done(id);
}

export async function logActivity(id: string, raw: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = logActivitySchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_activity", {
    p_lead_id: id,
    p_type: v.type,
    p_description: v.description,
    p_date: v.date,
    p_next_follow_up: v.nextFollowUpDate || undefined,
  });
  return error ? dbError(error) : done(id);
}

export async function setFollowUp(id: string, raw: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = followUpSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const lead = await fetchLead(id);
  if (!lead) return { ok: false, error: "You can only change leads you own" };
  if (lead.stage === "won" || lead.stage === "lost") return { ok: false, error: "Closed leads have no follow-ups" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ next_follow_up_at: followUpIso(parsed.data.date) })
    .eq("id", id)
    .select("id");
  if (error) return dbError(error);
  return data.length === 0 ? { ok: false, error: "You can only change leads you own" } : done(id);
}

export async function deleteLead(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!canDeleteLead(user)) return { ok: false, error: "Only admins can delete leads" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").delete().eq("id", id).select("id");
  if (error) return dbError(error);
  return data.length === 0 ? { ok: false, error: "This lead no longer exists" } : done();
}

const reassignSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1, "Pick at least one lead").max(50, "Move at most 50 leads at a time"),
  toOwnerId: z.string().min(1, "Pick the agent to move them to"),
});

export type ReassignResult = { ok: true; moved: number; skipped: number } | { ok: false; error: string };

/** Admin bulk rebalance: move leads to another active agent, noting each move on the lead. */
export async function reassignLeads(raw: unknown): Promise<ReassignResult> {
  const user = await requireUser();
  if (!canReassignLead(user)) return { ok: false, error: "Only admins can reassign leads" };
  const parsed = reassignSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { leadIds, toOwnerId } = parsed.data;
  if (!isAssignableOwner(toOwnerId)) return { ok: false, error: "Pick an active sales agent" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reassign_leads", { p_lead_ids: leadIds, p_to: toAuthId(toOwnerId) });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, moved: data, skipped: leadIds.length - data };
}
