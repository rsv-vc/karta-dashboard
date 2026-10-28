import { getUserById } from "@/data/mock-users";
import { PIPELINE_ORDER, TODAY, isActiveStage } from "@/lib/constants";
import { daysBetween, toDateKey } from "@/lib/dates";
import type { Lead } from "@/types/lead";

// Integrity checks for lead data. Used by the dev data page today and useful as
// a test helper once real data arrives.

export interface ValidationError {
  leadId: string;
  companyName: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const EXPECTED_LEAD_COUNT = 75;
const MIN_STAGE_GAP_DAYS = 3;

export interface ValidationOptions {
  /**
   * Also apply rules that only describe the generated seed data (exactly 75
   * leads, at least 3 days per stage, 2-8 activities). Real edits break these
   * legitimately, so they are off by default.
   */
  seedRules?: boolean;
}

/** Returns a message for every broken stageHistory rule. */
function checkStageHistory(lead: Lead, seedRules: boolean): string[] {
  const problems: string[] = [];
  const history = lead.stageHistory;
  if (history.length === 0) return ["stageHistory is empty"];

  if (history[0].stage !== "new") problems.push(`history starts at "${history[0].stage}", not "new"`);
  if (history[0].startDate !== lead.createdAt) problems.push("first stage does not start at createdAt");

  const last = history[history.length - 1];
  if (last.stage !== lead.stage) problems.push(`last history stage "${last.stage}" != lead.stage "${lead.stage}"`);
  if (last.endDate !== null) problems.push("current stage has a non-null endDate");

  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    if (toDateKey(entry.startDate) > TODAY) problems.push(`${entry.stage} starts after TODAY`);
    if (i === history.length - 1) continue;

    const next = history[i + 1];
    if (entry.endDate === null) problems.push(`${entry.stage} has null endDate but is not the last entry`);
    else if (entry.endDate !== next.startDate) problems.push(`${entry.stage} endDate does not match next startDate`);

    // Forward one step at a time, or exit to "lost" from any active stage.
    const expectedNext = PIPELINE_ORDER[PIPELINE_ORDER.indexOf(entry.stage) + 1];
    const legal = next.stage === expectedNext || (next.stage === "lost" && isActiveStage(entry.stage));
    if (!legal) problems.push(`illegal move ${entry.stage} -> ${next.stage}`);

    if (next.startDate <= entry.startDate) problems.push(`${next.stage} does not start after ${entry.stage}`);
    if (seedRules && daysBetween(entry.startDate, next.startDate) < MIN_STAGE_GAP_DAYS) {
      problems.push(`${entry.stage} lasted under ${MIN_STAGE_GAP_DAYS} days`);
    }
  }
  return problems;
}

function checkDates(lead: Lead, seedRules: boolean): string[] {
  const problems: string[] = [];
  const active = isActiveStage(lead.stage);
  const finalStart = lead.stageHistory[lead.stageHistory.length - 1]?.startDate;

  if (active && lead.closedAt !== null) problems.push("active lead has closedAt");
  if (!active && lead.closedAt !== finalStart) problems.push("closedAt does not equal final stage start");
  if (!active && lead.nextFollowUpAt !== null) problems.push("closed lead has nextFollowUpAt");
  if (toDateKey(lead.createdAt) > TODAY) problems.push("createdAt is after TODAY");

  const lifetimeEnd = lead.closedAt ?? TODAY;
  for (const a of lead.activities) {
    if (a.date < lead.createdAt) problems.push(`activity ${a.id} is before createdAt`);
    if (toDateKey(a.date) > toDateKey(lifetimeEnd)) problems.push(`activity ${a.id} is after the lead's lifetime`);
  }

  const stageChanges = lead.activities.filter((a) => a.type === "stage_change").length;
  if (stageChanges !== lead.stageHistory.length - 1) {
    problems.push(`${stageChanges} stage_change activities for ${lead.stageHistory.length - 1} transitions`);
  }
  if (seedRules && (lead.activities.length < 2 || lead.activities.length > 8)) {
    problems.push(`${lead.activities.length} activities (expected 2-8)`);
  }
  return problems;
}

function checkOwner(lead: Lead): string[] {
  const owner = getUserById(lead.ownerId);
  if (!owner) return [`owner ${lead.ownerId} does not exist`];
  if (owner.role !== "sales_agent") return [`owner ${owner.name} is not a sales agent`];
  return [];
}

export function validateLeads(leads: Lead[], { seedRules = false }: ValidationOptions = {}): ValidationResult {
  const errors: ValidationError[] = [];
  const dataset = (message: string) => errors.push({ leadId: "-", companyName: "(dataset)", message });

  if (seedRules && leads.length !== EXPECTED_LEAD_COUNT) dataset(`expected ${EXPECTED_LEAD_COUNT} leads, found ${leads.length}`);

  const seen = new Set<string>();
  for (const lead of leads) {
    if (seen.has(lead.id)) dataset(`duplicate id ${lead.id}`);
    seen.add(lead.id);

    for (const message of [...checkStageHistory(lead, seedRules), ...checkDates(lead, seedRules), ...checkOwner(lead)]) {
      errors.push({ leadId: lead.id, companyName: lead.companyName, message });
    }
  }
  return { valid: errors.length === 0, errors };
}
