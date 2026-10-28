export type LeadStage =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type LeadSource =
  | "linkedin"
  | "referral"
  | "cold_email"
  | "cold_call"
  | "website"
  | "event"
  | "partner";

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
  // Contact details: owner and admin only.
  pocDesignation: string;
  pocEmail: string;
  pocPhone: string;
  pocLinkedIn?: string;
  industry: string;
  companySize: CompanySize;
  city: string;
  source: LeadSource;
  stage: LeadStage;
  priority: LeadPriority;
  /** Whole rupees. */
  dealValue: number;
  currency: "INR";
  /** References User.id of the owning sales agent. */
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
