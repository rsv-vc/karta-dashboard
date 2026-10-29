import type { Database } from "@/types/supabase";
import type { ActivityEntry, Lead, LeadDirectoryEntry, StageHistoryEntry } from "@/types/lead";

// Database rows <-> app domain types. User ids are the auth UUIDs on both
// sides; timestamps need converting: Postgres returns UTC
// ("2026-10-28T04:30:00+00:00") and the app compares IST strings
// ("2026-10-28T10:00:00+05:30").

type Tables = Database["public"]["Tables"];
export type LeadDbRow = Tables["leads"]["Row"];
export type HistoryDbRow = Tables["lead_stage_history"]["Row"];
export type ActivityDbRow = Tables["lead_activities"]["Row"];
export type LeadDbRowWithRelations = LeadDbRow & {
  lead_stage_history: HistoryDbRow[];
  lead_activities: ActivityDbRow[];
};
export type DirectoryDbRow = Database["public"]["Functions"]["lead_directory"]["Returns"][number];

const IST_OFFSET_MS = 330 * 60_000;

/** Any Postgres timestamptz string -> "YYYY-MM-DDTHH:MM:00+05:30". */
export function toIst(value: string): string {
  const shifted = new Date(Date.parse(value) + IST_OFFSET_MS).toISOString();
  return `${shifted.slice(0, 16)}:00+05:30`;
}

export const toIstOrNull = (value: string | null) => (value ? toIst(value) : null);

export function toLead(row: LeadDbRowWithRelations): Lead {
  const stageHistory: StageHistoryEntry[] = [...row.lead_stage_history]
    .sort((a, b) => a.start_at.localeCompare(b.start_at) || a.id - b.id)
    .map((h) => ({ stage: h.stage, startDate: toIst(h.start_at), endDate: toIstOrNull(h.end_at) }));

  const activities: ActivityEntry[] = [...row.lead_activities]
    .sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id)
    .map((a) => ({
      id: `a${a.id}`,
      type: a.type,
      description: a.description,
      date: toIst(a.at),
      byUserId: a.by_user_id,
    }));

  return {
    id: row.id,
    companyName: row.company_name,
    pocName: row.poc_name,
    pocDesignation: row.poc_designation,
    pocEmail: row.poc_email ?? "",
    pocPhone: row.poc_phone ?? "",
    pocLinkedIn: row.poc_linkedin ?? undefined,
    industry: row.industry,
    companySize: row.company_size,
    city: row.city ?? "",
    source: row.source,
    stage: row.stage,
    priority: row.priority,
    dealValue: row.deal_value,
    currency: "INR",
    volume: row.volume,
    callsPerMonth: row.calls_per_month,
    minutesPerCall: row.minutes_per_call === null ? null : Number(row.minutes_per_call),
    pricePerMinute: row.price_per_minute === null ? null : Number(row.price_per_minute),
    contractMonths: row.contract_months,
    responsiveness: row.responsiveness,
    decisionAccess: row.decision_access,
    timingBudget: row.timing_budget,
    discoveryDate: row.discovery_date,
    discoveryMonth: row.discovery_month?.slice(0, 7) ?? null,
    nextStep: row.next_step,
    sourceStatus: row.source_status,
    ownerId: row.owner_id,
    createdAt: toIst(row.created_at),
    lastContactedAt: toIstOrNull(row.last_contacted_at),
    nextFollowUpAt: toIstOrNull(row.next_follow_up_at),
    closedAt: toIstOrNull(row.closed_at),
    notes: row.notes,
    stageHistory,
    activities,
  };
}

export function toDirectoryEntryFromDb(row: DirectoryDbRow): LeadDirectoryEntry {
  return {
    id: row.id,
    companyName: row.company_name,
    pocName: row.poc_name,
    ownerId: row.owner_id,
    stage: row.stage,
  };
}

/** A full app Lead -> insert rows (used by the seed script). */
export function toDbInsert(lead: Lead): {
  lead: Tables["leads"]["Insert"];
  history: Tables["lead_stage_history"]["Insert"][];
  activities: Tables["lead_activities"]["Insert"][];
} {
  return {
    lead: {
      id: lead.id,
      company_name: lead.companyName,
      poc_name: lead.pocName,
      poc_designation: lead.pocDesignation,
      poc_email: lead.pocEmail || null,
      poc_phone: lead.pocPhone || null,
      poc_linkedin: lead.pocLinkedIn ?? null,
      industry: lead.industry,
      company_size: lead.companySize,
      city: lead.city || null,
      source: lead.source,
      stage: lead.stage,
      priority: lead.priority,
      deal_value: lead.dealValue,
      currency: lead.currency,
      volume: lead.volume,
      calls_per_month: lead.callsPerMonth,
      minutes_per_call: lead.minutesPerCall,
      price_per_minute: lead.pricePerMinute,
      contract_months: lead.contractMonths,
      responsiveness: lead.responsiveness,
      decision_access: lead.decisionAccess,
      timing_budget: lead.timingBudget,
      discovery_date: lead.discoveryDate,
      discovery_month: lead.discoveryMonth ? `${lead.discoveryMonth}-01` : null,
      next_step: lead.nextStep,
      source_status: lead.sourceStatus,
      owner_id: lead.ownerId,
      created_at: lead.createdAt,
      last_contacted_at: lead.lastContactedAt,
      next_follow_up_at: lead.nextFollowUpAt,
      closed_at: lead.closedAt,
      notes: lead.notes,
    },
    history: lead.stageHistory.map((h) => ({
      lead_id: lead.id,
      stage: h.stage,
      start_at: h.startDate,
      end_at: h.endDate,
    })),
    activities: lead.activities.map((a) => ({
      lead_id: lead.id,
      type: a.type,
      description: a.description,
      at: a.date,
      by_user_id: a.byUserId,
    })),
  };
}
