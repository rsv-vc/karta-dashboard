import { PIPELINE_ORDER, STAGE_LABELS, TODAY, isActiveStage } from "@/lib/constants";
import { laterThan, nowIso, toDateKey, toIstIso } from "@/lib/dates";
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

/** The next pipeline step, plus "lost" from any active stage. Closed leads cannot move. */
export function allowedNextStages(stage: LeadStage): LeadStage[] {
  if (!isActiveStage(stage)) return [];
  return [PIPELINE_ORDER[PIPELINE_ORDER.indexOf(stage) + 1], "lost"];
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

/** Fields shared by create and edit, normalized. */
function detailsFrom(input: LeadFormValues) {
  return {
    companyName: input.companyName.trim(),
    industry: input.industry,
    companySize: input.companySize,
    city: input.city,
    pocName: input.pocName.trim(),
    pocDesignation: input.pocDesignation.trim(),
    pocEmail: input.pocEmail.trim().toLowerCase(),
    pocPhone: normalizePhone(input.pocPhone),
    pocLinkedIn: input.pocLinkedIn.trim() || undefined,
    source: input.source,
    priority: input.priority,
    dealValue: input.dealValue,
    notes: input.notes.trim(),
  };
}

function followUpIso(date: string): string | null {
  return date ? toIstIso(date, 10, 0) : null;
}

export function buildNewLead(input: LeadFormValues, opts: Actor & { id: string; ownerId: string }): Lead {
  const at = opts.at ?? nowIso(TODAY);
  const lead: Lead = {
    id: opts.id,
    ...detailsFrom(input),
    stage: "new",
    currency: "INR",
    ownerId: opts.ownerId,
    createdAt: at,
    lastContactedAt: null,
    nextFollowUpAt: followUpIso(input.nextFollowUpDate),
    closedAt: null,
    stageHistory: [{ stage: "new", startDate: at, endDate: null }],
    activities: [],
  };
  return { ...lead, activities: addActivity(lead, { type: "note", description: "Lead created", date: at, byUserId: opts.byUserId }) };
}

export function applyLeadEdits(
  lead: Lead,
  input: LeadFormValues,
  opts: Actor & { canReassign: boolean; ownerName: (id: string) => string },
): Lead {
  const next: Lead = {
    ...lead,
    ...detailsFrom(input),
    // A closed lead has no follow-up; ignore any date sent for one.
    nextFollowUpAt: isActiveStage(lead.stage) ? followUpIso(input.nextFollowUpDate) : null,
  };
  const newOwner = input.ownerId;
  if (opts.canReassign && newOwner && newOwner !== lead.ownerId) {
    next.ownerId = newOwner;
    next.activities = addActivity(next, {
      type: "note",
      description: `Reassigned from ${opts.ownerName(lead.ownerId)} to ${opts.ownerName(newOwner)}`,
      date: laterThan(opts.at ?? nowIso(TODAY), lead.createdAt),
      byUserId: opts.byUserId,
    });
  }
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
    throw new MutationError(`A ${STAGE_LABELS[lead.stage]} lead cannot move to ${STAGE_LABELS[input.to]}`);
  }
  if (input.to === "lost" && !input.lostReason?.trim()) throw new MutationError("Say why the lead was lost");

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
