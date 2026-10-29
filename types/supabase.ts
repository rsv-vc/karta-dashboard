// Generated from the Supabase schema (Supabase MCP generate_typescript_types).
// Regenerate after every migration; do not edit by hand.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: false;
  referencedRelation: string;
  referencedColumns: string[];
};

type Enums = {
  action_status: "open" | "started" | "scheduled" | "pending_approval" | "under_review" | "done";
  activity_type: "call" | "email" | "meeting" | "note" | "stage_change";
  app_role: "admin" | "sales_agent";
  company_size: "1-10" | "11-50" | "51-200" | "201-1000" | "1000+";
  lead_priority: "low" | "medium" | "high";
  lead_source:
    | "linkedin"
    | "referral"
    | "cold_email"
    | "cold_call"
    | "website"
    | "event"
    | "partner"
    | "pipeloom"
    | "voice_bot"
    | "head_of_growth"
    | "unknown";
  lead_stage:
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
  user_status: "active" | "inactive";
};

type LeadRow = {
  calls_per_month: number | null;
  city: string | null;
  closed_at: string | null;
  company_name: string;
  company_size: Enums["company_size"] | null;
  contract_months: number | null;
  created_at: string;
  currency: string;
  deal_value: number;
  decision_access: number;
  drop_note: string;
  drop_reason_id: number | null;
  discovery_date: string | null;
  discovery_month: string | null;
  id: string;
  industry: string;
  last_contacted_at: string | null;
  minutes_per_call: number | null;
  next_follow_up_at: string | null;
  next_step: string;
  notes: string;
  owner_id: string;
  poc_designation: string;
  poc_email: string | null;
  poc_linkedin: string | null;
  poc_name: string;
  poc_phone: string | null;
  price_per_minute: number | null;
  priority: Enums["lead_priority"];
  responsiveness: number;
  source: Enums["lead_source"];
  source_status: string | null;
  stage: Enums["lead_stage"];
  timing_budget: number;
  updated_at: string;
  volume: number | null;
};

type FunnelActionRow = {
  due_label: string;
  fix: string;
  funnel: number;
  id: number;
  owner_label: string;
  position: number;
  problem: string;
  status: Enums["action_status"];
  updated_at: string;
};

type ProfileRow = {
  email: string;
  id: string;
  is_demo: boolean;
  joined_at: string;
  must_change_password: boolean;
  name: string;
  notifications_seen_at: string | null;
  role: Enums["app_role"];
  status: Enums["user_status"];
  title: string;
};

/** Stage is null for other people's accounts when the viewer is a sales agent. */
type MaskedLead = { company_name: string; id: string; owner_id: string; poc_name: string; stage: Enums["lead_stage"] | null };

type IndustryRow = { name: string; avg_calls_per_month: number | null; minutes_per_call: number; position: number; active: boolean };
type CityRow = { name: string; position: number; active: boolean };
type StageSettingRow = { stage: Enums["lead_stage"]; label: string; points: number };
type DropReasonRow = { id: number; label: string; applies_to: "lost" | "deferred" | "both"; position: number; active: boolean };
type SettingsRow = {
  company_domains: string[];
  id: boolean;
  today: string | null;
  price_per_minute: number;
  price_low: number;
  price_high: number;
  minutes_per_call: number;
  contract_months: number;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      allowed_emails: {
        Row: { added_at: string; added_by: string | null; email: string };
        Insert: { added_at?: string; added_by?: string | null; email: string };
        Update: { added_at?: string; added_by?: string | null; email?: string };
        Relationships: [Rel];
      };
      app_settings: {
        Row: SettingsRow;
        Insert: Partial<SettingsRow>;
        Update: Partial<SettingsRow>;
        Relationships: [];
      };
      cities: {
        Row: CityRow;
        Insert: Partial<CityRow> & Pick<CityRow, "name">;
        Update: Partial<CityRow>;
        Relationships: [];
      };
      drop_reasons: {
        Row: DropReasonRow;
        Insert: Partial<Omit<DropReasonRow, "id">> & { label: string; id?: never };
        Update: Partial<Omit<DropReasonRow, "id">> & { id?: never };
        Relationships: [];
      };
      industries: {
        Row: IndustryRow;
        Insert: Partial<IndustryRow> & Pick<IndustryRow, "name">;
        Update: Partial<IndustryRow>;
        Relationships: [];
      };
      stage_settings: {
        Row: StageSettingRow;
        Insert: StageSettingRow;
        Update: Partial<StageSettingRow>;
        Relationships: [];
      };
      funnel_actions: {
        Row: FunnelActionRow;
        Insert: Partial<Omit<FunnelActionRow, "id">> & { funnel: number; problem: string; id?: never };
        Update: Partial<Omit<FunnelActionRow, "id">> & { id?: never };
        Relationships: [];
      };
      lead_activities: {
        Row: {
          at: string;
          by_user_id: string;
          description: string;
          id: number;
          lead_id: string;
          type: Enums["activity_type"];
        };
        Insert: {
          at: string;
          by_user_id: string;
          description: string;
          id?: never;
          lead_id: string;
          type: Enums["activity_type"];
        };
        Update: {
          at?: string;
          by_user_id?: string;
          description?: string;
          id?: never;
          lead_id?: string;
          type?: Enums["activity_type"];
        };
        Relationships: [Rel, Rel];
      };
      lead_stage_history: {
        Row: { end_at: string | null; id: number; lead_id: string; stage: Enums["lead_stage"]; start_at: string };
        Insert: { end_at?: string | null; id?: never; lead_id: string; stage: Enums["lead_stage"]; start_at: string };
        Update: { end_at?: string | null; id?: never; lead_id?: string; stage?: Enums["lead_stage"]; start_at?: string };
        Relationships: [Rel];
      };
      leads: {
        Row: LeadRow;
        Insert: Partial<LeadRow> & Pick<LeadRow, "company_name" | "industry" | "owner_id" | "poc_name" | "source">;
        Update: Partial<LeadRow>;
        Relationships: [Rel];
      };
      monthly_targets: {
        Row: { month: string; new_leads: number; user_id: string; won_value: number };
        Insert: { month: string; new_leads: number; user_id: string; won_value: number };
        Update: { month?: string; new_leads?: number; user_id?: string; won_value?: number };
        Relationships: [Rel];
      };
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & Pick<ProfileRow, "email" | "id" | "name">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      admin_update_member: {
        Args: { p_id: string; p_role: Enums["app_role"]; p_status: Enums["user_status"] };
        Returns: undefined;
      };
      change_lead_stage: {
        Args: {
          p_final_deal_value?: number;
          p_lead_id: string;
          p_lost_reason?: string;
          p_note?: string;
          p_reason_id?: number;
          p_to: Enums["lead_stage"];
        };
        Returns: undefined;
      };
      create_lead: { Args: { p: Json }; Returns: string };
      find_possible_duplicates: { Args: { p_exclude_id?: string; p_name: string }; Returns: MaskedLead[] };
      lead_directory: { Args: never; Returns: MaskedLead[] };
      log_activity: {
        Args: {
          p_date: string;
          p_description: string;
          p_lead_id: string;
          p_next_follow_up?: string;
          p_type: Enums["activity_type"];
        };
        Returns: undefined;
      };
      reassign_leads: { Args: { p_lead_ids: string[]; p_to: string }; Returns: number };
      sync_lead_sequence: { Args: never; Returns: number };
    };
    Enums: Enums;
    CompositeTypes: { [_ in never]: never };
  };
};
