-- ============================================
-- Product Discovery Tool - Database Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. TEMPLATES TABLE
-- ============================================
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Everyone can view system templates, users can view their own
CREATE POLICY "Anyone can view system templates"
    ON templates FOR SELECT
    USING (is_system = TRUE OR auth.uid() = created_by);

CREATE POLICY "Users can create templates"
    ON templates FOR INSERT
    WITH CHECK (auth.uid() = created_by AND is_system = FALSE);

CREATE POLICY "Users can update own templates"
    ON templates FOR UPDATE
    USING (auth.uid() = created_by AND is_system = FALSE);

CREATE POLICY "Users can delete own templates"
    ON templates FOR DELETE
    USING (auth.uid() = created_by AND is_system = FALSE);

-- ============================================
-- 3. TEMPLATE SECTIONS TABLE
-- ============================================
CREATE TABLE template_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE template_sections ENABLE ROW LEVEL SECURITY;

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
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
    ON sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create sessions"
    ON sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
    ON sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
    ON sessions FOR DELETE
    USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- ============================================
-- 5. SESSION OBJECTIVES TABLE
-- ============================================
CREATE TABLE session_objectives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE session_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own session objectives"
    ON session_objectives FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_objectives.session_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX idx_session_objectives_session_id ON session_objectives(session_id);

-- ============================================
-- 6. SESSION CHECKLIST ITEMS TABLE
-- ============================================
CREATE TABLE session_checklist_items (
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

CREATE POLICY "Users can manage own session checklist"
    ON session_checklist_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_checklist_items.session_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX idx_session_checklist_session_id ON session_checklist_items(session_id);

-- ============================================
-- 7. CONSTRAINTS TABLE
-- ============================================
CREATE TABLE constraints (
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

CREATE POLICY "Users can view own constraints"
    ON constraints FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create constraints"
    ON constraints FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own constraints"
    ON constraints FOR UPDATE
    USING (auth.uid() = user_id);

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
        (NEW.id, 'technical', 'Technical Limitations', TRUE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.create_default_constraints();

-- ============================================
-- 8. SESSION CONSTRAINTS TABLE (Junction)
-- ============================================
CREATE TABLE session_constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    constraint_id UUID NOT NULL REFERENCES constraints(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, constraint_id)
);

ALTER TABLE session_constraints ENABLE ROW LEVEL SECURITY;

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
CREATE TABLE sections (
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

CREATE POLICY "Users can manage own sections"
    ON sections FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = sections.session_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX idx_sections_session_id ON sections(session_id);

-- ============================================
-- 10. STICKY NOTES TABLE
-- ============================================
CREATE TABLE sticky_notes (
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

CREATE INDEX idx_sticky_notes_section_id ON sticky_notes(section_id);

-- ============================================
-- 11. EVIDENCE TABLE
-- ============================================
CREATE TABLE evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sticky_note_id UUID NOT NULL REFERENCES sticky_notes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('url', 'text')),
    url TEXT,
    content TEXT,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX idx_evidence_sticky_note_id ON evidence(sticky_note_id);

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

CREATE TRIGGER on_evidence_change
    AFTER INSERT OR DELETE ON evidence
    FOR EACH ROW EXECUTE FUNCTION update_has_evidence();

-- ============================================
-- 12. STICKY NOTE LINKS TABLE
-- ============================================
CREATE TABLE sticky_note_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_note_id UUID NOT NULL REFERENCES sticky_notes(id) ON DELETE CASCADE,
    target_note_id UUID NOT NULL REFERENCES sticky_notes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_note_id, target_note_id),
    CHECK (source_note_id != target_note_id)
);

ALTER TABLE sticky_note_links ENABLE ROW LEVEL SECURITY;

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
CREATE TABLE session_analyses (
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

CREATE POLICY "Users can view own analyses"
    ON session_analyses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_analyses.session_id
            AND sessions.user_id = auth.uid()
        )
    );

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
-- INSERT DEFAULT TEMPLATES
-- ============================================
INSERT INTO templates (id, name, description, is_system) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Blank Canvas', 'Start from scratch with an empty canvas', TRUE),
    ('00000000-0000-0000-0000-000000000002', 'Problem Space', 'Explore and define the problem space', TRUE),
    ('00000000-0000-0000-0000-000000000003', 'Target Users', 'Identify and analyze target user segments', TRUE),
    ('00000000-0000-0000-0000-000000000004', 'Observed Problems', 'Document observed user problems and pain points', TRUE),
    ('00000000-0000-0000-0000-000000000005', 'Proposed Solutions', 'Brainstorm and evaluate potential solutions', TRUE);

-- Default sections for Problem Space template
INSERT INTO template_sections (template_id, name, order_index) VALUES
    ('00000000-0000-0000-0000-000000000002', 'Current State', 0),
    ('00000000-0000-0000-0000-000000000002', 'Pain Points', 1),
    ('00000000-0000-0000-0000-000000000002', 'Opportunities', 2);

-- Default sections for Target Users template
INSERT INTO template_sections (template_id, name, order_index) VALUES
    ('00000000-0000-0000-0000-000000000003', 'User Segments', 0),
    ('00000000-0000-0000-0000-000000000003', 'User Goals', 1),
    ('00000000-0000-0000-0000-000000000003', 'User Behaviors', 2);

-- Default sections for Observed Problems template
INSERT INTO template_sections (template_id, name, order_index) VALUES
    ('00000000-0000-0000-0000-000000000004', 'Problems', 0),
    ('00000000-0000-0000-0000-000000000004', 'Impact', 1),
    ('00000000-0000-0000-0000-000000000004', 'Frequency', 2);

-- Default sections for Proposed Solutions template
INSERT INTO template_sections (template_id, name, order_index) VALUES
    ('00000000-0000-0000-0000-000000000005', 'Ideas', 0),
    ('00000000-0000-0000-0000-000000000005', 'Feasibility', 1),
    ('00000000-0000-0000-0000-000000000005', 'Impact', 2);

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
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_session_checklist_updated_at
    BEFORE UPDATE ON session_checklist_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_constraints_updated_at
    BEFORE UPDATE ON constraints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sections_updated_at
    BEFORE UPDATE ON sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sticky_notes_updated_at
    BEFORE UPDATE ON sticky_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- DONE!
-- ============================================
