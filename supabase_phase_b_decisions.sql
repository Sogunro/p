-- ============================================
-- Phase B: Decision Records MVP
-- ============================================
-- Run this migration in Supabase SQL Editor
-- Timestamp: 2026-01-31 3:01 PM
--
-- Changes:
-- 1. Create decisions table (NEW TABLE — #26)
-- 2. Create evidence_decision_links table (NEW TABLE — #27)
-- 3. Add RLS policies for both tables
-- 4. Add indexes
-- ============================================


-- ============================================
-- 1. CREATE decisions TABLE (NEW TABLE — #26)
-- ============================================
-- Timestamp: 3:01 PM

CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    -- Core fields
    title TEXT NOT NULL,
    hypothesis TEXT,
    description TEXT,
    -- Status: commit (green), validate (yellow), park (red)
    status TEXT NOT NULL DEFAULT 'validate' CHECK (status IN ('commit', 'validate', 'park')),
    -- Gate recommendation (auto-calculated from evidence strength)
    gate_recommendation TEXT CHECK (gate_recommendation IN ('commit', 'validate', 'park')),
    -- Aggregate evidence strength (0-100)
    evidence_strength NUMERIC(5,2) DEFAULT 0.00,
    evidence_count INTEGER DEFAULT 0,
    -- Success metrics (what defines success for this decision)
    success_metrics JSONB DEFAULT '[]',
    -- Override tracking
    is_overridden BOOLEAN DEFAULT FALSE,
    override_reason TEXT,
    overridden_at TIMESTAMPTZ,
    overridden_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    -- External references (Linear, Jira, etc.)
    external_ref TEXT,
    external_url TEXT,
    -- Ownership
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view decisions in their workspaces" ON decisions;
CREATE POLICY "Users can view decisions in their workspaces" ON decisions
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can create decisions in their workspaces" ON decisions;
CREATE POLICY "Users can create decisions in their workspaces" ON decisions
    FOR INSERT WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can update decisions in their workspaces" ON decisions;
CREATE POLICY "Users can update decisions in their workspaces" ON decisions
    FOR UPDATE USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can delete decisions in their workspaces" ON decisions;
CREATE POLICY "Users can delete decisions in their workspaces" ON decisions
    FOR DELETE USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

COMMENT ON TABLE decisions IS 'First-class decision records with evidence-backed gating (commit/validate/park)';
COMMENT ON COLUMN decisions.status IS 'User-set status: commit (ship it), validate (needs more evidence), park (shelve)';
COMMENT ON COLUMN decisions.gate_recommendation IS 'Auto-calculated: >70 strength=commit, 40-70=validate, <40=park';
COMMENT ON COLUMN decisions.evidence_strength IS 'Aggregate evidence strength score 0-100';
COMMENT ON COLUMN decisions.success_metrics IS 'JSON array of success metric definitions';
COMMENT ON COLUMN decisions.is_overridden IS 'True if user overrode the gate recommendation';
COMMENT ON COLUMN decisions.override_reason IS 'Required reason when user overrides gate recommendation';


-- ============================================
-- 2. CREATE evidence_decision_links TABLE (NEW TABLE — #27)
-- ============================================
-- Timestamp: 3:02 PM

CREATE TABLE IF NOT EXISTS evidence_decision_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
    evidence_id UUID NOT NULL REFERENCES evidence_bank(id) ON DELETE CASCADE,
    -- How well this evidence matches the decision's target segment
    segment_match_factor NUMERIC(3,2) DEFAULT 1.00,
    -- Notes about why this evidence is relevant
    relevance_note TEXT,
    -- Who linked it
    linked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    -- Prevent duplicate links
    UNIQUE(decision_id, evidence_id)
);

ALTER TABLE evidence_decision_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view evidence links for decisions in their workspaces" ON evidence_decision_links;
CREATE POLICY "Users can view evidence links for decisions in their workspaces" ON evidence_decision_links
    FOR SELECT USING (
        decision_id IN (
            SELECT id FROM decisions WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can create evidence links for decisions in their workspaces" ON evidence_decision_links;
CREATE POLICY "Users can create evidence links for decisions in their workspaces" ON evidence_decision_links
    FOR INSERT WITH CHECK (
        decision_id IN (
            SELECT id FROM decisions WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete evidence links for decisions in their workspaces" ON evidence_decision_links;
CREATE POLICY "Users can delete evidence links for decisions in their workspaces" ON evidence_decision_links
    FOR DELETE USING (
        decision_id IN (
            SELECT id FROM decisions WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
            )
        )
    );

COMMENT ON TABLE evidence_decision_links IS 'Links evidence_bank items to decisions for evidence-backed gating';


-- ============================================
-- 3. ADD INDEXES
-- ============================================
-- Timestamp: 3:03 PM

CREATE INDEX IF NOT EXISTS idx_decisions_workspace ON decisions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_decisions_session ON decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_decisions_evidence_strength ON decisions(evidence_strength DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_decision_links_decision ON evidence_decision_links(decision_id);
CREATE INDEX IF NOT EXISTS idx_evidence_decision_links_evidence ON evidence_decision_links(evidence_id);


-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the migration worked:

-- Check decisions table
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'decisions'
ORDER BY ordinal_position;

-- Check evidence_decision_links table
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'evidence_decision_links'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('decisions', 'evidence_decision_links');


-- ============================================
-- DONE!
-- ============================================
-- After running this migration:
-- 1. decisions table created (NEW — table #26)
-- 2. evidence_decision_links table created (NEW — table #27)
-- 3. RLS policies: SELECT/INSERT/UPDATE/DELETE on decisions, SELECT/INSERT/DELETE on links
-- 4. Indexes on workspace_id, status, session_id, evidence_strength, decision_id, evidence_id
--
-- Total tables: 27
-- Next: Build the TypeScript types, API routes, and UI pages
-- ============================================
