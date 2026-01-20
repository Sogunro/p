-- Phase 4: Evidence Sources Configuration
-- This migration adds tables for configurable evidence sources and AI analysis fields

-- ============================================
-- 1. WORKSPACE EVIDENCE SOURCES TABLE
-- ============================================
-- Stores user-configurable source settings per workspace

CREATE TABLE IF NOT EXISTS workspace_evidence_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,

  -- Slack Configuration
  slack_enabled BOOLEAN DEFAULT false,
  slack_channel_ids TEXT[] DEFAULT '{}',

  -- Notion Configuration
  notion_enabled BOOLEAN DEFAULT false,
  notion_database_ids TEXT[] DEFAULT '{}',

  -- Airtable Configuration
  airtable_enabled BOOLEAN DEFAULT false,
  airtable_sources JSONB DEFAULT '[]',  -- Array of {base_id, table_id, name}

  -- Mixpanel Configuration (workspace-wide, no per-source config)
  mixpanel_enabled BOOLEAN DEFAULT false,

  -- Scheduling Settings
  auto_fetch_enabled BOOLEAN DEFAULT false,
  auto_fetch_time TIME DEFAULT '18:00',  -- Default 6pm
  lookback_hours INTEGER DEFAULT 24,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One config per workspace
  UNIQUE(workspace_id)
);

-- ============================================
-- 2. ADD AI ANALYSIS FIELDS TO INSIGHTS_FEED
-- ============================================

ALTER TABLE insights_feed ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE insights_feed ADD COLUMN IF NOT EXISTS ai_themes JSONB DEFAULT '[]';
ALTER TABLE insights_feed ADD COLUMN IF NOT EXISTS ai_action_items JSONB DEFAULT '[]';
ALTER TABLE insights_feed ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE insights_feed ADD COLUMN IF NOT EXISTS pain_points JSONB DEFAULT '[]';
ALTER TABLE insights_feed ADD COLUMN IF NOT EXISTS feature_requests JSONB DEFAULT '[]';
ALTER TABLE insights_feed ADD COLUMN IF NOT EXISTS sentiment TEXT;
ALTER TABLE insights_feed ADD COLUMN IF NOT EXISTS key_quotes JSONB DEFAULT '[]';
ALTER TABLE insights_feed ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

-- ============================================
-- 3. DAILY INSIGHTS ANALYSIS TABLE
-- ============================================
-- Stores aggregated AI analysis per day

CREATE TABLE IF NOT EXISTS daily_insights_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  analysis_date DATE NOT NULL,

  insight_count INTEGER DEFAULT 0,
  sources_included TEXT[] DEFAULT '{}',

  -- AI Analysis Results
  summary TEXT,
  themes JSONB DEFAULT '[]',
  patterns JSONB DEFAULT '[]',
  priorities JSONB DEFAULT '[]',
  cross_source_connections JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  raw_response JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(workspace_id, analysis_date)
);

-- Add analysis link to insights
ALTER TABLE insights_feed ADD COLUMN IF NOT EXISTS
  analysis_id UUID REFERENCES daily_insights_analysis(id) ON DELETE SET NULL;

-- ============================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE workspace_evidence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_insights_analysis ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Users can view their workspace evidence sources" ON workspace_evidence_sources;
DROP POLICY IF EXISTS "Users can insert their workspace evidence sources" ON workspace_evidence_sources;
DROP POLICY IF EXISTS "Users can update their workspace evidence sources" ON workspace_evidence_sources;
DROP POLICY IF EXISTS "Users can delete their workspace evidence sources" ON workspace_evidence_sources;
DROP POLICY IF EXISTS "Users can view their daily insights analysis" ON daily_insights_analysis;
DROP POLICY IF EXISTS "Users can insert their daily insights analysis" ON daily_insights_analysis;
DROP POLICY IF EXISTS "Users can update their daily insights analysis" ON daily_insights_analysis;

-- Workspace Evidence Sources Policies (using workspace_members table)
CREATE POLICY "Users can view their workspace evidence sources"
  ON workspace_evidence_sources FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their workspace evidence sources"
  ON workspace_evidence_sources FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their workspace evidence sources"
  ON workspace_evidence_sources FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can delete their workspace evidence sources"
  ON workspace_evidence_sources FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Daily Insights Analysis Policies (using workspace_members table)
CREATE POLICY "Users can view their daily insights analysis"
  ON daily_insights_analysis FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their daily insights analysis"
  ON daily_insights_analysis FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their daily insights analysis"
  ON daily_insights_analysis FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_workspace_evidence_sources_workspace
  ON workspace_evidence_sources(workspace_id);

CREATE INDEX IF NOT EXISTS idx_daily_insights_analysis_workspace_date
  ON daily_insights_analysis(workspace_id, analysis_date DESC);

CREATE INDEX IF NOT EXISTS idx_insights_feed_analysis
  ON insights_feed(analysis_id) WHERE analysis_id IS NOT NULL;

-- ============================================
-- 6. UPDATE TRIGGER FOR TIMESTAMPS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_workspace_evidence_sources_updated_at ON workspace_evidence_sources;
CREATE TRIGGER update_workspace_evidence_sources_updated_at
  BEFORE UPDATE ON workspace_evidence_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_insights_analysis_updated_at ON daily_insights_analysis;
CREATE TRIGGER update_daily_insights_analysis_updated_at
  BEFORE UPDATE ON daily_insights_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
