-- ============================================
-- RLS Policy Fixes
-- ============================================
-- Run this in Supabase SQL Editor to fix:
-- 1. Sessions not workspace-scoped
-- 2. Duplicate policies on sticky_note_evidence_links
-- 3. Duplicate policies on daily_insights_analysis
-- 4. Conflicting policies on evidence_bank
-- ============================================

-- ============================================
-- FIX 1: Add workspace-based session policies
-- ============================================
-- Currently sessions only check user_id, so team members
-- in the same workspace can't see each other's sessions.

-- Add policy for workspace members to VIEW sessions
DROP POLICY IF EXISTS "Workspace members can view sessions" ON sessions;
CREATE POLICY "Workspace members can view sessions" ON sessions
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- NOTE: Keep the existing user-based policies for backwards compatibility
-- Users can still see/edit their OWN sessions via user_id policies
-- Plus they can now VIEW team sessions via workspace_id policy

-- ============================================
-- FIX 2: Remove duplicate sticky_note_evidence_links policies
-- ============================================
-- Currently has duplicate INSERT, DELETE, SELECT policies

-- Remove duplicates (keep the shorter-named ones)
DROP POLICY IF EXISTS "Users can insert their sticky note evidence links" ON sticky_note_evidence_links;
DROP POLICY IF EXISTS "Users can delete their sticky note evidence links" ON sticky_note_evidence_links;
DROP POLICY IF EXISTS "Users can view their sticky note evidence links" ON sticky_note_evidence_links;

-- Keep these policies (already exist with cleaner names):
-- "Users can view links for notes in their sessions" (SELECT)
-- "Users can create links for their notes" (INSERT)
-- "Users can delete links for their notes" (DELETE)

-- ============================================
-- FIX 3: Remove duplicate daily_insights_analysis policies
-- ============================================
-- Currently has duplicate policies using different methods:
-- - Some use get_user_workspace_ids() function
-- - Some use direct subquery on workspace_members
-- Keep the function-based ones (more efficient)

-- Remove the direct subquery policies
DROP POLICY IF EXISTS "Users can view their daily insights analysis" ON daily_insights_analysis;
DROP POLICY IF EXISTS "Users can insert their daily insights analysis" ON daily_insights_analysis;
DROP POLICY IF EXISTS "Users can update their daily insights analysis" ON daily_insights_analysis;

-- Keep these policies (use efficient function):
-- "Users can view analyses for their workspaces" (SELECT)
-- "Users can create analyses for their workspaces" (INSERT)
-- "Users can update analyses for their workspaces" (UPDATE)
-- "Users can delete analyses for their workspaces" (DELETE)

-- ============================================
-- FIX 4: Remove conflicting evidence_bank policy
-- ============================================
-- evidence_bank has BOTH user_id-based AND workspace-based policies
-- This causes confusion - user might only see their OWN evidence
-- instead of all workspace evidence.
-- Remove the user-based policy, keep workspace-based policies.

DROP POLICY IF EXISTS "Users can manage own evidence bank" ON evidence_bank;

-- Keep these workspace-based policies:
-- "Users can view evidence in their workspaces" (SELECT)
-- "Users can add evidence to their workspaces" (INSERT)
-- "Users can update evidence in their workspaces" (UPDATE)
-- "Users can delete evidence in their workspaces" (DELETE)

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the fixes worked:

-- Check sessions policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'sessions' ORDER BY cmd;

-- Check sticky_note_evidence_links policies (should have 3, not 6)
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'sticky_note_evidence_links' ORDER BY cmd;

-- Check daily_insights_analysis policies (should have 4, not 8)
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'daily_insights_analysis' ORDER BY cmd;

-- Check evidence_bank policies (should NOT have "manage own" policy)
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'evidence_bank' ORDER BY cmd;

-- ============================================
-- DONE!
-- ============================================
-- After running this:
-- 1. Team members can view sessions in their workspace
-- 2. No more duplicate policies causing confusion
-- 3. Evidence bank properly workspace-scoped
-- ============================================
