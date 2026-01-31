-- ============================================
-- Product Discovery Tool - Consolidated Database Schema
-- ============================================
-- Version: 2.0.0
-- Last Updated: 2026-01-31
--
-- This file consolidates ALL migrations (Phases 1-6) into a single,
-- well-organized schema file. Safe to run on fresh database.
--
-- Tables: 24 total
-- ============================================

-- ============================================
-- SECTION 1: EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SECTION 2: HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Alias for compatibility
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate 8-character invite codes
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

-- Function to get user's workspace IDs (SECURITY DEFINER to avoid RLS circular dependency)
CREATE OR REPLACE FUNCTION get_user_workspace_ids(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT workspace_id FROM workspace_members WHERE user_id = user_uuid;
$$;

-- Function to get single workspace ID for a user
CREATE OR REPLACE FUNCTION get_user_workspace_id(user_uuid UUID)
RETURNS UUID AS $$
    SELECT workspace_id FROM workspace_members WHERE user_id = user_uuid LIMIT 1;
$$ LANGUAGE SQL STABLE;


-- ============================================
-- SECTION 3: CORE TABLES
-- ============================================

-- --------------------------------------------
-- 3.1 PROFILES (User accounts)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Trigger: Create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================
-- SECTION 4: WORKSPACE TABLES
-- ============================================

-- --------------------------------------------
-- 4.1 WORKSPACES (Team containers)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON workspaces;
CREATE POLICY "Users can view workspaces they belong to" ON workspaces
    FOR SELECT USING (
        id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Owners can update their workspaces" ON workspaces;
CREATE POLICY "Owners can update their workspaces" ON workspaces
    FOR UPDATE USING (
        id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'owner')
    );

DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON workspaces;
CREATE POLICY "Authenticated users can create workspaces" ON workspaces
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS update_workspaces_updated_at ON workspaces;
CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE workspaces IS 'Team/workspace container for multi-user collaboration';


-- --------------------------------------------
-- 4.2 WORKSPACE_MEMBERS (User-workspace mapping)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Use SECURITY DEFINER function to avoid circular dependency
DROP POLICY IF EXISTS "Users can view workspace members" ON workspace_members;
CREATE POLICY "Users can view workspace members" ON workspace_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Owners/admins can manage members" ON workspace_members;
CREATE POLICY "Owners/admins can manage members" ON workspace_members
    FOR UPDATE USING (
        workspace_id IN (
            SELECT wm.workspace_id FROM workspace_members wm
            WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "Owners/admins can delete members" ON workspace_members;
CREATE POLICY "Owners/admins can delete members" ON workspace_members
    FOR DELETE USING (
        workspace_id IN (
            SELECT wm.workspace_id FROM workspace_members wm
            WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "Users can join workspaces" ON workspace_members;
CREATE POLICY "Users can join workspaces" ON workspace_members
    FOR INSERT WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE workspace_members IS 'Maps users to workspaces with roles (owner/admin/member)';


-- --------------------------------------------
-- 4.3 WORKSPACE_INVITES (Team invite links)
-- --------------------------------------------
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

ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invites for their workspaces" ON workspace_invites;
CREATE POLICY "Users can view invites for their workspaces" ON workspace_invites
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Anyone can view active invites by code" ON workspace_invites;
CREATE POLICY "Anyone can view active invites by code" ON workspace_invites
    FOR SELECT USING (is_active = TRUE);

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

CREATE INDEX IF NOT EXISTS idx_workspace_invites_code ON workspace_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id);

COMMENT ON TABLE workspace_invites IS 'Invite links for joining workspaces';
COMMENT ON COLUMN workspace_invites.invite_code IS '8-character alphanumeric code for sharing';
COMMENT ON COLUMN workspace_invites.role IS 'Role assigned to users who join via this invite';
COMMENT ON COLUMN workspace_invites.max_uses IS 'NULL means unlimited uses';


-- --------------------------------------------
-- 4.4 WORKSPACE_SETTINGS (Feed/integration config)
-- --------------------------------------------
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

ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view settings for their workspaces" ON workspace_settings;
CREATE POLICY "Users can view settings for their workspaces" ON workspace_settings
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can create settings for their workspaces" ON workspace_settings;
CREATE POLICY "Users can create settings for their workspaces" ON workspace_settings
    FOR INSERT WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Owners/admins can update settings" ON workspace_settings;
CREATE POLICY "Owners/admins can update settings" ON workspace_settings
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

DROP TRIGGER IF EXISTS update_workspace_settings_updated_at ON workspace_settings;
CREATE TRIGGER update_workspace_settings_updated_at
    BEFORE UPDATE ON workspace_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE workspace_settings IS 'Workspace configuration including feed schedule and integrations';


-- --------------------------------------------
-- 4.5 WORKSPACE_EVIDENCE_SOURCES (Integration source config)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS workspace_evidence_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
    -- Slack Configuration
    slack_enabled BOOLEAN DEFAULT FALSE,
    slack_channel_ids TEXT[] DEFAULT '{}',
    -- Notion Configuration
    notion_enabled BOOLEAN DEFAULT FALSE,
    notion_database_ids TEXT[] DEFAULT '{}',
    -- Airtable Configuration
    airtable_enabled BOOLEAN DEFAULT FALSE,
    airtable_sources JSONB DEFAULT '[]',
    -- Mixpanel Configuration
    mixpanel_enabled BOOLEAN DEFAULT FALSE,
    -- Scheduling Settings
    auto_fetch_enabled BOOLEAN DEFAULT FALSE,
    auto_fetch_time TIME DEFAULT '18:00',
    lookback_hours INTEGER DEFAULT 24,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workspace_evidence_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their workspace evidence sources" ON workspace_evidence_sources;
CREATE POLICY "Users can view their workspace evidence sources" ON workspace_evidence_sources
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can insert their workspace evidence sources" ON workspace_evidence_sources;
CREATE POLICY "Users can insert their workspace evidence sources" ON workspace_evidence_sources
    FOR INSERT WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can update their workspace evidence sources" ON workspace_evidence_sources;
CREATE POLICY "Users can update their workspace evidence sources" ON workspace_evidence_sources
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "Users can delete their workspace evidence sources" ON workspace_evidence_sources;
CREATE POLICY "Users can delete their workspace evidence sources" ON workspace_evidence_sources
    FOR DELETE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE INDEX IF NOT EXISTS idx_workspace_evidence_sources_workspace ON workspace_evidence_sources(workspace_id);

DROP TRIGGER IF EXISTS update_workspace_evidence_sources_updated_at ON workspace_evidence_sources;
CREATE TRIGGER update_workspace_evidence_sources_updated_at
    BEFORE UPDATE ON workspace_evidence_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================
-- SECTION 5: TEMPLATE TABLES
-- ============================================

-- --------------------------------------------
-- 5.1 TEMPLATES
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view system templates" ON templates;
CREATE POLICY "Anyone can view system templates" ON templates
    FOR SELECT USING (is_system = TRUE OR auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can create templates" ON templates;
CREATE POLICY "Users can create templates" ON templates
    FOR INSERT WITH CHECK (auth.uid() = created_by AND is_system = FALSE);

DROP POLICY IF EXISTS "Users can update own templates" ON templates;
CREATE POLICY "Users can update own templates" ON templates
    FOR UPDATE USING (auth.uid() = created_by AND is_system = FALSE);

DROP POLICY IF EXISTS "Users can delete own templates" ON templates;
CREATE POLICY "Users can delete own templates" ON templates
    FOR DELETE USING (auth.uid() = created_by AND is_system = FALSE);


-- --------------------------------------------
-- 5.2 TEMPLATE_SECTIONS
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS template_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE template_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view template sections" ON template_sections;
CREATE POLICY "Users can view template sections" ON template_sections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM templates
            WHERE templates.id = template_sections.template_id
            AND (templates.is_system = TRUE OR templates.created_by = auth.uid())
        )
    );


-- ============================================
-- SECTION 6: SESSION TABLES
-- ============================================

-- --------------------------------------------
-- 6.1 SESSIONS
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- User-based policies (own sessions)
DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;
CREATE POLICY "Users can view own sessions" ON sessions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create sessions" ON sessions;
CREATE POLICY "Users can create sessions" ON sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON sessions;
CREATE POLICY "Users can update own sessions" ON sessions
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON sessions;
CREATE POLICY "Users can delete own sessions" ON sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Workspace-based policy (team collaboration)
DROP POLICY IF EXISTS "Workspace members can view sessions" ON sessions;
CREATE POLICY "Workspace members can view sessions" ON sessions
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- --------------------------------------------
-- 6.2 SESSION_OBJECTIVES
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS session_objectives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE session_objectives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own session objectives" ON session_objectives;
CREATE POLICY "Users can manage own session objectives" ON session_objectives
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_objectives.session_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_session_objectives_session_id ON session_objectives(session_id);


-- --------------------------------------------
-- 6.3 SESSION_CHECKLIST_ITEMS
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS session_checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_checked BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE session_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own session checklist" ON session_checklist_items;
CREATE POLICY "Users can manage own session checklist" ON session_checklist_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_checklist_items.session_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_session_checklist_session_id ON session_checklist_items(session_id);

DROP TRIGGER IF EXISTS update_session_checklist_updated_at ON session_checklist_items;
CREATE TRIGGER update_session_checklist_updated_at
    BEFORE UPDATE ON session_checklist_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- --------------------------------------------
-- 6.4 CONSTRAINTS (User constraints/strategic config)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    value TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    input_type TEXT DEFAULT 'text', -- text, number, currency, date, select
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE constraints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own constraints" ON constraints;
CREATE POLICY "Users can view own constraints" ON constraints
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create constraints" ON constraints;
CREATE POLICY "Users can create constraints" ON constraints
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own constraints" ON constraints;
CREATE POLICY "Users can update own constraints" ON constraints
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own constraints" ON constraints;
CREATE POLICY "Users can delete own constraints" ON constraints
    FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_constraints_updated_at ON constraints;
CREATE TRIGGER update_constraints_updated_at
    BEFORE UPDATE ON constraints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to create default constraints for new users
CREATE OR REPLACE FUNCTION public.create_default_constraints()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.constraints (user_id, type, label, is_system, input_type) VALUES
        (NEW.id, 'vision', 'Vision', TRUE, 'text'),
        (NEW.id, 'kpi', 'KPIs / Success Metrics', TRUE, 'text'),
        (NEW.id, 'resources', 'Engineering Resources', TRUE, 'number'),
        (NEW.id, 'budget', 'Budget', TRUE, 'currency'),
        (NEW.id, 'timeline', 'Timeline', TRUE, 'date'),
        (NEW.id, 'technical', 'Technical Limitations', TRUE, 'text')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- --------------------------------------------
-- 6.5 SESSION_CONSTRAINTS (Junction table)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS session_constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    constraint_id UUID NOT NULL REFERENCES constraints(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, constraint_id)
);

ALTER TABLE session_constraints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own session constraints" ON session_constraints;
CREATE POLICY "Users can manage own session constraints" ON session_constraints
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_constraints.session_id
            AND sessions.user_id = auth.uid()
        )
    );


-- --------------------------------------------
-- 6.6 SECTIONS (Canvas sections)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 300,
    height INTEGER DEFAULT 400,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own sections" ON sections;
CREATE POLICY "Users can manage own sections" ON sections
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = sections.session_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_sections_session_id ON sections(session_id);

DROP TRIGGER IF EXISTS update_sections_updated_at ON sections;
CREATE TRIGGER update_sections_updated_at
    BEFORE UPDATE ON sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- --------------------------------------------
-- 6.7 STICKY_NOTES
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS sticky_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    has_evidence BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sticky_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own sticky notes" ON sticky_notes;
CREATE POLICY "Users can manage own sticky notes" ON sticky_notes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sections
            JOIN sessions ON sessions.id = sections.session_id
            WHERE sections.id = sticky_notes.section_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_sticky_notes_section_id ON sticky_notes(section_id);

DROP TRIGGER IF EXISTS update_sticky_notes_updated_at ON sticky_notes;
CREATE TRIGGER update_sticky_notes_updated_at
    BEFORE UPDATE ON sticky_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- --------------------------------------------
-- 6.8 STICKY_NOTE_LINKS (Note-to-note connections)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS sticky_note_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_note_id UUID NOT NULL REFERENCES sticky_notes(id) ON DELETE CASCADE,
    target_note_id UUID NOT NULL REFERENCES sticky_notes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_note_id, target_note_id),
    CHECK (source_note_id != target_note_id)
);

ALTER TABLE sticky_note_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own sticky note links" ON sticky_note_links;
CREATE POLICY "Users can manage own sticky note links" ON sticky_note_links
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sticky_notes
            JOIN sections ON sections.id = sticky_notes.section_id
            JOIN sessions ON sessions.id = sections.session_id
            WHERE sticky_notes.id = sticky_note_links.source_note_id
            AND sessions.user_id = auth.uid()
        )
    );


-- ============================================
-- SECTION 7: EVIDENCE TABLES
-- ============================================

-- --------------------------------------------
-- 7.1 EVIDENCE_BANK (Workspace-shared reusable evidence)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS evidence_bank (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('url', 'text', 'file')),
    url TEXT,
    content TEXT,
    source TEXT,
    tags TEXT[] DEFAULT '{}',
    strength TEXT DEFAULT 'medium' CHECK (strength IN ('high', 'medium', 'low')),
    source_system TEXT DEFAULT 'manual' CHECK (source_system IN ('manual', 'slack', 'notion', 'mixpanel', 'airtable')),
    -- Content fetching fields
    fetched_content TEXT,
    fetch_status TEXT DEFAULT 'unfetched', -- unfetched, fetched, failed
    fetch_metadata JSONB DEFAULT '{}',
    fetched_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE evidence_bank ENABLE ROW LEVEL SECURITY;

-- Workspace-based policies only (no user-based to avoid conflicts)
DROP POLICY IF EXISTS "Users can manage own evidence bank" ON evidence_bank;
DROP POLICY IF EXISTS "Users can view evidence in their workspaces" ON evidence_bank;
CREATE POLICY "Users can view evidence in their workspaces" ON evidence_bank
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can add evidence to their workspaces" ON evidence_bank;
CREATE POLICY "Users can add evidence to their workspaces" ON evidence_bank
    FOR INSERT WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can update evidence in their workspaces" ON evidence_bank;
CREATE POLICY "Users can update evidence in their workspaces" ON evidence_bank
    FOR UPDATE USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can delete evidence in their workspaces" ON evidence_bank;
CREATE POLICY "Users can delete evidence in their workspaces" ON evidence_bank
    FOR DELETE USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_evidence_bank_workspace ON evidence_bank(workspace_id);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_source ON evidence_bank(source_system);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_strength ON evidence_bank(strength);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_fetch_status ON evidence_bank(fetch_status);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_workspace_fetch_status ON evidence_bank(workspace_id, fetch_status);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_created_at ON evidence_bank(created_at DESC);

DROP TRIGGER IF EXISTS update_evidence_bank_updated_at ON evidence_bank;
CREATE TRIGGER update_evidence_bank_updated_at
    BEFORE UPDATE ON evidence_bank
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE evidence_bank IS 'Reusable evidence items shared across a workspace';


-- --------------------------------------------
-- 7.2 EVIDENCE (Direct sticky note evidence)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sticky_note_id UUID NOT NULL REFERENCES sticky_notes(id) ON DELETE CASCADE,
    evidence_bank_id UUID REFERENCES evidence_bank(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('url', 'text')),
    url TEXT,
    content TEXT,
    title TEXT,
    strength TEXT DEFAULT 'medium' CHECK (strength IN ('high', 'medium', 'low')),
    -- Content fetching fields
    fetched_content TEXT,
    fetch_status TEXT DEFAULT 'unfetched',
    fetched_at TIMESTAMPTZ,
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own evidence" ON evidence;
CREATE POLICY "Users can manage own evidence" ON evidence
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sticky_notes
            JOIN sections ON sections.id = sticky_notes.section_id
            JOIN sessions ON sessions.id = sections.session_id
            WHERE sticky_notes.id = evidence.sticky_note_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_evidence_sticky_note_id ON evidence(sticky_note_id);
CREATE INDEX IF NOT EXISTS idx_evidence_fetch_status ON evidence(fetch_status);

-- Trigger to update has_evidence on sticky_notes
CREATE OR REPLACE FUNCTION update_has_evidence()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE sticky_notes SET has_evidence = TRUE WHERE id = NEW.sticky_note_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE sticky_notes
        SET has_evidence = EXISTS (
            SELECT 1 FROM evidence WHERE sticky_note_id = OLD.sticky_note_id
        )
        WHERE id = OLD.sticky_note_id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_evidence_change ON evidence;
CREATE TRIGGER on_evidence_change
    AFTER INSERT OR DELETE ON evidence
    FOR EACH ROW EXECUTE FUNCTION update_has_evidence();


-- --------------------------------------------
-- 7.3 STICKY_NOTE_EVIDENCE_LINKS (Note to bank links)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS sticky_note_evidence_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sticky_note_id UUID REFERENCES sticky_notes(id) ON DELETE CASCADE NOT NULL,
    evidence_bank_id UUID REFERENCES evidence_bank(id) ON DELETE CASCADE NOT NULL,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sticky_note_id, evidence_bank_id)
);

ALTER TABLE sticky_note_evidence_links ENABLE ROW LEVEL SECURITY;

-- Clean policies (no duplicates)
DROP POLICY IF EXISTS "Users can insert their sticky note evidence links" ON sticky_note_evidence_links;
DROP POLICY IF EXISTS "Users can delete their sticky note evidence links" ON sticky_note_evidence_links;
DROP POLICY IF EXISTS "Users can view their sticky note evidence links" ON sticky_note_evidence_links;

DROP POLICY IF EXISTS "Users can view links for notes in their sessions" ON sticky_note_evidence_links;
CREATE POLICY "Users can view links for notes in their sessions" ON sticky_note_evidence_links
    FOR SELECT USING (
        sticky_note_id IN (
            SELECT sn.id FROM sticky_notes sn
            JOIN sections s ON sn.section_id = s.id
            JOIN sessions sess ON s.session_id = sess.id
            WHERE sess.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create links for their notes" ON sticky_note_evidence_links;
CREATE POLICY "Users can create links for their notes" ON sticky_note_evidence_links
    FOR INSERT WITH CHECK (
        sticky_note_id IN (
            SELECT sn.id FROM sticky_notes sn
            JOIN sections s ON sn.section_id = s.id
            JOIN sessions sess ON s.session_id = sess.id
            WHERE sess.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete links for their notes" ON sticky_note_evidence_links;
CREATE POLICY "Users can delete links for their notes" ON sticky_note_evidence_links
    FOR DELETE USING (
        sticky_note_id IN (
            SELECT sn.id FROM sticky_notes sn
            JOIN sections s ON sn.section_id = s.id
            JOIN sessions sess ON s.session_id = sess.id
            WHERE sess.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_sticky_note_evidence_links_note ON sticky_note_evidence_links(sticky_note_id);
CREATE INDEX IF NOT EXISTS idx_sticky_note_evidence_links_bank ON sticky_note_evidence_links(evidence_bank_id);

COMMENT ON TABLE sticky_note_evidence_links IS 'Links sticky notes to evidence bank items (many-to-many)';


-- ============================================
-- SECTION 8: INSIGHTS TABLES
-- ============================================

-- --------------------------------------------
-- 8.1 DAILY_INSIGHTS_ANALYSIS (AI analysis of daily batches)
-- NOTE: Created before insights_feed due to FK reference
-- --------------------------------------------
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
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, analysis_date)
);

ALTER TABLE daily_insights_analysis ENABLE ROW LEVEL SECURITY;

-- Clean policies using SECURITY DEFINER function (no duplicates)
DROP POLICY IF EXISTS "Users can view their daily insights analysis" ON daily_insights_analysis;
DROP POLICY IF EXISTS "Users can insert their daily insights analysis" ON daily_insights_analysis;
DROP POLICY IF EXISTS "Users can update their daily insights analysis" ON daily_insights_analysis;

DROP POLICY IF EXISTS "Users can view analyses for their workspaces" ON daily_insights_analysis;
CREATE POLICY "Users can view analyses for their workspaces" ON daily_insights_analysis
    FOR SELECT USING (
        workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can create analyses for their workspaces" ON daily_insights_analysis;
CREATE POLICY "Users can create analyses for their workspaces" ON daily_insights_analysis
    FOR INSERT WITH CHECK (
        workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can update analyses for their workspaces" ON daily_insights_analysis;
CREATE POLICY "Users can update analyses for their workspaces" ON daily_insights_analysis
    FOR UPDATE USING (
        workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can delete analyses for their workspaces" ON daily_insights_analysis;
CREATE POLICY "Users can delete analyses for their workspaces" ON daily_insights_analysis
    FOR DELETE USING (
        workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
    );

CREATE INDEX IF NOT EXISTS idx_daily_insights_analysis_workspace_date ON daily_insights_analysis(workspace_id, analysis_date DESC);

DROP TRIGGER IF EXISTS update_daily_insights_analysis_updated_at ON daily_insights_analysis;
CREATE TRIGGER update_daily_insights_analysis_updated_at
    BEFORE UPDATE ON daily_insights_analysis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- --------------------------------------------
-- 8.2 INSIGHTS_FEED (Daily fetched insights from n8n)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS insights_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    source_system TEXT NOT NULL CHECK (source_system IN ('slack', 'notion', 'mixpanel', 'airtable')),
    title TEXT NOT NULL,
    content TEXT,
    url TEXT,
    source_url TEXT,
    strength TEXT DEFAULT 'medium' CHECK (strength IN ('high', 'medium', 'low')),
    source_metadata JSONB DEFAULT '{}',
    is_added_to_bank BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    -- AI Analysis fields
    ai_summary TEXT,
    ai_themes JSONB DEFAULT '[]',
    ai_action_items JSONB DEFAULT '[]',
    pain_points JSONB DEFAULT '[]',
    feature_requests JSONB DEFAULT '[]',
    sentiment TEXT,
    key_quotes JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    -- Analysis link
    analysis_id UUID REFERENCES daily_insights_analysis(id) ON DELETE SET NULL,
    -- Timestamps
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE insights_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view insights in their workspaces" ON insights_feed;
CREATE POLICY "Users can view insights in their workspaces" ON insights_feed
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can update insights in their workspaces" ON insights_feed;
CREATE POLICY "Users can update insights in their workspaces" ON insights_feed
    FOR UPDATE USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Service role can insert insights" ON insights_feed;
CREATE POLICY "Service role can insert insights" ON insights_feed
    FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_insights_feed_workspace ON insights_feed(workspace_id);
CREATE INDEX IF NOT EXISTS idx_insights_feed_source ON insights_feed(source_system);
CREATE INDEX IF NOT EXISTS idx_insights_feed_fetched ON insights_feed(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_feed_analysis ON insights_feed(analysis_id) WHERE analysis_id IS NOT NULL;

COMMENT ON TABLE insights_feed IS 'Daily fetched insights from external tools via n8n';


-- ============================================
-- SECTION 9: ANALYSIS TABLES
-- ============================================

-- --------------------------------------------
-- 9.1 SESSION_ANALYSES (AI analysis results)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS session_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    objective_score INTEGER CHECK (objective_score >= 0 AND objective_score <= 100),
    summary TEXT,
    -- Core analysis fields
    assumptions JSONB,
    evidence_backed JSONB,
    validation_recommendations JSONB,
    constraint_analysis JSONB,
    checklist_review JSONB,
    raw_response JSONB,
    -- Comprehensive analysis fields (Phase 5)
    session_diagnosis JSONB,
    evidence_assessment JSONB,
    strategic_alignment JSONB,
    solutions_analysis JSONB,
    pattern_detection JSONB,
    priority_ranking JSONB,
    next_steps JSONB,
    hypotheses JSONB,
    conflicts JSONB,
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE session_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own analyses" ON session_analyses;
CREATE POLICY "Users can view own analyses" ON session_analyses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_analyses.session_id
            AND sessions.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create analyses" ON session_analyses;
CREATE POLICY "Users can create analyses" ON session_analyses
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_analyses.session_id
            AND sessions.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete own analyses" ON session_analyses;
CREATE POLICY "Users can delete own analyses" ON session_analyses
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_analyses.session_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_session_analyses_session_id ON session_analyses(session_id);

COMMENT ON COLUMN session_analyses.session_diagnosis IS 'Session health: overall_quality, evidence_maturity, session_nature, key_strengths, key_gaps';
COMMENT ON COLUMN session_analyses.evidence_assessment IS 'Evidence quality: total_sources, source_types, quality_breakdown, evidence_quality_score';
COMMENT ON COLUMN session_analyses.strategic_alignment IS 'Alignment scores: vision_alignment_score, goals_coverage, kpi_impact, overall_alignment_score';
COMMENT ON COLUMN session_analyses.solutions_analysis IS 'Solution recs: solution, problem_solved, recommendation (BUILD_NOW/VALIDATE_FIRST/DEFER), feasibility';
COMMENT ON COLUMN session_analyses.pattern_detection IS 'Patterns: shared_evidence, convergent_patterns, contradictions, evidence_gaps';
COMMENT ON COLUMN session_analyses.priority_ranking IS 'Ranked items: rank, item, type, total_score, score_breakdown, why_this_rank';
COMMENT ON COLUMN session_analyses.next_steps IS 'Actions: build_now, validate_first, defer - each with action, method, effort';
COMMENT ON COLUMN session_analyses.hypotheses IS 'Hypotheses: for_problem, hypothesis (if/then/because), research_questions, success_criteria';
COMMENT ON COLUMN session_analyses.conflicts IS 'Conflicts: type, item, details, suggestion';


-- ============================================
-- SECTION 10: VALIDATION TABLES (Phase 6)
-- ============================================

-- --------------------------------------------
-- 10.1 VALIDATION_WORKFLOWS (Hypothesis tracking)
-- --------------------------------------------
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

ALTER TABLE validation_workflows ENABLE ROW LEVEL SECURITY;

-- Users can view their own validation workflows
DROP POLICY IF EXISTS "Users can view their validation workflows" ON validation_workflows;
CREATE POLICY "Users can view their validation workflows" ON validation_workflows
    FOR SELECT USING (user_id = auth.uid());

-- Users can view validation workflows in their workspace
DROP POLICY IF EXISTS "Users can view workspace validation workflows" ON validation_workflows;
CREATE POLICY "Users can view workspace validation workflows" ON validation_workflows
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- Users can create validation workflows
DROP POLICY IF EXISTS "Users can create validation workflows" ON validation_workflows;
CREATE POLICY "Users can create validation workflows" ON validation_workflows
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own validation workflows
DROP POLICY IF EXISTS "Users can update their validation workflows" ON validation_workflows;
CREATE POLICY "Users can update their validation workflows" ON validation_workflows
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own validation workflows
DROP POLICY IF EXISTS "Users can delete their validation workflows" ON validation_workflows;
CREATE POLICY "Users can delete their validation workflows" ON validation_workflows
    FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_validation_workflows_session ON validation_workflows(session_id);
CREATE INDEX IF NOT EXISTS idx_validation_workflows_user ON validation_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_validation_workflows_workspace ON validation_workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_validation_workflows_status ON validation_workflows(status);

DROP TRIGGER IF EXISTS trigger_validation_workflows_updated_at ON validation_workflows;
CREATE TRIGGER trigger_validation_workflows_updated_at
    BEFORE UPDATE ON validation_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE validation_workflows IS 'Hypothesis tracking and validation progress for discovery sessions';


-- --------------------------------------------
-- 10.2 VALIDATION_WORKFLOW_HISTORY (Change tracking)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS validation_workflow_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES validation_workflows(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- What changed
    field_changed TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_note TEXT,
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE validation_workflow_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view workflow history" ON validation_workflow_history;
CREATE POLICY "Users can view workflow history" ON validation_workflow_history
    FOR SELECT USING (
        workflow_id IN (
            SELECT id FROM validation_workflows
            WHERE user_id = auth.uid()
            OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can create workflow history" ON validation_workflow_history;
CREATE POLICY "Users can create workflow history" ON validation_workflow_history
    FOR INSERT WITH CHECK (changed_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_validation_history_workflow ON validation_workflow_history(workflow_id);

COMMENT ON TABLE validation_workflow_history IS 'Audit trail for validation workflow changes';


-- ============================================
-- SECTION 11: SIGNUP TRIGGERS
-- ============================================

-- Trigger: Create default constraints on profile creation
DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.create_default_constraints();

-- Function: Create workspace for new user
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

-- Trigger: Auto-create workspace on profile creation
DROP TRIGGER IF EXISTS on_profile_created_create_workspace ON profiles;
CREATE TRIGGER on_profile_created_create_workspace
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION create_workspace_for_user();


-- ============================================
-- SECTION 12: SEED DATA
-- ============================================

-- Default templates
INSERT INTO templates (id, name, description, is_system) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Blank Canvas', 'Start from scratch with an empty canvas', TRUE),
    ('00000000-0000-0000-0000-000000000002', 'Full Discovery Session', 'Complete discovery template with Problem Space, Target Users, Observed Problems, and Proposed Solutions sections', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Sections for Full Discovery Session template
INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000002', 'Problem Space', 0
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000002' AND name = 'Problem Space');

INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000002', 'Target Users', 1
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000002' AND name = 'Target Users');

INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000002', 'Observed Problems', 2
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000002' AND name = 'Observed Problems');

INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000002', 'Proposed Solutions', 3
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000002' AND name = 'Proposed Solutions');


-- ============================================
-- SECTION 13: BACKFILL EXISTING USERS
-- ============================================
-- Run this if you already have users without workspaces

DO $$
DECLARE
    profile_record RECORD;
    new_workspace_id UUID;
BEGIN
    FOR profile_record IN
        SELECT id, full_name FROM profiles
        WHERE id NOT IN (SELECT user_id FROM workspace_members)
    LOOP
        -- Create workspace
        INSERT INTO workspaces (name, created_by)
        VALUES (COALESCE(profile_record.full_name, 'My Workspace') || '''s Workspace', profile_record.id)
        RETURNING id INTO new_workspace_id;

        -- Add as owner
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES (new_workspace_id, profile_record.id, 'owner');

        -- Create settings
        INSERT INTO workspace_settings (workspace_id)
        VALUES (new_workspace_id);
    END LOOP;
END;
$$;


-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables: 24
-- 1. profiles
-- 2. workspaces
-- 3. workspace_members
-- 4. workspace_invites
-- 5. workspace_settings
-- 6. workspace_evidence_sources
-- 7. templates
-- 8. template_sections
-- 9. sessions
-- 10. session_objectives
-- 11. session_checklist_items
-- 12. constraints
-- 13. session_constraints
-- 14. sections
-- 15. sticky_notes
-- 16. sticky_note_links
-- 17. evidence_bank
-- 18. evidence
-- 19. sticky_note_evidence_links
-- 20. daily_insights_analysis
-- 21. insights_feed
-- 22. session_analyses
-- 23. validation_workflows
-- 24. validation_workflow_history
-- ============================================
