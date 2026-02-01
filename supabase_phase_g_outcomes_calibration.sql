-- ============================================================
-- Phase G: Outcomes + Calibration
-- 2 new tables: outcomes, pm_calibration
-- ============================================================

-- #32: outcomes — track what happened after decisions
CREATE TABLE IF NOT EXISTS outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
    outcome_type TEXT NOT NULL DEFAULT 'pending' CHECK (outcome_type IN ('success', 'partial', 'failure', 'pending')),
    title TEXT NOT NULL DEFAULT '',
    target_metrics JSONB DEFAULT '[]'::jsonb,
    actual_metrics JSONB DEFAULT '[]'::jsonb,
    learnings TEXT,
    source_retrospective TEXT,
    review_date DATE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_workspace ON outcomes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_decision ON outcomes(decision_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_type ON outcomes(outcome_type);

-- RLS for outcomes
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view outcomes"
    ON outcomes FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can create outcomes"
    ON outcomes FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can update outcomes"
    ON outcomes FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can delete outcomes"
    ON outcomes FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE TRIGGER update_outcomes_updated_at
    BEFORE UPDATE ON outcomes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- #33: pm_calibration — track prediction accuracy per user/workspace
CREATE TABLE IF NOT EXISTS pm_calibration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_predictions INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    prediction_accuracy DECIMAL(5,2) DEFAULT 0,
    source_reliability JSONB DEFAULT '{}'::jsonb,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, user_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_pm_calibration_workspace ON pm_calibration(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pm_calibration_user ON pm_calibration(user_id);
CREATE INDEX IF NOT EXISTS idx_pm_calibration_period ON pm_calibration(period_start, period_end);

-- RLS for pm_calibration
ALTER TABLE pm_calibration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view calibration data"
    ON pm_calibration FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can create calibration data"
    ON pm_calibration FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can update calibration data"
    ON pm_calibration FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can delete calibration data"
    ON pm_calibration FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE TRIGGER update_pm_calibration_updated_at
    BEFORE UPDATE ON pm_calibration
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
