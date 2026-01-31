-- ============================================
-- Phase E: AI Agent System
-- Run in Supabase SQL Editor
-- Timestamp: 7:00 PM
-- ============================================


-- ============================================
-- 7:00 PM — CREATE agent_alerts TABLE (NEW TABLE — #28)
-- ============================================
-- Stores all agent outputs/alerts in a single table.
-- agent_type discriminates between different agents.
-- metadata JSONB holds agent-specific structured data.

CREATE TABLE IF NOT EXISTS agent_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Agent identification
    agent_type TEXT NOT NULL CHECK (agent_type IN (
        'evidence_hunter',
        'decay_monitor',
        'contradiction_detector',
        'competitor_monitor',
        'analysis_crew'
    )),
    alert_type TEXT NOT NULL DEFAULT 'info' CHECK (alert_type IN ('info', 'warning', 'action_needed')),

    -- Content
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',

    -- Agent-specific structured data
    -- Evidence Hunter: { found_evidence: [...], linked_count, queries_used, confidence_before, confidence_after }
    -- Decay Monitor: { flagged_decisions: [...], healthy_decisions: [...], total_checked }
    -- Contradiction: { evidence_a: {...}, evidence_b: {...}, conflict_type, explanation }
    -- Analysis Crew: { themes: [...], sentiment: {...}, validation: {...}, gaps: [...] }
    metadata JSONB DEFAULT '{}',

    -- Relations
    related_decision_id UUID REFERENCES decisions(id) ON DELETE SET NULL,
    related_evidence_ids UUID[] DEFAULT '{}',

    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view agent alerts in their workspaces" ON agent_alerts;
CREATE POLICY "Users can view agent alerts in their workspaces" ON agent_alerts
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can insert agent alerts in their workspaces" ON agent_alerts;
CREATE POLICY "Users can insert agent alerts in their workspaces" ON agent_alerts
    FOR INSERT WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can update agent alerts in their workspaces" ON agent_alerts;
CREATE POLICY "Users can update agent alerts in their workspaces" ON agent_alerts
    FOR UPDATE USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can delete agent alerts in their workspaces" ON agent_alerts;
CREATE POLICY "Users can delete agent alerts in their workspaces" ON agent_alerts
    FOR DELETE USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

-- Service role insert policy (for Python agents writing alerts directly)
DROP POLICY IF EXISTS "Service role can insert agent alerts" ON agent_alerts;
CREATE POLICY "Service role can insert agent alerts" ON agent_alerts
    FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_alerts_workspace ON agent_alerts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_type ON agent_alerts(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_unread ON agent_alerts(workspace_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_agent_alerts_created ON agent_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_decision ON agent_alerts(related_decision_id) WHERE related_decision_id IS NOT NULL;

COMMENT ON TABLE agent_alerts IS 'AI agent outputs and alerts — Evidence Hunter, Decay Monitor, Contradiction Detector, Analysis Crew';


-- ============================================
-- 7:01 PM — VERIFICATION
-- ============================================

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'agent_alerts'
ORDER BY ordinal_position;

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'agent_alerts';
