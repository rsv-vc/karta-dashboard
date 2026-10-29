import { STAGES, STAGE_LABELS, TODAY, canMoveStage, isActiveStage } from "@/lib/constants";
import { laterThan, nowIso, toDateKey, toIstIso } from "@/lib/dates";
import { calculateDeal, dealInputsChanged, type DealInputs } from "@/lib/deal-calculator";
import type { LeadFormValues, LogActivityValues } from "@/lib/leads/schemas";
import type { ActivityEntry, ActivityType, Lead, LeadStage } from "@/types/lead";

// Pure lead mutations: each takes a lead and returns a new one, or throws a
// MutationError the Server Action turns into a user-facing message. No I/O, so
// scripts/check-mutations.ts can exercise every rule.

export class MutationError extends Error {}

interface Actor {
  byUserId: string;
  /** Defaults to "now" in the mock world. */
  at?: string;
}

/** "9876543210" / "+91-98765-43210" / "098765 43210" -> "+91 98765 43210". Assumes a valid input. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s-]/g, "").replace(/^(\+91|0)/, "");
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/** Every stage this one may move to (canMoveStage), in display order. Won and Lost cannot move. */
export function allowedNextStages(stage: LeadStage): LeadStage[] {
  return STAGES.map((s) => s.value).filter((to) => canMoveStage(stage, to));
}

/** Moving here counts as holding the first discovery meeting (mirrors change_lead_stage). */
function marksDiscovery(to: LeadStage): boolean {
  return to !== "not_met" && to !== "no_show" && to !== "deferred" && to !== "lost";
}

function lastStart(lead: Lead): string {
  return lead.stageHistory[lead.stageHistory.length - 1].startDate;
}

function addActivity(lead: Lead, activity: Omit<ActivityEntry, "id">): ActivityEntry[] {
  // Ids stay unique even after deletions because they only ever grow.
  const maxN = lead.activities.reduce((m, a) => Math.max(m, Number(a.id.split("-a")[1]) || 0), 0);
  const next = [...lead.activities, { ...activity, id: `${lead.id}-a${maxN + 1}` }];
  return next.sort((a, b) => a.date.localeCompare(b.date));
}

/** The calculator inputs of a form or a stored account. */
export function dealInputsOf(v: Pick<LeadFormValues, "industry" | "callsPerMonth" | "minutesPerCall" | "pricePerMinute" | "contractMonths">): DealInputs {
  return {
    segment: v.industry,
    callsPerMonth: v.callsPerMonth,
    minutesPerCall: v.minutesPerCall,
    pricePerMinute: v.pricePerMinute,
    contractMonths: v.contractMonths,
  };
}

/** Fields shared by create and edit, normalized. Volume and deal value are calculated. */
function detailsFrom(input: LeadFormValues) {
  const deal = calculateDeal(dealInputsOf(input));
  return {
    companyName: input.companyName.trim(),
    industry: input.industry,
    companySize: input.companySize || null,
    city: input.city.trim(),
    pocName: input.pocName.trim(),
    pocDesignation: input.pocDesignation.trim(),
    pocEmail: input.pocEmail.trim().toLowerCase(),
    pocPhone: input.pocPhone.trim() ? normalizePhone(input.pocPhone) : "",
    pocLinkedIn: input.pocLinkedIn.trim() || undefined,
    source: input.source,
    priority: input.priority,
    callsPerMonth: input.callsPerMonth,
    minutesPerCall: input.minutesPerCall,
    pricePerMinute: input.pricePerMinute,
    contractMonths: input.contractMonths,
    volume: deal.volume,
    dealValue: deal.dealValue,
    responsiveness: input.responsiveness,
    decisionAccess: input.decisionAccess,
    timingBudget: input.timingBudget,
    nextStep: input.nextStep.trim(),
    notes: input.notes.trim(),
  };
}

/** "YYYY-MM-DD" -> that day at 10:00 IST (follow-ups are day-level); "" -> null. */
export function followUpIso(date: string): string | null {
  return date ? toIstIso(date, 10, 0) : null;
}

export function buildNewLead(input: LeadFormValues, opts: Actor & { id: string; ownerId: string }): Lead {
  const at = opts.at ?? nowIso(TODAY);
  const lead: Lead = {
    id: opts.id,
    ...detailsFrom(input),
    stage: "not_met",
    currency: "INR",
    discoveryDate: null,
    discoveryMonth: null,
    sourceStatus: null,
    ownerId: opts.ownerId,
    createdAt: at,
    lastContactedAt: null,
    nextFollowUpAt: followUpIso(input.nextFollowUpDate),
    closedAt: null,
    stageHistory: [{ stage: "not_met", startDate: at, endDate: null }],
    activities: [],
  };
  return { ...lead, activities: addActivity(lead, { type: "note", description: "Account created", date: at, byUserId: opts.byUserId }) };
}

export function applyLeadEdits(
  lead: Lead,
  input: LeadFormValues,
  opts: Actor & { canReassign: boolean; ownerName: (id: string) => string },
): Lead {
  const details = detailsFrom(input);
  // Keep the stored totals (e.g. a final value recorded when won) unless an input changed.
  const unchanged = !dealInputsChanged(dealInputsOf({ ...lead, industry: lead.industry as LeadFormValues["industry"] }), dealInputsOf(input));
  const next: Lead = {
    ...lead,
    ...details,
    ...(unchanged ? { volume: lead.volume, dealValue: lead.dealValue } : {}),
    // A closed lead has no follow-up; ignore any date sent for one.
    nextFollowUpAt: isActiveStage(lead.stage) ? followUpIso(input.nextFollowUpDate) : null,
  };
  return opts.canReassign && input.ownerId ? reassignLead(next, input.ownerId, opts) : next;
}

/** Moves a lead to another owner and records who did it. Same owner = no change. */
export function reassignLead(
  lead: Lead,
  toOwnerId: string,
  opts: Actor & { ownerName: (id: string) => string },
): Lead {
  if (toOwnerId === lead.ownerId) return lead;
  const next: Lead = { ...lead, ownerId: toOwnerId };
  next.activities = addActivity(next, {
    type: "note",
    description: `Reassigned from ${opts.ownerName(lead.ownerId)} to ${opts.ownerName(toOwnerId)}`,
    date: laterThan(opts.at ?? nowIso(TODAY), lead.createdAt),
    byUserId: opts.byUserId,
  });
  return next;
}

export interface StageChangeInput {
  to: LeadStage;
  note?: string;
  lostReason?: string;
  finalDealValue?: number;
}

export function applyStageChange(lead: Lead, input: StageChangeInput, opts: Actor): Lead {
  if (!allowedNextStages(lead.stage).includes(input.to)) {
    throw new MutationError(`An account at ${STAGE_LABELS[lead.stage]} cannot move to ${STAGE_LABELS[input.to]}`);
  }
  if (input.to === "lost" && !input.lostReason?.trim()) throw new MutationError("Say why the account was lost");

  // Keep history strictly ordered even if seed data has a later time today.
  const at = laterThan(opts.at ?? nowIso(TODAY), lastStart(lead));
  const closing = !isActiveStage(input.to);
  const history = lead.stageHistory.map((e, i) =>
    i === lead.stageHistory.length - 1 ? { ...e, endDate: at } : e,
  );
  history.push({ stage: input.to, startDate: at, endDate: null });

  const detail = input.to === "lost" ? input.lostReason?.trim() : input.note?.trim();
  const description = `Moved from ${STAGE_LABELS[lead.stage]} to ${STAGE_LABELS[input.to]}${detail ? `: ${detail}` : ""}`;

  const next: Lead = {
    ...lead,
    stage: input.to,
    stageHistory: history,
    closedAt: closing ? at : null,
    nextFollowUpAt: closing ? null : lead.nextFollowUpAt,
    dealValue: input.to === "won" && input.finalDealValue ? input.finalDealValue : lead.dealValue,
    discoveryDate: lead.discoveryDate ?? (marksDiscovery(input.to) ? toDateKey(at) : null),
    discoveryMonth: lead.discoveryMonth ?? (marksDiscovery(input.to) ? toDateKey(at).slice(0, 7) : null),
  };
  return { ...next, activities: addActivity(next, { type: "stage_change", description, date: at, byUserId: opts.byUserId }) };
}

const CONTACT_TYPES: readonly ActivityType[] = ["call", "email", "meeting"];

export function applyActivity(lead: Lead, input: LogActivityValues, opts: Actor): Lead {
  if (!isActiveStage(lead.stage)) throw new MutationError("Closed leads cannot take new activities");
  const createdDay = toDateKey(lead.createdAt);
  if (input.date < createdDay || input.date > TODAY) {
    throw new MutationError("The activity date must be between the lead's creation and today");
  }

  // Today's activities use the current time; past ones are placed at midday.
  const raw = input.date === TODAY ? (opts.at ?? nowIso(TODAY)) : toIstIso(input.date, 12, 0);
  const date = raw < lead.createdAt ? laterThan(raw, lead.createdAt) : raw;

  const next: Lead = { ...lead };
  if (CONTACT_TYPES.includes(input.type) && (!lead.lastContactedAt || date > lead.lastContactedAt)) {
    next.lastContactedAt = date;
  }
  if (input.nextFollowUpDate) next.nextFollowUpAt = followUpIso(input.nextFollowUpDate);
  next.activities = addActivity(next, {
    type: input.type,
    description: input.description.trim(),
    date,
    byUserId: opts.byUserId,
  });
  return next;
}

export function applyFollowUp(lead: Lead, date: string): Lead {
  if (!isActiveStage(lead.stage)) throw new MutationError("Closed leads have no follow-ups");
  return { ...lead, nextFollowUpAt: followUpIso(date) };
}
