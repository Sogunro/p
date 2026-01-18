-- ============================================
-- PHASE 3: TEAM COLLABORATION - WORKSPACE INVITES
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- NEW TABLE: workspace_invites
-- Stores invite links for joining workspaces
-- ============================================
CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  use_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

-- Policies for workspace_invites
DROP POLICY IF EXISTS "Users can view invites for their workspaces" ON workspace_invites;
CREATE POLICY "Users can view invites for their workspaces" ON workspace_invites
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners/admins can create invites" ON workspace_invites;
CREATE POLICY "Owners/admins can create invites" ON workspace_invites
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Owners/admins can update invites" ON workspace_invites;
CREATE POLICY "Owners/admins can update invites" ON workspace_invites
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Owners/admins can delete invites" ON workspace_invites;
CREATE POLICY "Owners/admins can delete invites" ON workspace_invites
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Anyone can read invite by code (for joining) - using service role in API
DROP POLICY IF EXISTS "Anyone can view active invites by code" ON workspace_invites;
CREATE POLICY "Anyone can view active invites by code" ON workspace_invites
  FOR SELECT USING (is_active = TRUE);

-- Index for fast invite code lookup
CREATE INDEX IF NOT EXISTS idx_workspace_invites_code ON workspace_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id);

-- ============================================
-- HELPER FUNCTION: Generate invite code
-- ============================================
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE workspace_invites IS 'Invite links for joining workspaces';
COMMENT ON COLUMN workspace_invites.invite_code IS '8-character alphanumeric code for sharing';
COMMENT ON COLUMN workspace_invites.role IS 'Role assigned to users who join via this invite';
COMMENT ON COLUMN workspace_invites.max_uses IS 'NULL means unlimited uses';
COMMENT ON COLUMN workspace_invites.use_count IS 'How many times this invite has been used';

-- ============================================
-- DONE!
-- ============================================
