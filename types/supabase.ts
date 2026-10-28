// Generated from the Supabase schema (Supabase MCP generate_typescript_types).
// Regenerate after every migration; do not edit by hand.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      app_settings: {
        Row: { id: boolean; today: string | null };
        Insert: { id?: boolean; today?: string | null };
        Update: { id?: boolean; today?: string | null };
        Relationships: [];
      };
      lead_activities: {
        Row: {
          at: string;
          by_user_id: string;
          description: string;
          id: number;
          lead_id: string;
          type: Database["public"]["Enums"]["activity_type"];
        };
        Insert: {
          at: string;
          by_user_id: string;
          description: string;
          id?: never;
          lead_id: string;
          type: Database["public"]["Enums"]["activity_type"];
        };
        Update: {
          at?: string;
          by_user_id?: string;
          description?: string;
          id?: never;
          lead_id?: string;
          type?: Database["public"]["Enums"]["activity_type"];
        };
        Relationships: [
          {
            foreignKeyName: "lead_activities_by_user_id_fkey";
            columns: ["by_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_activities_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_stage_history: {
        Row: {
          end_at: string | null;
          id: number;
          lead_id: string;
          stage: Database["public"]["Enums"]["lead_stage"];
          start_at: string;
        };
        Insert: {
          end_at?: string | null;
          id?: never;
          lead_id: string;
          stage: Database["public"]["Enums"]["lead_stage"];
          start_at: string;
        };
        Update: {
          end_at?: string | null;
          id?: never;
          lead_id?: string;
          stage?: Database["public"]["Enums"]["lead_stage"];
          start_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          city: string;
          closed_at: string | null;
          company_name: string;
          company_size: Database["public"]["Enums"]["company_size"];
          created_at: string;
          currency: string;
          deal_value: number;
          id: string;
          industry: string;
          last_contacted_at: string | null;
          next_follow_up_at: string | null;
          notes: string;
          owner_id: string;
          poc_designation: string;
          poc_email: string;
          poc_linkedin: string | null;
          poc_name: string;
          poc_phone: string;
          priority: Database["public"]["Enums"]["lead_priority"];
          source: Database["public"]["Enums"]["lead_source"];
          stage: Database["public"]["Enums"]["lead_stage"];
          updated_at: string;
        };
        Insert: {
          city: string;
          closed_at?: string | null;
          company_name: string;
          company_size: Database["public"]["Enums"]["company_size"];
          created_at?: string;
          currency?: string;
          deal_value: number;
          id?: string;
          industry: string;
          last_contacted_at?: string | null;
          next_follow_up_at?: string | null;
          notes?: string;
          owner_id: string;
          poc_designation?: string;
          poc_email: string;
          poc_linkedin?: string | null;
          poc_name: string;
          poc_phone: string;
          priority?: Database["public"]["Enums"]["lead_priority"];
          source: Database["public"]["Enums"]["lead_source"];
          stage?: Database["public"]["Enums"]["lead_stage"];
          updated_at?: string;
        };
        Update: {
          city?: string;
          closed_at?: string | null;
          company_name?: string;
          company_size?: Database["public"]["Enums"]["company_size"];
          created_at?: string;
          currency?: string;
          deal_value?: number;
          id?: string;
          industry?: string;
          last_contacted_at?: string | null;
          next_follow_up_at?: string | null;
          notes?: string;
          owner_id?: string;
          poc_designation?: string;
          poc_email?: string;
          poc_linkedin?: string | null;
          poc_name?: string;
          poc_phone?: string;
          priority?: Database["public"]["Enums"]["lead_priority"];
          source?: Database["public"]["Enums"]["lead_source"];
          stage?: Database["public"]["Enums"]["lead_stage"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_targets: {
        Row: { month: string; new_leads: number; user_id: string; won_value: number };
        Insert: { month: string; new_leads: number; user_id: string; won_value: number };
        Update: { month?: string; new_leads?: number; user_id?: string; won_value?: number };
        Relationships: [
          {
            foreignKeyName: "monthly_targets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          email: string;
          id: string;
          joined_at: string;
          name: string;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["user_status"];
          title: string;
        };
        Insert: {
          email: string;
          id: string;
          joined_at?: string;
          name: string;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["user_status"];
          title?: string;
        };
        Update: {
          email?: string;
          id?: string;
          joined_at?: string;
          name?: string;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["user_status"];
          title?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      change_lead_stage: {
        Args: {
          p_final_deal_value?: number;
          p_lead_id: string;
          p_lost_reason?: string;
          p_note?: string;
          p_to: Database["public"]["Enums"]["lead_stage"];
        };
        Returns: undefined;
      };
      create_lead: { Args: { p: Json }; Returns: string };
      find_possible_duplicates: {
        Args: { p_exclude_id?: string; p_name: string };
        Returns: {
          company_name: string;
          id: string;
          owner_id: string;
          poc_name: string;
          stage: Database["public"]["Enums"]["lead_stage"];
        }[];
      };
      lead_directory: {
        Args: never;
        Returns: {
          company_name: string;
          id: string;
          owner_id: string;
          poc_name: string;
          stage: Database["public"]["Enums"]["lead_stage"];
        }[];
      };
      log_activity: {
        Args: {
          p_date: string;
          p_description: string;
          p_lead_id: string;
          p_next_follow_up?: string;
          p_type: Database["public"]["Enums"]["activity_type"];
        };
        Returns: undefined;
      };
      reassign_leads: { Args: { p_lead_ids: string[]; p_to: string }; Returns: number };
      sync_lead_sequence: { Args: never; Returns: number };
    };
    Enums: {
      activity_type: "call" | "email" | "meeting" | "note" | "stage_change";
      app_role: "admin" | "sales_agent";
      company_size: "1-10" | "11-50" | "51-200" | "201-1000" | "1000+";
      lead_priority: "low" | "medium" | "high";
      lead_source: "linkedin" | "referral" | "cold_email" | "cold_call" | "website" | "event" | "partner";
      lead_stage: "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
      user_status: "active" | "inactive";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
