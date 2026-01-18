-- Phase 2 Migration: Evidence Bank & User Insights Feed
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. WORKSPACES (Team Container)
-- ============================================
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for workspaces
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspaces they belong to" ON workspaces
  FOR SELECT USING (
    id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Owners can update their workspaces" ON workspaces
  FOR UPDATE USING (
    id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Authenticated users can create workspaces" ON workspaces
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 2. WORKSPACE MEMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- RLS for workspace_members
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their workspaces" ON workspace_members
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Owners/admins can manage members" ON workspace_members
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Users can join workspaces" ON workspace_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- 3. EVIDENCE BANK (Team-Shared Reusable Evidence)
-- ============================================
CREATE TABLE IF NOT EXISTS evidence_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('url', 'text')),
  url TEXT,
  content TEXT,
  strength TEXT DEFAULT 'medium' CHECK (strength IN ('high', 'medium', 'low')),
  source_system TEXT DEFAULT 'manual' CHECK (source_system IN ('manual', 'slack', 'notion', 'mixpanel', 'airtable')),
  source_metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for evidence_bank
ALTER TABLE evidence_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evidence in their workspaces" ON evidence_bank
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can add evidence to their workspaces" ON evidence_bank
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update evidence in their workspaces" ON evidence_bank
  FOR UPDATE USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete evidence in their workspaces" ON evidence_bank
  FOR DELETE USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- Indexes for evidence_bank
CREATE INDEX idx_evidence_bank_workspace ON evidence_bank(workspace_id);
CREATE INDEX idx_evidence_bank_source ON evidence_bank(source_system);
CREATE INDEX idx_evidence_bank_strength ON evidence_bank(strength);

-- ============================================
-- 4. STICKY NOTE TO EVIDENCE BANK LINKS
-- ============================================
CREATE TABLE IF NOT EXISTS sticky_note_evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sticky_note_id UUID REFERENCES sticky_notes(id) ON DELETE CASCADE NOT NULL,
  evidence_bank_id UUID REFERENCES evidence_bank(id) ON DELETE CASCADE NOT NULL,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sticky_note_id, evidence_bank_id)
);

-- RLS for sticky_note_evidence_links
ALTER TABLE sticky_note_evidence_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view links for notes in their sessions" ON sticky_note_evidence_links
  FOR SELECT USING (
    sticky_note_id IN (
      SELECT sn.id FROM sticky_notes sn
      JOIN sections s ON sn.section_id = s.id
      JOIN sessions sess ON s.session_id = sess.id
      WHERE sess.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create links for their notes" ON sticky_note_evidence_links
  FOR INSERT WITH CHECK (
    sticky_note_id IN (
      SELECT sn.id FROM sticky_notes sn
      JOIN sections s ON sn.section_id = s.id
      JOIN sessions sess ON s.session_id = sess.id
      WHERE sess.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete links for their notes" ON sticky_note_evidence_links
  FOR DELETE USING (
    sticky_note_id IN (
      SELECT sn.id FROM sticky_notes sn
      JOIN sections s ON sn.section_id = s.id
      JOIN sessions sess ON s.session_id = sess.id
      WHERE sess.user_id = auth.uid()
    )
  );

-- Index for faster lookups
CREATE INDEX idx_sticky_note_evidence_links_note ON sticky_note_evidence_links(sticky_note_id);
CREATE INDEX idx_sticky_note_evidence_links_bank ON sticky_note_evidence_links(evidence_bank_id);

-- ============================================
-- 5. INSIGHTS FEED (Daily Fetched Evidence)
-- ============================================
CREATE TABLE IF NOT EXISTS insights_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  source_system TEXT NOT NULL CHECK (source_system IN ('slack', 'notion', 'mixpanel', 'airtable')),
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  strength TEXT DEFAULT 'medium' CHECK (strength IN ('high', 'medium', 'low')),
  source_metadata JSONB DEFAULT '{}',
  is_added_to_bank BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for insights_feed
ALTER TABLE insights_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view insights in their workspaces" ON insights_feed
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update insights in their workspaces" ON insights_feed
  FOR UPDATE USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- Allow webhook inserts (service role)
CREATE POLICY "Service role can insert insights" ON insights_feed
  FOR INSERT WITH CHECK (true);

-- Indexes for insights_feed
CREATE INDEX idx_insights_feed_workspace ON insights_feed(workspace_id);
CREATE INDEX idx_insights_feed_source ON insights_feed(source_system);
CREATE INDEX idx_insights_feed_fetched ON insights_feed(fetched_at DESC);
CREATE INDEX idx_insights_feed_pending ON insights_feed(workspace_id) WHERE is_added_to_bank = FALSE AND is_dismissed = FALSE;

-- ============================================
-- 6. WORKSPACE SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS workspace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
  feed_schedule_time TIME DEFAULT '09:00',
  feed_timezone TEXT DEFAULT 'UTC',
  feed_enabled BOOLEAN DEFAULT TRUE,
  slack_enabled BOOLEAN DEFAULT FALSE,
  slack_webhook_url TEXT,
  notion_enabled BOOLEAN DEFAULT FALSE,
  notion_webhook_url TEXT,
  mixpanel_enabled BOOLEAN DEFAULT FALSE,
  mixpanel_webhook_url TEXT,
  airtable_enabled BOOLEAN DEFAULT FALSE,
  airtable_webhook_url TEXT,
  last_fetch_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for workspace_settings
ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view settings for their workspaces" ON workspace_settings
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Owners/admins can update settings" ON workspace_settings
  FOR UPDATE USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Users can create settings for their workspaces" ON workspace_settings
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- ============================================
-- 7. ADD WORKSPACE_ID TO SESSIONS
-- ============================================
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

-- Index for workspace filtering
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);

-- ============================================
-- 8. HELPER FUNCTION: CREATE WORKSPACE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION create_workspace_for_user()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  -- Create a default workspace for the new user
  INSERT INTO workspaces (name, created_by)
  VALUES (COALESCE(NEW.full_name, 'My Workspace') || '''s Workspace', NEW.id)
  RETURNING id INTO new_workspace_id;

  -- Add user as owner of the workspace
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  -- Create default workspace settings
  INSERT INTO workspace_settings (workspace_id)
  VALUES (new_workspace_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create workspace on profile creation
DROP TRIGGER IF EXISTS on_profile_created_create_workspace ON profiles;
CREATE TRIGGER on_profile_created_create_workspace
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_workspace_for_user();

-- ============================================
-- 9. HELPER FUNCTION: GET USER'S WORKSPACE
-- ============================================
CREATE OR REPLACE FUNCTION get_user_workspace_id(user_uuid UUID)
RETURNS UUID AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = user_uuid LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ============================================
-- 10. UPDATE TIMESTAMPS TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to new tables
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_evidence_bank_updated_at
  BEFORE UPDATE ON evidence_bank
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_workspace_settings_updated_at
  BEFORE UPDATE ON workspace_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE workspaces IS 'Team/workspace container for multi-user collaboration';
COMMENT ON TABLE workspace_members IS 'Maps users to workspaces with roles (owner/admin/member)';
COMMENT ON TABLE evidence_bank IS 'Reusable evidence items shared across a workspace';
COMMENT ON TABLE sticky_note_evidence_links IS 'Links sticky notes to evidence bank items (many-to-many)';
COMMENT ON TABLE insights_feed IS 'Daily fetched insights from external tools via n8n';
COMMENT ON TABLE workspace_settings IS 'Workspace configuration including feed schedule and integrations';
COMMENT ON COLUMN evidence_bank.source_system IS 'Where the evidence came from: manual, slack, notion, mixpanel, airtable';
COMMENT ON COLUMN evidence_bank.source_metadata IS 'JSON with source-specific data (channel, author, timestamp, etc.)';
COMMENT ON COLUMN insights_feed.is_added_to_bank IS 'True when user has added this insight to their Evidence Bank';
COMMENT ON COLUMN insights_feed.is_dismissed IS 'True when user has dismissed this insight without adding';
