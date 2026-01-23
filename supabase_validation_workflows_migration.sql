-- ============================================
-- Validation Workflows Table
-- ============================================
-- This table enables hypothesis tracking and validation progress
-- for product discovery sessions.
--
-- Run this in Supabase SQL Editor to enable:
-- 1. Hypothesis creation and tracking
-- 2. Validation progress updates
-- 3. Test result recording
-- 4. Historical validation evolution
-- ============================================

-- Create the validation_workflows table
CREATE TABLE IF NOT EXISTS validation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES session_analyses(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

  -- What we're validating
  item_type TEXT NOT NULL CHECK (item_type IN ('problem', 'assumption', 'hypothesis', 'solution')),
  item_content TEXT NOT NULL,
  item_section TEXT,
  original_confidence NUMERIC(3,2) CHECK (original_confidence >= 0 AND original_confidence <= 1),

  -- Hypothesis (IF/THEN/BECAUSE format)
  hypothesis_if TEXT,
  hypothesis_then TEXT,
  hypothesis_because TEXT,

  -- Validation details
  validation_method TEXT, -- survey, interview, analytics, prototype_test, A_B_test
  research_questions JSONB DEFAULT '[]'::jsonb,
  success_criteria TEXT,
  sample_size_target TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'validated', 'invalidated', 'needs_more_data', 'pivoted')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),

  -- Results
  actual_sample_size INTEGER,
  test_results TEXT,
  key_findings JSONB DEFAULT '[]'::jsonb,
  final_confidence NUMERIC(3,2) CHECK (final_confidence >= 0 AND final_confidence <= 1),

  -- Decision
  decision TEXT, -- build, pivot, kill, investigate_more
  decision_rationale TEXT,
  next_actions JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_validation_workflows_session ON validation_workflows(session_id);
CREATE INDEX IF NOT EXISTS idx_validation_workflows_user ON validation_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_validation_workflows_workspace ON validation_workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_validation_workflows_status ON validation_workflows(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_validation_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validation_workflows_updated_at ON validation_workflows;
CREATE TRIGGER trigger_validation_workflows_updated_at
  BEFORE UPDATE ON validation_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_validation_workflows_updated_at();

-- ============================================
-- RLS Policies
-- ============================================

-- Enable RLS
ALTER TABLE validation_workflows ENABLE ROW LEVEL SECURITY;

-- Users can view their own validation workflows
CREATE POLICY "Users can view their validation workflows" ON validation_workflows
  FOR SELECT USING (user_id = auth.uid());

-- Users can view validation workflows in their workspace
CREATE POLICY "Users can view workspace validation workflows" ON validation_workflows
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can create validation workflows for their sessions
CREATE POLICY "Users can create validation workflows" ON validation_workflows
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own validation workflows
CREATE POLICY "Users can update their validation workflows" ON validation_workflows
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own validation workflows
CREATE POLICY "Users can delete their validation workflows" ON validation_workflows
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- Validation History Table (for tracking changes)
-- ============================================

CREATE TABLE IF NOT EXISTS validation_workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES validation_workflows(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What changed
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for history queries
CREATE INDEX IF NOT EXISTS idx_validation_history_workflow ON validation_workflow_history(workflow_id);

-- Enable RLS on history
ALTER TABLE validation_workflow_history ENABLE ROW LEVEL SECURITY;

-- Users can view history for workflows they can access
CREATE POLICY "Users can view workflow history" ON validation_workflow_history
  FOR SELECT USING (
    workflow_id IN (
      SELECT id FROM validation_workflows
      WHERE user_id = auth.uid()
      OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    )
  );

-- Users can create history entries for their workflows
CREATE POLICY "Users can create workflow history" ON validation_workflow_history
  FOR INSERT WITH CHECK (changed_by = auth.uid());

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these to verify tables were created:

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'validation_workflows'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'validation_workflow_history'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'validation_workflows';
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'validation_workflow_history';

-- ============================================
-- DONE!
-- ============================================
