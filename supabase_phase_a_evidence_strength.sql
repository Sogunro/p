-- ============================================
-- Phase A: Evidence Strength Foundation
-- ============================================
-- Run this migration in Supabase SQL Editor
-- Timestamp: 2026-01-31 12:01 PM
--
-- Changes:
-- 1. Add evidence strength columns to evidence_bank
-- 2. Add weight configuration to workspace_settings
-- 3. Expand source_system enum to include intercom and gong
-- 4. Add confidence_history table (NEW TABLE)
-- ============================================


-- ============================================
-- 1. ADD EVIDENCE STRENGTH COLUMNS TO evidence_bank
-- ============================================
-- Timestamp: 12:01 PM

-- Source weight (numeric, based on source type)
-- e.g., interview=1.0, support=0.8, sales=0.7, analytics=0.7, slack=0.4, social=0.3, internal=0.1
ALTER TABLE evidence_bank ADD COLUMN IF NOT EXISTS source_weight NUMERIC(3,2) DEFAULT 0.50;

-- Recency factor (auto-calculated from created_at)
-- <7d=1.0, 7-30d=0.8, 30-90d=0.5, >90d=0.2
ALTER TABLE evidence_bank ADD COLUMN IF NOT EXISTS recency_factor NUMERIC(3,2) DEFAULT 1.00;

-- Sentiment (AI-classified)
ALTER TABLE evidence_bank ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral'));

-- User segment (extracted or inferred)
ALTER TABLE evidence_bank ADD COLUMN IF NOT EXISTS segment TEXT;

-- Computed evidence strength (0-100, calculated from formula)
ALTER TABLE evidence_bank ADD COLUMN IF NOT EXISTS computed_strength NUMERIC(5,2) DEFAULT 0.00;

-- Source timestamp (when the original evidence was created in the source system)
ALTER TABLE evidence_bank ADD COLUMN IF NOT EXISTS source_timestamp TIMESTAMPTZ;

-- Column comments for documentation
COMMENT ON COLUMN evidence_bank.source_weight IS 'Numeric weight by source type: interview=1.0, support=0.8, sales=0.7, analytics=0.7, slack=0.4, social=0.3, internal=0.1';
COMMENT ON COLUMN evidence_bank.recency_factor IS 'Decay factor based on age: <7d=1.0, 7-30d=0.8, 30-90d=0.5, >90d=0.2';
COMMENT ON COLUMN evidence_bank.sentiment IS 'AI-classified sentiment: positive, negative, neutral';
COMMENT ON COLUMN evidence_bank.segment IS 'User segment (enterprise, smb, mid-market, etc.)';
COMMENT ON COLUMN evidence_bank.computed_strength IS 'Formula-calculated evidence strength 0-100: sum(base_weight x recency x segment_match x corroboration)';
COMMENT ON COLUMN evidence_bank.source_timestamp IS 'When the evidence was originally created in the source system';


-- ============================================
-- 2. EXPAND source_system ENUM
-- ============================================
-- Timestamp: 12:02 PM
-- Add intercom and gong as valid source systems

ALTER TABLE evidence_bank DROP CONSTRAINT IF EXISTS evidence_bank_source_system_check;
ALTER TABLE evidence_bank ADD CONSTRAINT evidence_bank_source_system_check
    CHECK (source_system IN ('manual', 'slack', 'notion', 'mixpanel', 'airtable', 'intercom', 'gong', 'interview', 'support', 'analytics', 'social'));


-- ============================================
-- 3. ADD WEIGHT CONFIGURATION TO workspace_settings
-- ============================================
-- Timestamp: 12:03 PM

-- Weight configuration (JSON with source type weights)
ALTER TABLE workspace_settings ADD COLUMN IF NOT EXISTS weight_config JSONB DEFAULT '{
    "interview": 1.0,
    "support": 0.8,
    "sales": 0.7,
    "analytics": 0.7,
    "slack": 0.4,
    "social": 0.3,
    "internal": 0.1,
    "manual": 0.5,
    "notion": 0.5,
    "mixpanel": 0.7,
    "airtable": 0.5,
    "intercom": 0.8,
    "gong": 0.7
}';

-- Weight template name (preset configuration)
ALTER TABLE workspace_settings ADD COLUMN IF NOT EXISTS weight_template TEXT DEFAULT 'default'
    CHECK (weight_template IN ('default', 'b2b_enterprise', 'plg_growth', 'support_led', 'research_heavy'));

-- Recency decay configuration (JSON with day ranges and factors)
ALTER TABLE workspace_settings ADD COLUMN IF NOT EXISTS recency_config JSONB DEFAULT '{
    "ranges": [
        {"max_days": 7, "factor": 1.0},
        {"max_days": 30, "factor": 0.8},
        {"max_days": 90, "factor": 0.5},
        {"max_days": 999999, "factor": 0.2}
    ]
}';

-- Target segments for this workspace (used for segment matching)
ALTER TABLE workspace_settings ADD COLUMN IF NOT EXISTS target_segments TEXT[] DEFAULT '{}';

COMMENT ON COLUMN workspace_settings.weight_config IS 'Source type weights for evidence strength calculation. Editable per workspace.';
COMMENT ON COLUMN workspace_settings.weight_template IS 'Preset weight configuration: default, b2b_enterprise, plg_growth, support_led, research_heavy';
COMMENT ON COLUMN workspace_settings.recency_config IS 'Recency decay configuration with day ranges and factors';
COMMENT ON COLUMN workspace_settings.target_segments IS 'Target user segments for this workspace (enterprise, smb, mid-market, etc.)';


-- ============================================
-- 4. CREATE confidence_history TABLE (NEW TABLE)
-- ============================================
-- Timestamp: 12:04 PM
-- Tracks evidence strength changes over time for any entity

CREATE TABLE IF NOT EXISTS confidence_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    -- Polymorphic reference (can track strength for evidence_bank items, sticky notes, decisions, etc.)
    entity_type TEXT NOT NULL CHECK (entity_type IN ('evidence_bank', 'sticky_note', 'decision', 'hypothesis')),
    entity_id UUID NOT NULL,
    -- Score data
    score NUMERIC(5,2) NOT NULL,
    previous_score NUMERIC(5,2),
    delta NUMERIC(5,2),
    -- What caused the change
    trigger_type TEXT CHECK (trigger_type IN ('evidence_linked', 'evidence_removed', 'recency_decay', 'weight_change', 'manual_override', 'recalculation')),
    trigger_evidence_id UUID REFERENCES evidence_bank(id) ON DELETE SET NULL,
    -- Breakdown of factors at this point in time
    factors JSONB DEFAULT '{}',
    -- Timestamps
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE confidence_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view confidence history in their workspaces" ON confidence_history;
CREATE POLICY "Users can view confidence history in their workspaces" ON confidence_history
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can insert confidence history in their workspaces" ON confidence_history;
CREATE POLICY "Users can insert confidence history in their workspaces" ON confidence_history
    FOR INSERT WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_confidence_history_entity ON confidence_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_confidence_history_workspace ON confidence_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_confidence_history_recorded_at ON confidence_history(recorded_at DESC);

COMMENT ON TABLE confidence_history IS 'Tracks evidence strength changes over time for entities (evidence, notes, decisions)';


-- ============================================
-- 5. ADD INDEXES FOR NEW COLUMNS
-- ============================================
-- Timestamp: 12:05 PM

CREATE INDEX IF NOT EXISTS idx_evidence_bank_computed_strength ON evidence_bank(computed_strength DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_source_weight ON evidence_bank(source_weight);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_segment ON evidence_bank(segment);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_sentiment ON evidence_bank(sentiment);


-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the migration worked:

-- Check evidence_bank columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'evidence_bank'
AND column_name IN ('source_weight', 'recency_factor', 'sentiment', 'segment', 'computed_strength', 'source_timestamp')
ORDER BY ordinal_position;

-- Check workspace_settings columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'workspace_settings'
AND column_name IN ('weight_config', 'weight_template', 'recency_config', 'target_segments')
ORDER BY ordinal_position;

-- Check confidence_history table exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'confidence_history'
ORDER BY ordinal_position;

-- Check RLS policies on confidence_history
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'confidence_history';


-- ============================================
-- DONE!
-- ============================================
-- After running this migration:
-- 1. evidence_bank has 6 new columns for strength computation
-- 2. workspace_settings has weight_config, weight_template, recency_config, target_segments
-- 3. source_system enum expanded with intercom, gong, interview, support, analytics, social
-- 4. confidence_history table created (NEW - 1 new table, total now 25)
--
-- Next: Build the evidence-strength.ts calculation service in the codebase
-- ============================================
