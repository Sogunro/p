-- ============================================
-- Product Discovery Tool - Full Database Migration
-- Run this in Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies (drop first if exists to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Trigger to create profile on signup
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

-- ============================================
-- 2. TEMPLATES TABLE
-- ============================================
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
CREATE POLICY "Anyone can view system templates"
    ON templates FOR SELECT
    USING (is_system = TRUE OR auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can create templates" ON templates;
CREATE POLICY "Users can create templates"
    ON templates FOR INSERT
    WITH CHECK (auth.uid() = created_by AND is_system = FALSE);

DROP POLICY IF EXISTS "Users can update own templates" ON templates;
CREATE POLICY "Users can update own templates"
    ON templates FOR UPDATE
    USING (auth.uid() = created_by AND is_system = FALSE);

DROP POLICY IF EXISTS "Users can delete own templates" ON templates;
CREATE POLICY "Users can delete own templates"
    ON templates FOR DELETE
    USING (auth.uid() = created_by AND is_system = FALSE);

-- ============================================
-- 3. TEMPLATE SECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS template_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE template_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view template sections" ON template_sections;
CREATE POLICY "Users can view template sections"
    ON template_sections FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM templates
            WHERE templates.id = template_sections.template_id
            AND (templates.is_system = TRUE OR templates.created_by = auth.uid())
        )
    );

-- ============================================
-- 4. SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;
CREATE POLICY "Users can view own sessions"
    ON sessions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create sessions" ON sessions;
CREATE POLICY "Users can create sessions"
    ON sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON sessions;
CREATE POLICY "Users can update own sessions"
    ON sessions FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON sessions;
CREATE POLICY "Users can delete own sessions"
    ON sessions FOR DELETE
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- ============================================
-- 5. SESSION OBJECTIVES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS session_objectives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE session_objectives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own session objectives" ON session_objectives;
CREATE POLICY "Users can manage own session objectives"
    ON session_objectives FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_objectives.session_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_session_objectives_session_id ON session_objectives(session_id);

-- ============================================
-- 6. SESSION CHECKLIST ITEMS TABLE
-- ============================================
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
CREATE POLICY "Users can manage own session checklist"
    ON session_checklist_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_checklist_items.session_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_session_checklist_session_id ON session_checklist_items(session_id);

-- ============================================
-- 7. CONSTRAINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    value TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE constraints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own constraints" ON constraints;
CREATE POLICY "Users can view own constraints"
    ON constraints FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create constraints" ON constraints;
CREATE POLICY "Users can create constraints"
    ON constraints FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own constraints" ON constraints;
CREATE POLICY "Users can update own constraints"
    ON constraints FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own constraints" ON constraints;
CREATE POLICY "Users can delete own constraints"
    ON constraints FOR DELETE
    USING (auth.uid() = user_id);

-- Function to create default constraints for new users
CREATE OR REPLACE FUNCTION public.create_default_constraints()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.constraints (user_id, type, label, is_system) VALUES
        (NEW.id, 'vision', 'Vision', TRUE),
        (NEW.id, 'kpi', 'KPIs / Success Metrics', TRUE),
        (NEW.id, 'resources', 'Engineering Resources', TRUE),
        (NEW.id, 'budget', 'Budget', TRUE),
        (NEW.id, 'timeline', 'Timeline', TRUE),
        (NEW.id, 'technical', 'Technical Limitations', TRUE)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.create_default_constraints();

-- ============================================
-- 8. SESSION CONSTRAINTS TABLE (Junction)
-- ============================================
CREATE TABLE IF NOT EXISTS session_constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    constraint_id UUID NOT NULL REFERENCES constraints(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, constraint_id)
);

ALTER TABLE session_constraints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own session constraints" ON session_constraints;
CREATE POLICY "Users can manage own session constraints"
    ON session_constraints FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_constraints.session_id
            AND sessions.user_id = auth.uid()
        )
    );

-- ============================================
-- 9. SECTIONS TABLE
-- ============================================
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
CREATE POLICY "Users can manage own sections"
    ON sections FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = sections.session_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_sections_session_id ON sections(session_id);

-- ============================================
-- 10. STICKY NOTES TABLE
-- ============================================
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
CREATE POLICY "Users can manage own sticky notes"
    ON sticky_notes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sections
            JOIN sessions ON sessions.id = sections.session_id
            WHERE sections.id = sticky_notes.section_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_sticky_notes_section_id ON sticky_notes(section_id);

-- ============================================
-- 11. EVIDENCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sticky_note_id UUID NOT NULL REFERENCES sticky_notes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('url', 'text')),
    url TEXT,
    content TEXT,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own evidence" ON evidence;
CREATE POLICY "Users can manage own evidence"
    ON evidence FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sticky_notes
            JOIN sections ON sections.id = sticky_notes.section_id
            JOIN sessions ON sessions.id = sections.session_id
            WHERE sticky_notes.id = evidence.sticky_note_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_evidence_sticky_note_id ON evidence(sticky_note_id);

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

-- ============================================
-- 12. STICKY NOTE LINKS TABLE
-- ============================================
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
CREATE POLICY "Users can manage own sticky note links"
    ON sticky_note_links FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sticky_notes
            JOIN sections ON sections.id = sticky_notes.section_id
            JOIN sessions ON sessions.id = sections.session_id
            WHERE sticky_notes.id = sticky_note_links.source_note_id
            AND sessions.user_id = auth.uid()
        )
    );

-- ============================================
-- 13. SESSION ANALYSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS session_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    objective_score INTEGER CHECK (objective_score >= 0 AND objective_score <= 100),
    summary TEXT,
    assumptions JSONB,
    evidence_backed JSONB,
    validation_recommendations JSONB,
    constraint_analysis JSONB,
    checklist_review JSONB,
    raw_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE session_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own analyses" ON session_analyses;
CREATE POLICY "Users can view own analyses"
    ON session_analyses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_analyses.session_id
            AND sessions.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create analyses" ON session_analyses;
CREATE POLICY "Users can create analyses"
    ON session_analyses FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_analyses.session_id
            AND sessions.user_id = auth.uid()
        )
    );

-- ============================================
-- INSERT DEFAULT TEMPLATES (if not exists)
-- ============================================
INSERT INTO templates (id, name, description, is_system) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Blank Canvas', 'Start from scratch with an empty canvas', TRUE),
    ('00000000-0000-0000-0000-000000000002', 'Problem Space', 'Explore and define the problem space', TRUE),
    ('00000000-0000-0000-0000-000000000003', 'Target Users', 'Identify and analyze target user segments', TRUE),
    ('00000000-0000-0000-0000-000000000004', 'Observed Problems', 'Document observed user problems and pain points', TRUE),
    ('00000000-0000-0000-0000-000000000005', 'Proposed Solutions', 'Brainstorm and evaluate potential solutions', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Default sections for Problem Space template
INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000002', 'Current State', 0
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000002' AND name = 'Current State');

INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000002', 'Pain Points', 1
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000002' AND name = 'Pain Points');

INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000002', 'Opportunities', 2
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000002' AND name = 'Opportunities');

-- Default sections for Target Users template
INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000003', 'User Segments', 0
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000003' AND name = 'User Segments');

INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000003', 'User Goals', 1
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000003' AND name = 'User Goals');

INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000003', 'User Behaviors', 2
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000003' AND name = 'User Behaviors');

-- Default sections for Observed Problems template
INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000004', 'Problems', 0
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000004' AND name = 'Problems');

INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000004', 'Impact', 1
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000004' AND name = 'Impact');

INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000004', 'Frequency', 2
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000004' AND name = 'Frequency');

-- Default sections for Proposed Solutions template
INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000005', 'Ideas', 0
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000005' AND name = 'Ideas');

INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000005', 'Feasibility', 1
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000005' AND name = 'Feasibility');

INSERT INTO template_sections (template_id, name, order_index)
SELECT '00000000-0000-0000-0000-000000000005', 'Impact', 2
WHERE NOT EXISTS (SELECT 1 FROM template_sections WHERE template_id = '00000000-0000-0000-0000-000000000005' AND name = 'Impact');

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_session_checklist_updated_at ON session_checklist_items;
CREATE TRIGGER update_session_checklist_updated_at
    BEFORE UPDATE ON session_checklist_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_constraints_updated_at ON constraints;
CREATE TRIGGER update_constraints_updated_at
    BEFORE UPDATE ON constraints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_sections_updated_at ON sections;
CREATE TRIGGER update_sections_updated_at
    BEFORE UPDATE ON sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_sticky_notes_updated_at ON sticky_notes;
CREATE TRIGGER update_sticky_notes_updated_at
    BEFORE UPDATE ON sticky_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================
-- ============================================
-- PHASE 2: EVIDENCE BANK & USER INSIGHTS FEED
-- ============================================
-- ============================================

-- ============================================
-- 14. WORKSPACES (Team Container)
-- ============================================
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

-- ============================================
-- 15. WORKSPACE MEMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view members of their workspaces" ON workspace_members;
CREATE POLICY "Users can view members of their workspaces" ON workspace_members
  FOR SELECT USING (
    workspace_id IN (SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners/admins can manage members" ON workspace_members;
CREATE POLICY "Owners/admins can manage members" ON workspace_members
  FOR ALL USING (
    workspace_id IN (SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin'))
  );

DROP POLICY IF EXISTS "Users can join workspaces" ON workspace_members;
CREATE POLICY "Users can join workspaces" ON workspace_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- 16. EVIDENCE BANK (Team-Shared Reusable Evidence)
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

ALTER TABLE evidence_bank ENABLE ROW LEVEL SECURITY;

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

-- ============================================
-- 17. STICKY NOTE TO EVIDENCE BANK LINKS
-- ============================================
CREATE TABLE IF NOT EXISTS sticky_note_evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sticky_note_id UUID REFERENCES sticky_notes(id) ON DELETE CASCADE NOT NULL,
  evidence_bank_id UUID REFERENCES evidence_bank(id) ON DELETE CASCADE NOT NULL,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sticky_note_id, evidence_bank_id)
);

ALTER TABLE sticky_note_evidence_links ENABLE ROW LEVEL SECURITY;

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

-- ============================================
-- 18. INSIGHTS FEED (Daily Fetched Evidence)
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

-- ============================================
-- 19. WORKSPACE SETTINGS
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

ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view settings for their workspaces" ON workspace_settings;
CREATE POLICY "Users can view settings for their workspaces" ON workspace_settings
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners/admins can update settings" ON workspace_settings;
CREATE POLICY "Owners/admins can update settings" ON workspace_settings
  FOR UPDATE USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

DROP POLICY IF EXISTS "Users can create settings for their workspaces" ON workspace_settings;
CREATE POLICY "Users can create settings for their workspaces" ON workspace_settings
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- ============================================
-- 20. ADD WORKSPACE_ID TO SESSIONS
-- ============================================
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);

-- ============================================
-- 21. HELPER FUNCTION: CREATE WORKSPACE ON SIGNUP
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
-- 22. HELPER FUNCTION: GET USER'S WORKSPACE
-- ============================================
CREATE OR REPLACE FUNCTION get_user_workspace_id(user_uuid UUID)
RETURNS UUID AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = user_uuid LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ============================================
-- 23. PHASE 2 UPDATED_AT TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS update_workspaces_updated_at ON workspaces;
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_evidence_bank_updated_at ON evidence_bank;
CREATE TRIGGER update_evidence_bank_updated_at
  BEFORE UPDATE ON evidence_bank
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_workspace_settings_updated_at ON workspace_settings;
CREATE TRIGGER update_workspace_settings_updated_at
  BEFORE UPDATE ON workspace_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 24. CREATE WORKSPACES FOR EXISTING USERS
-- (Run this if you already have users in the system)
-- ============================================
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
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE workspaces IS 'Team/workspace container for multi-user collaboration';
COMMENT ON TABLE workspace_members IS 'Maps users to workspaces with roles (owner/admin/member)';
COMMENT ON TABLE evidence_bank IS 'Reusable evidence items shared across a workspace';
COMMENT ON TABLE sticky_note_evidence_links IS 'Links sticky notes to evidence bank items (many-to-many)';
COMMENT ON TABLE insights_feed IS 'Daily fetched insights from external tools via n8n';
COMMENT ON TABLE workspace_settings IS 'Workspace configuration including feed schedule and integrations';

-- ============================================
-- DONE! Migration complete.
-- ============================================
