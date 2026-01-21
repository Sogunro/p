-- Phase 4: Evidence Bank Update
-- Timestamp: 2026-01-21
-- This migration ensures all required tables and columns exist for Evidence Bank integration

-- ============================================
-- 1. VERIFY CORE TABLES EXIST
-- ============================================

-- Check evidence_bank table has all required columns
-- (Table should already exist from supabase_phase2_migration.sql)

-- Ensure source_system includes 'manual' as default for session-added evidence
-- No change needed - default is already 'manual'

-- ============================================
-- 2. VERIFY STICKY NOTE EVIDENCE LINKS TABLE
-- ============================================

-- This table links evidence_bank items to sticky_notes
-- Should already exist from supabase_phase2_migration.sql

CREATE TABLE IF NOT EXISTS sticky_note_evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sticky_note_id UUID REFERENCES sticky_notes(id) ON DELETE CASCADE NOT NULL,
  evidence_bank_id UUID REFERENCES evidence_bank(id) ON DELETE CASCADE NOT NULL,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sticky_note_id, evidence_bank_id)
);

-- Enable RLS if not already enabled
ALTER TABLE sticky_note_evidence_links ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Users can view their sticky note evidence links" ON sticky_note_evidence_links;
DROP POLICY IF EXISTS "Users can insert their sticky note evidence links" ON sticky_note_evidence_links;
DROP POLICY IF EXISTS "Users can delete their sticky note evidence links" ON sticky_note_evidence_links;

-- Policy: Users can view links for notes in their sessions
CREATE POLICY "Users can view their sticky note evidence links"
  ON sticky_note_evidence_links FOR SELECT
  USING (
    sticky_note_id IN (
      SELECT sn.id FROM sticky_notes sn
      JOIN sections s ON sn.section_id = s.id
      JOIN sessions sess ON s.session_id = sess.id
      WHERE sess.user_id = auth.uid()
    )
  );

-- Policy: Users can create links for notes in their sessions
CREATE POLICY "Users can insert their sticky note evidence links"
  ON sticky_note_evidence_links FOR INSERT
  WITH CHECK (
    sticky_note_id IN (
      SELECT sn.id FROM sticky_notes sn
      JOIN sections s ON sn.section_id = s.id
      JOIN sessions sess ON s.session_id = sess.id
      WHERE sess.user_id = auth.uid()
    )
  );

-- Policy: Users can delete links for notes in their sessions
CREATE POLICY "Users can delete their sticky note evidence links"
  ON sticky_note_evidence_links FOR DELETE
  USING (
    sticky_note_id IN (
      SELECT sn.id FROM sticky_notes sn
      JOIN sections s ON sn.section_id = s.id
      JOIN sessions sess ON s.session_id = sess.id
      WHERE sess.user_id = auth.uid()
    )
  );

-- ============================================
-- 3. ADD INDEX FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sticky_note_evidence_links_note
  ON sticky_note_evidence_links(sticky_note_id);

CREATE INDEX IF NOT EXISTS idx_sticky_note_evidence_links_evidence
  ON sticky_note_evidence_links(evidence_bank_id);

CREATE INDEX IF NOT EXISTS idx_evidence_bank_source_system
  ON evidence_bank(source_system);

CREATE INDEX IF NOT EXISTS idx_evidence_bank_workspace_created
  ON evidence_bank(workspace_id, created_at DESC);

-- ============================================
-- 4. VERIFY WORKSPACE_SETTINGS HAS last_fetch_at
-- ============================================

ALTER TABLE workspace_settings
  ADD COLUMN IF NOT EXISTS last_fetch_at TIMESTAMPTZ;

-- ============================================
-- VERIFICATION QUERY (Run after migration)
-- ============================================
-- SELECT
--   table_name,
--   column_name,
--   data_type
-- FROM information_schema.columns
-- WHERE table_name IN ('evidence_bank', 'sticky_note_evidence_links', 'workspace_settings')
-- ORDER BY table_name, ordinal_position;
