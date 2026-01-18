-- ============================================
-- PHASE 4: DAILY INSIGHTS ANALYSIS
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- NEW TABLE: daily_insights_analysis
-- Stores AI analysis results for daily insight batches
-- ============================================
CREATE TABLE IF NOT EXISTS daily_insights_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  analysis_date DATE NOT NULL,

  -- Metadata
  insight_count INTEGER DEFAULT 0,
  sources_included TEXT[] DEFAULT '{}',

  -- AI Analysis Results
  summary TEXT,
  themes JSONB DEFAULT '[]',
  -- Format: [{ theme: "...", count: N, sources: ["slack", "notion"], examples: ["..."] }]

  patterns JSONB DEFAULT '[]',
  -- Format: [{ pattern: "...", trend: "increasing|stable|new", related_themes: [...] }]

  priorities JSONB DEFAULT '[]',
  -- Format: [{ insight_id: "...", title: "...", priority_score: 1-10, reason: "..." }]

  cross_source_connections JSONB DEFAULT '[]',
  -- Format: [{ sources: ["slack", "notion"], connection: "...", insight_ids: [...] }]

  action_items JSONB DEFAULT '[]',
  -- Format: [{ action: "...", urgency: "high|medium|low", related_insights: [...] }]

  raw_response JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Only one analysis per workspace per day
  UNIQUE(workspace_id, analysis_date)
);

-- ============================================
-- ADD ANALYSIS LINK TO INSIGHTS_FEED
-- ============================================
ALTER TABLE insights_feed ADD COLUMN IF NOT EXISTS
  analysis_id UUID REFERENCES daily_insights_analysis(id) ON DELETE SET NULL;

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE daily_insights_analysis ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Helper function to get user's workspace IDs (reuse existing or create)
CREATE OR REPLACE FUNCTION get_user_workspace_ids(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = user_uuid;
$$;

-- Users can view analyses for their workspaces
DROP POLICY IF EXISTS "Users can view analyses for their workspaces" ON daily_insights_analysis;
CREATE POLICY "Users can view analyses for their workspaces" ON daily_insights_analysis
  FOR SELECT USING (
    workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  );

-- Users can create analyses for their workspaces
DROP POLICY IF EXISTS "Users can create analyses for their workspaces" ON daily_insights_analysis;
CREATE POLICY "Users can create analyses for their workspaces" ON daily_insights_analysis
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  );

-- Users can update analyses for their workspaces
DROP POLICY IF EXISTS "Users can update analyses for their workspaces" ON daily_insights_analysis;
CREATE POLICY "Users can update analyses for their workspaces" ON daily_insights_analysis
  FOR UPDATE USING (
    workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  );

-- Users can delete analyses for their workspaces
DROP POLICY IF EXISTS "Users can delete analyses for their workspaces" ON daily_insights_analysis;
CREATE POLICY "Users can delete analyses for their workspaces" ON daily_insights_analysis
  FOR DELETE USING (
    workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  );

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_daily_insights_analysis_workspace ON daily_insights_analysis(workspace_id);
CREATE INDEX IF NOT EXISTS idx_daily_insights_analysis_date ON daily_insights_analysis(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_insights_feed_analysis ON insights_feed(analysis_id);
CREATE INDEX IF NOT EXISTS idx_insights_feed_fetched_date ON insights_feed(DATE(fetched_at));

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE daily_insights_analysis IS 'AI-generated analysis of daily insight batches';
COMMENT ON COLUMN daily_insights_analysis.analysis_date IS 'The date the insights were fetched (groups insights by day)';
COMMENT ON COLUMN daily_insights_analysis.sources_included IS 'Which sources had insights on this day (slack, notion, etc.)';
COMMENT ON COLUMN daily_insights_analysis.themes IS 'Common themes extracted by AI across sources';
COMMENT ON COLUMN daily_insights_analysis.patterns IS 'Trends and patterns identified by AI';
COMMENT ON COLUMN daily_insights_analysis.priorities IS 'Insights ranked by priority/urgency';
COMMENT ON COLUMN daily_insights_analysis.cross_source_connections IS 'Correlations between different sources';
COMMENT ON COLUMN daily_insights_analysis.action_items IS 'Recommended next steps based on insights';

-- ============================================
-- DONE!
-- ============================================
