/** The Karta sales stages (the MIS workbook's Scoring Guide). */
export type LeadStage =
  | "not_met"
  | "no_show"
  | "discovery_done"
  | "follow_up"
  | "technical_round"
  | "poc_pitched"
  | "poc_approved"
  | "poc_ongoing"
  | "won"
  | "deferred"
  | "lost";

export type LeadSource =
  | "linkedin"
  | "referral"
  | "cold_email"
  | "cold_call"
  | "website"
  | "event"
  | "partner"
  | "pipeloom"
  | "voice_bot"
  | "head_of_growth";

export type LeadPriority = "low" | "medium" | "high";

export type CompanySize = "1-10" | "11-50" | "51-200" | "201-1000" | "1000+";

export interface StageHistoryEntry {
  stage: LeadStage;
  /** ISO timestamp the lead entered this stage. */
  startDate: string;
  /** ISO timestamp the lead left this stage; null means this is the current stage. */
  endDate: string | null;
}

export type ActivityType = "call" | "email" | "meeting" | "note" | "stage_change";

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  description: string;
  /** ISO timestamp. */
  date: string;
  byUserId: string;
}

export interface Lead {
  id: string;
  // Visible to everyone (also part of the masked directory view).
  companyName: string;
  pocName: string;
  // Contact details: owner and admin only. Email, phone, city and size are
  // optional ("" / null): the workbook keeps contacts in the source trackers.
  pocDesignation: string;
  pocEmail: string;
  pocPhone: string;
  pocLinkedIn?: string;
  /** The account's segment (NBFC, Fintech, …); stored in the industry column. */
  industry: string;
  companySize: CompanySize | null;
  city: string;
  source: LeadSource;
  stage: LeadStage;
  priority: LeadPriority;
  /** Whole rupees; 0 = not set. */
  dealValue: number;
  currency: "INR";
  /** Volume the account would run (e.g. calls a month); null = unknown. */
  volume: number | null;
  /** Score inputs (the Scoring Guide): 0–10, 0–10, 0–5. */
  responsiveness: number;
  decisionAccess: number;
  timingBudget: number;
  /** "YYYY-MM-DD" of the first discovery meeting held, and its month "YYYY-MM". */
  discoveryDate: string | null;
  discoveryMonth: string | null;
  /** What happens next; its date is nextFollowUpAt. */
  nextStep: string;
  /** Raw status from an imported source tracker (read only). */
  sourceStatus: string | null;
  /** References User.id of the owner (a sales agent or an admin). */
  ownerId: string;
  createdAt: string;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  closedAt: string | null;
  notes: string;
  stageHistory: StageHistoryEntry[];
  activities: ActivityEntry[];
}

/**
 * The masked view of a lead. This is the shape the future backend returns to a
 * sales agent for leads they do NOT own, so they can avoid chasing the same
 * company. Sensitive fields (contact details, deal value, notes, activities)
 * must never reach those agents.
 */
export type LeadDirectoryEntry = Pick<Lead, "id" | "companyName" | "pocName" | "ownerId" | "stage">;
