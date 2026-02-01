export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      templates: {
        Row: {
          id: string
          name: string
          description: string | null
          is_system: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_system?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_system?: boolean
          created_by?: string | null
          created_at?: string
        }
      }
      template_sections: {
        Row: {
          id: string
          template_id: string
          name: string
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          name: string
          order_index?: number
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          name?: string
          order_index?: number
          created_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          template_id: string | null
          title: string
          status: 'draft' | 'active' | 'completed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          template_id?: string | null
          title: string
          status?: 'draft' | 'active' | 'completed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          template_id?: string | null
          title?: string
          status?: 'draft' | 'active' | 'completed'
          created_at?: string
          updated_at?: string
        }
      }
      session_objectives: {
        Row: {
          id: string
          session_id: string
          content: string
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          content: string
          order_index?: number
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          content?: string
          order_index?: number
          created_at?: string
        }
      }
      session_checklist_items: {
        Row: {
          id: string
          session_id: string
          content: string
          is_checked: boolean
          is_default: boolean
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          content: string
          is_checked?: boolean
          is_default?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          content?: string
          is_checked?: boolean
          is_default?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      constraints: {
        Row: {
          id: string
          user_id: string
          type: string
          label: string
          value: string | null
          is_system: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          label: string
          value?: string | null
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          label?: string
          value?: string | null
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      session_constraints: {
        Row: {
          id: string
          session_id: string
          constraint_id: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          constraint_id: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          constraint_id?: string
          created_at?: string
        }
      }
      sections: {
        Row: {
          id: string
          session_id: string
          name: string
          section_type: SectionType
          order_index: number
          position_x: number
          position_y: number
          width: number
          height: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          name: string
          section_type?: SectionType
          order_index?: number
          position_x?: number
          position_y?: number
          width?: number
          height?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          name?: string
          section_type?: SectionType
          order_index?: number
          position_x?: number
          position_y?: number
          width?: number
          height?: number
          created_at?: string
          updated_at?: string
        }
      }
      sticky_notes: {
        Row: {
          id: string
          section_id: string
          content: string
          position_x: number
          position_y: number
          has_evidence: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          section_id: string
          content: string
          position_x?: number
          position_y?: number
          has_evidence?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          section_id?: string
          content?: string
          position_x?: number
          position_y?: number
          has_evidence?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      evidence: {
        Row: {
          id: string
          sticky_note_id: string
          type: 'url' | 'text'
          url: string | null
          content: string | null
          title: string | null
          strength: 'high' | 'medium' | 'low'
          created_at: string
        }
        Insert: {
          id?: string
          sticky_note_id: string
          type: 'url' | 'text'
          url?: string | null
          content?: string | null
          title?: string | null
          strength?: 'high' | 'medium' | 'low'
          created_at?: string
        }
        Update: {
          id?: string
          sticky_note_id?: string
          type?: 'url' | 'text'
          url?: string | null
          content?: string | null
          title?: string | null
          strength?: 'high' | 'medium' | 'low'
          created_at?: string
        }
      }
      sticky_note_links: {
        Row: {
          id: string
          source_note_id: string
          target_note_id: string
          created_at: string
        }
        Insert: {
          id?: string
          source_note_id: string
          target_note_id: string
          created_at?: string
        }
        Update: {
          id?: string
          source_note_id?: string
          target_note_id?: string
          created_at?: string
        }
      }
      session_analyses: {
        Row: {
          id: string
          session_id: string
          objective_score: number | null
          summary: string | null
          assumptions: Json | null
          evidence_backed: Json | null
          validation_recommendations: Json | null
          constraint_analysis: Json | null
          checklist_review: Json | null
          raw_response: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          objective_score?: number | null
          summary?: string | null
          assumptions?: Json | null
          evidence_backed?: Json | null
          validation_recommendations?: Json | null
          constraint_analysis?: Json | null
          checklist_review?: Json | null
          raw_response?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          objective_score?: number | null
          summary?: string | null
          assumptions?: Json | null
          evidence_backed?: Json | null
          validation_recommendations?: Json | null
          constraint_analysis?: Json | null
          checklist_review?: Json | null
          raw_response?: Json | null
          created_at?: string
        }
      }
      // Phase 2: Workspaces & Evidence Bank
      workspaces: {
        Row: {
          id: string
          name: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          joined_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member'
          joined_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          joined_at?: string
        }
      }
      evidence_bank: {
        Row: {
          id: string
          workspace_id: string
          title: string
          type: 'url' | 'text'
          url: string | null
          content: string | null
          strength: 'high' | 'medium' | 'low'
          source_system: SourceSystemExpanded
          source_metadata: Json
          tags: string[]
          created_by: string | null
          created_at: string
          updated_at: string
          // Phase A: Evidence Strength columns
          source_weight: number
          recency_factor: number
          sentiment: 'positive' | 'negative' | 'neutral' | null
          segment: string | null
          computed_strength: number
          source_timestamp: string | null
          // Phase D: Vector Search
          embedding: number[] | null
        }
        Insert: {
          id?: string
          workspace_id: string
          title: string
          type: 'url' | 'text'
          url?: string | null
          content?: string | null
          strength?: 'high' | 'medium' | 'low'
          source_system?: SourceSystemExpanded
          source_metadata?: Json
          tags?: string[]
          created_by?: string | null
          created_at?: string
          updated_at?: string
          // Phase A: Evidence Strength columns
          source_weight?: number
          recency_factor?: number
          sentiment?: 'positive' | 'negative' | 'neutral' | null
          segment?: string | null
          computed_strength?: number
          source_timestamp?: string | null
          // Phase D: Vector Search
          embedding?: number[] | null
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          type?: 'url' | 'text'
          url?: string | null
          content?: string | null
          strength?: 'high' | 'medium' | 'low'
          source_system?: SourceSystemExpanded
          source_metadata?: Json
          tags?: string[]
          created_by?: string | null
          created_at?: string
          updated_at?: string
          // Phase A: Evidence Strength columns
          source_weight?: number
          recency_factor?: number
          sentiment?: 'positive' | 'negative' | 'neutral' | null
          segment?: string | null
          computed_strength?: number
          source_timestamp?: string | null
          // Phase D: Vector Search
          embedding?: number[] | null
        }
      }
      sticky_note_evidence_links: {
        Row: {
          id: string
          sticky_note_id: string
          evidence_bank_id: string
          linked_at: string
        }
        Insert: {
          id?: string
          sticky_note_id: string
          evidence_bank_id: string
          linked_at?: string
        }
        Update: {
          id?: string
          sticky_note_id?: string
          evidence_bank_id?: string
          linked_at?: string
        }
      }
      insights_feed: {
        Row: {
          id: string
          workspace_id: string
          source_system: 'slack' | 'notion' | 'mixpanel' | 'airtable'
          title: string
          content: string | null
          url: string | null
          strength: 'high' | 'medium' | 'low'
          source_metadata: Json
          is_added_to_bank: boolean
          is_dismissed: boolean
          fetched_at: string
          created_at: string
          // Phase 4: AI Analysis Fields
          ai_summary: string | null
          ai_themes: Json
          ai_action_items: Json
          source_url: string | null
          pain_points: Json
          feature_requests: Json
          sentiment: string | null
          key_quotes: Json
          tags: Json
          analysis_id: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          source_system: 'slack' | 'notion' | 'mixpanel' | 'airtable'
          title: string
          content?: string | null
          url?: string | null
          strength?: 'high' | 'medium' | 'low'
          source_metadata?: Json
          is_added_to_bank?: boolean
          is_dismissed?: boolean
          fetched_at?: string
          created_at?: string
          // Phase 4: AI Analysis Fields
          ai_summary?: string | null
          ai_themes?: Json
          ai_action_items?: Json
          source_url?: string | null
          pain_points?: Json
          feature_requests?: Json
          sentiment?: string | null
          key_quotes?: Json
          tags?: Json
          analysis_id?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          source_system?: 'slack' | 'notion' | 'mixpanel' | 'airtable'
          title?: string
          content?: string | null
          url?: string | null
          strength?: 'high' | 'medium' | 'low'
          source_metadata?: Json
          is_added_to_bank?: boolean
          is_dismissed?: boolean
          fetched_at?: string
          created_at?: string
          // Phase 4: AI Analysis Fields
          ai_summary?: string | null
          ai_themes?: Json
          ai_action_items?: Json
          source_url?: string | null
          pain_points?: Json
          feature_requests?: Json
          sentiment?: string | null
          key_quotes?: Json
          tags?: Json
          analysis_id?: string | null
        }
      }
      workspace_settings: {
        Row: {
          id: string
          workspace_id: string
          feed_schedule_time: string
          feed_timezone: string
          feed_enabled: boolean
          slack_enabled: boolean
          slack_webhook_url: string | null
          notion_enabled: boolean
          notion_webhook_url: string | null
          mixpanel_enabled: boolean
          mixpanel_webhook_url: string | null
          airtable_enabled: boolean
          airtable_webhook_url: string | null
          last_fetch_at: string | null
          updated_at: string
          // Phase A: Evidence Strength configuration
          weight_config: Json
          weight_template: WeightTemplate
          recency_config: Json
          target_segments: string[]
        }
        Insert: {
          id?: string
          workspace_id: string
          feed_schedule_time?: string
          feed_timezone?: string
          feed_enabled?: boolean
          slack_enabled?: boolean
          slack_webhook_url?: string | null
          notion_enabled?: boolean
          notion_webhook_url?: string | null
          mixpanel_enabled?: boolean
          mixpanel_webhook_url?: string | null
          airtable_enabled?: boolean
          airtable_webhook_url?: string | null
          last_fetch_at?: string | null
          updated_at?: string
          // Phase A: Evidence Strength configuration
          weight_config?: Json
          weight_template?: WeightTemplate
          recency_config?: Json
          target_segments?: string[]
        }
        Update: {
          id?: string
          workspace_id?: string
          feed_schedule_time?: string
          feed_timezone?: string
          feed_enabled?: boolean
          slack_enabled?: boolean
          slack_webhook_url?: string | null
          notion_enabled?: boolean
          notion_webhook_url?: string | null
          mixpanel_enabled?: boolean
          mixpanel_webhook_url?: string | null
          airtable_enabled?: boolean
          airtable_webhook_url?: string | null
          last_fetch_at?: string | null
          updated_at?: string
          // Phase A: Evidence Strength configuration
          weight_config?: Json
          weight_template?: WeightTemplate
          recency_config?: Json
          target_segments?: string[]
        }
      }
      // Phase 4: Daily Insights Analysis
      daily_insights_analysis: {
        Row: {
          id: string
          workspace_id: string
          analysis_date: string
          insight_count: number
          sources_included: string[]
          summary: string | null
          themes: Json | null
          patterns: Json | null
          priorities: Json | null
          cross_source_connections: Json | null
          action_items: Json | null
          raw_response: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          analysis_date: string
          insight_count?: number
          sources_included?: string[]
          summary?: string | null
          themes?: Json | null
          patterns?: Json | null
          priorities?: Json | null
          cross_source_connections?: Json | null
          action_items?: Json | null
          raw_response?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          analysis_date?: string
          insight_count?: number
          sources_included?: string[]
          summary?: string | null
          themes?: Json | null
          patterns?: Json | null
          priorities?: Json | null
          cross_source_connections?: Json | null
          action_items?: Json | null
          raw_response?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      // Phase 4: Workspace Evidence Sources Configuration
      workspace_evidence_sources: {
        Row: {
          id: string
          workspace_id: string
          slack_enabled: boolean
          slack_channel_ids: string[]
          notion_enabled: boolean
          notion_database_ids: string[]
          airtable_enabled: boolean
          airtable_sources: Json
          mixpanel_enabled: boolean
          auto_fetch_enabled: boolean
          auto_fetch_time: string
          lookback_hours: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          slack_enabled?: boolean
          slack_channel_ids?: string[]
          notion_enabled?: boolean
          notion_database_ids?: string[]
          airtable_enabled?: boolean
          airtable_sources?: Json
          mixpanel_enabled?: boolean
          auto_fetch_enabled?: boolean
          auto_fetch_time?: string
          lookback_hours?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          slack_enabled?: boolean
          slack_channel_ids?: string[]
          notion_enabled?: boolean
          notion_database_ids?: string[]
          airtable_enabled?: boolean
          airtable_sources?: Json
          mixpanel_enabled?: boolean
          auto_fetch_enabled?: boolean
          auto_fetch_time?: string
          lookback_hours?: number
          created_at?: string
          updated_at?: string
        }
      }
      // Phase 3: Team Collaboration
      workspace_invites: {
        Row: {
          id: string
          workspace_id: string
          invite_code: string
          created_by: string | null
          role: 'admin' | 'member'
          expires_at: string | null
          max_uses: number | null
          use_count: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          invite_code: string
          created_by?: string | null
          role?: 'admin' | 'member'
          expires_at?: string | null
          max_uses?: number | null
          use_count?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          invite_code?: string
          created_by?: string | null
          role?: 'admin' | 'member'
          expires_at?: string | null
          max_uses?: number | null
          use_count?: number
          is_active?: boolean
          created_at?: string
        }
      }
      // Phase B: Decisions
      decisions: {
        Row: {
          id: string
          workspace_id: string
          session_id: string | null
          title: string
          hypothesis: string | null
          description: string | null
          status: DecisionStatus
          gate_recommendation: DecisionStatus | null
          evidence_strength: number
          evidence_count: number
          success_metrics: Json
          is_overridden: boolean
          override_reason: string | null
          overridden_at: string | null
          overridden_by: string | null
          external_ref: string | null
          external_url: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          session_id?: string | null
          title: string
          hypothesis?: string | null
          description?: string | null
          status?: DecisionStatus
          gate_recommendation?: DecisionStatus | null
          evidence_strength?: number
          evidence_count?: number
          success_metrics?: Json
          is_overridden?: boolean
          override_reason?: string | null
          overridden_at?: string | null
          overridden_by?: string | null
          external_ref?: string | null
          external_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          session_id?: string | null
          title?: string
          hypothesis?: string | null
          description?: string | null
          status?: DecisionStatus
          gate_recommendation?: DecisionStatus | null
          evidence_strength?: number
          evidence_count?: number
          success_metrics?: Json
          is_overridden?: boolean
          override_reason?: string | null
          overridden_at?: string | null
          overridden_by?: string | null
          external_ref?: string | null
          external_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      evidence_decision_links: {
        Row: {
          id: string
          decision_id: string
          evidence_id: string
          segment_match_factor: number
          relevance_note: string | null
          linked_by: string | null
          linked_at: string
        }
        Insert: {
          id?: string
          decision_id: string
          evidence_id: string
          segment_match_factor?: number
          relevance_note?: string | null
          linked_by?: string | null
          linked_at?: string
        }
        Update: {
          id?: string
          decision_id?: string
          evidence_id?: string
          segment_match_factor?: number
          relevance_note?: string | null
          linked_by?: string | null
          linked_at?: string
        }
      }
      // Phase A: Confidence History
      confidence_history: {
        Row: {
          id: string
          workspace_id: string
          entity_type: 'evidence_bank' | 'sticky_note' | 'decision' | 'hypothesis'
          entity_id: string
          score: number
          previous_score: number | null
          delta: number | null
          trigger_type: ConfidenceTriggerType | null
          trigger_evidence_id: string | null
          factors: Json
          recorded_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          entity_type: 'evidence_bank' | 'sticky_note' | 'decision' | 'hypothesis'
          entity_id: string
          score: number
          previous_score?: number | null
          delta?: number | null
          trigger_type?: ConfidenceTriggerType | null
          trigger_evidence_id?: string | null
          factors?: Json
          recorded_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          entity_type?: 'evidence_bank' | 'sticky_note' | 'decision' | 'hypothesis'
          entity_id?: string
          score?: number
          previous_score?: number | null
          delta?: number | null
          trigger_type?: ConfidenceTriggerType | null
          trigger_evidence_id?: string | null
          factors?: Json
          recorded_at?: string
        }
      }
      // Phase E: AI Agents
      agent_alerts: {
        Row: {
          id: string
          workspace_id: string
          agent_type: AgentType
          alert_type: AlertType
          title: string
          content: string
          metadata: Json
          related_decision_id: string | null
          related_evidence_ids: string[]
          is_read: boolean
          is_dismissed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          agent_type: AgentType
          alert_type?: AlertType
          title: string
          content?: string
          metadata?: Json
          related_decision_id?: string | null
          related_evidence_ids?: string[]
          is_read?: boolean
          is_dismissed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          agent_type?: AgentType
          alert_type?: AlertType
          title?: string
          content?: string
          metadata?: Json
          related_decision_id?: string | null
          related_evidence_ids?: string[]
          is_read?: boolean
          is_dismissed?: boolean
          created_at?: string
        }
      }
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Template = Database['public']['Tables']['templates']['Row']
export type TemplateSection = Database['public']['Tables']['template_sections']['Row']
export type Session = Database['public']['Tables']['sessions']['Row']
export type SessionObjective = Database['public']['Tables']['session_objectives']['Row']
export type SessionChecklistItem = Database['public']['Tables']['session_checklist_items']['Row']
export type Constraint = Database['public']['Tables']['constraints']['Row']
export type SessionConstraint = Database['public']['Tables']['session_constraints']['Row']
export type Section = Database['public']['Tables']['sections']['Row']
export type StickyNote = Database['public']['Tables']['sticky_notes']['Row']
export type Evidence = Database['public']['Tables']['evidence']['Row']
export type StickyNoteLink = Database['public']['Tables']['sticky_note_links']['Row']
export type SessionAnalysis = Database['public']['Tables']['session_analyses']['Row']

// Phase 2: Workspace & Evidence Bank types
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row']
export type EvidenceBank = Database['public']['Tables']['evidence_bank']['Row']
export type StickyNoteEvidenceLink = Database['public']['Tables']['sticky_note_evidence_links']['Row']
export type InsightsFeed = Database['public']['Tables']['insights_feed']['Row']
export type WorkspaceSettings = Database['public']['Tables']['workspace_settings']['Row']

// Source system types
export type SourceSystem = 'manual' | 'slack' | 'notion' | 'mixpanel' | 'airtable'
export type SourceSystemExpanded = SourceSystem | 'intercom' | 'gong' | 'interview' | 'support' | 'analytics' | 'social'
export type EvidenceStrength = 'high' | 'medium' | 'low'

// Phase B: Decision types
export type SectionType = 'general' | 'problems' | 'solutions' | 'assumptions' | 'evidence' | 'decisions'
export type DecisionStatus = 'commit' | 'validate' | 'park'
export type Decision = Database['public']['Tables']['decisions']['Row']
export type EvidenceDecisionLink = Database['public']['Tables']['evidence_decision_links']['Row']

// Phase E: AI Agent types (7-agent architecture)
export type AgentType =
  | 'strength_calculator'      // Auto: pure logic evidence scoring
  | 'contradiction_detector'   // Auto: conflict detection (Haiku)
  | 'segment_identifier'       // Auto: user segment extraction (Haiku)
  | 'session_analyzer'         // User-triggered: session analysis (Sonnet)
  | 'brief_generator'          // User-triggered: executive brief (Sonnet)
  | 'decay_monitor'            // Scheduled: stale evidence alerts
  | 'competitor_monitor'       // Scheduled: market movement alerts
  // Legacy types (for existing DB rows from original Phase E)
  | 'evidence_hunter'
  | 'analysis_crew'
export type AlertType = 'info' | 'warning' | 'action_needed'
export type AgentAlert = Database['public']['Tables']['agent_alerts']['Row']

// Phase D: Vector Search types
export interface VectorSearchResult {
  id: string
  title: string
  content: string | null
  url: string | null
  type: string
  source_system: string
  strength: string
  computed_strength: number
  segment: string | null
  source_timestamp: string | null
  created_at: string
  similarity: number
}

// Phase A: Evidence Strength types
export type WeightTemplate = 'default' | 'b2b_enterprise' | 'plg_growth' | 'support_led' | 'research_heavy'
export type ConfidenceTriggerType = 'evidence_linked' | 'evidence_removed' | 'recency_decay' | 'weight_change' | 'manual_override' | 'recalculation'
export type Sentiment = 'positive' | 'negative' | 'neutral'
export type ConfidenceHistory = Database['public']['Tables']['confidence_history']['Row']

// Phase 3: Team Collaboration types
export type WorkspaceInvite = Database['public']['Tables']['workspace_invites']['Row']
export type WorkspaceRole = 'owner' | 'admin' | 'member'

// Phase 4: Daily Insights Analysis types
export type DailyInsightsAnalysis = Database['public']['Tables']['daily_insights_analysis']['Row']

// Phase F: Discovery Brief + External Push types
export interface DiscoveryBrief {
  id: string
  workspace_id: string
  session_id: string | null
  title: string
  content: string
  evidence_count: number
  decision_count: number
  key_themes: string[]
  top_risks: string[]
  share_token: string | null
  is_public: boolean
  generated_by: string | null
  raw_response: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type IntegrationType = 'linear' | 'jira'
export type PushStatus = 'pending' | 'success' | 'failed'

export interface ExternalIntegration {
  id: string
  workspace_id: string
  integration_type: IntegrationType
  api_key_encrypted: string | null
  base_url: string | null
  team_id: string | null
  project_key: string | null
  is_active: boolean
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ExternalPush {
  id: string
  workspace_id: string
  decision_id: string
  integration_type: IntegrationType
  external_id: string | null
  external_url: string | null
  external_status: string | null
  push_status: PushStatus
  error_message: string | null
  pushed_by: string | null
  created_at: string
  updated_at: string
}

// Phase 4: Workspace Evidence Sources types
export type WorkspaceEvidenceSources = Database['public']['Tables']['workspace_evidence_sources']['Row']

// Airtable source configuration structure
export interface AirtableSourceConfig {
  base_id: string
  table_id: string
  name?: string
}

// Structured types for AI analysis results
export interface InsightTheme {
  theme: string
  count: number
  sources: SourceSystem[]
  examples: string[]
}

export interface InsightPattern {
  pattern: string
  trend: 'increasing' | 'stable' | 'new'
  related_themes: string[]
}

export interface InsightPriority {
  insight_id: string
  title: string
  priority_score: number
  reason: string
}

export interface CrossSourceConnection {
  sources: SourceSystem[]
  connection: string
  insight_ids: string[]
}

export interface ActionItem {
  action: string
  urgency: 'high' | 'medium' | 'low'
  related_insights: string[]
}

// Parsed analysis result type
export interface ParsedDailyAnalysis {
  summary: string
  themes: InsightTheme[]
  patterns: InsightPattern[]
  priorities: InsightPriority[]
  cross_source_connections: CrossSourceConnection[]
  action_items: ActionItem[]
}

// Phase A: Evidence Strength interfaces
export interface WeightConfig {
  [sourceType: string]: number
}

export interface RecencyRange {
  max_days: number
  factor: number
}

export interface RecencyConfig {
  ranges: RecencyRange[]
}

export interface EvidenceStrengthResult {
  computed_strength: number
  band: 'weak' | 'moderate' | 'strong'
  source_weight: number
  recency_factor: number
  segment_match: number
  corroboration_bonus: number
  factors: EvidenceStrengthFactors
}

export interface EvidenceStrengthFactors {
  base_weight: number
  recency: number
  segment_match: number
  corroboration: number
  quality_gates: QualityGateResult
}

export interface QualityGateResult {
  source_diversity: { passed: boolean; unique_sources: number; total: number; cap_applied: boolean }
  direct_voice: { passed: boolean; has_direct: boolean }
  independence: { passed: boolean; independent_count: number }
  recency_floor: { passed: boolean; recent_percentage: number }
}

export interface CoverageIndicators {
  source_count: number
  unique_sources: string[]
  segment_coverage: string[]
  recency_distribution: { recent: number; moderate: number; old: number; stale: number }
  has_direct_voice: boolean
  gaps: string[]
}
