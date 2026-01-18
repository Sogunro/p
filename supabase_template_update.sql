-- ============================================
-- Template Structure Update
-- Run this AFTER the initial migration
-- ============================================

-- Delete old template sections
DELETE FROM template_sections;

-- Delete old templates
DELETE FROM templates WHERE is_system = TRUE;

-- Create new template structure
-- Template 1: Full Discovery Session (recommended)
INSERT INTO templates (id, name, description, is_system) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Blank Canvas', 'Start from scratch with an empty canvas', TRUE),
    ('00000000-0000-0000-0000-000000000002', 'Full Discovery Session', 'Complete discovery template with Problem Space, Target Users, Observed Problems, and Proposed Solutions sections', TRUE);

-- Sections for Full Discovery Session template
INSERT INTO template_sections (template_id, name, order_index) VALUES
    ('00000000-0000-0000-0000-000000000002', 'Problem Space', 0),
    ('00000000-0000-0000-0000-000000000002', 'Target Users', 1),
    ('00000000-0000-0000-0000-000000000002', 'Observed Problems', 2),
    ('00000000-0000-0000-0000-000000000002', 'Proposed Solutions', 3);

-- ============================================
-- Evidence Bank Table (New)
-- ============================================
CREATE TABLE IF NOT EXISTS evidence_bank (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('url', 'text', 'file')),
    url TEXT,
    content TEXT,
    source TEXT, -- e.g., "User Interview", "Analytics", "Survey"
    tags TEXT[], -- for categorization
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE evidence_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own evidence bank"
    ON evidence_bank FOR ALL
    USING (auth.uid() = user_id);

CREATE INDEX idx_evidence_bank_user_id ON evidence_bank(user_id);

-- Update evidence table to link to evidence bank
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS evidence_bank_id UUID REFERENCES evidence_bank(id) ON DELETE SET NULL;

-- ============================================
-- Update constraints table for input types
-- ============================================
ALTER TABLE constraints ADD COLUMN IF NOT EXISTS input_type TEXT DEFAULT 'text';
-- input_type can be: text, number, currency, date, select

-- Update default constraints with input types
UPDATE constraints SET input_type = 'text' WHERE type = 'vision';
UPDATE constraints SET input_type = 'text' WHERE type = 'kpi';
UPDATE constraints SET input_type = 'number' WHERE type = 'resources';
UPDATE constraints SET input_type = 'currency' WHERE type = 'budget';
UPDATE constraints SET input_type = 'date' WHERE type = 'timeline';
UPDATE constraints SET input_type = 'text' WHERE type = 'technical';
