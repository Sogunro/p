-- ============================================================
-- Phase F: Discovery Brief + External Push
-- 3 new tables: discovery_briefs, external_integrations, external_pushes
-- ============================================================

-- #29: discovery_briefs
CREATE TABLE IF NOT EXISTS discovery_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    evidence_count INTEGER DEFAULT 0,
    decision_count INTEGER DEFAULT 0,
    key_themes JSONB DEFAULT '[]'::jsonb,
    top_risks JSONB DEFAULT '[]'::jsonb,
    share_token TEXT UNIQUE,
    is_public BOOLEAN DEFAULT false,
    generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    raw_response JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_briefs_workspace ON discovery_briefs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_discovery_briefs_session ON discovery_briefs(session_id);
CREATE INDEX IF NOT EXISTS idx_discovery_briefs_share_token ON discovery_briefs(share_token) WHERE share_token IS NOT NULL;

-- RLS for discovery_briefs
ALTER TABLE discovery_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view discovery briefs"
    ON discovery_briefs FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
        OR (is_public = true AND share_token IS NOT NULL)
    );

CREATE POLICY "Workspace members can create discovery briefs"
    ON discovery_briefs FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can update discovery briefs"
    ON discovery_briefs FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can delete discovery briefs"
    ON discovery_briefs FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- Updated_at trigger for discovery_briefs
CREATE TRIGGER update_discovery_briefs_updated_at
    BEFORE UPDATE ON discovery_briefs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- #30: external_integrations
CREATE TABLE IF NOT EXISTS external_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    integration_type TEXT NOT NULL CHECK (integration_type IN ('linear', 'jira')),
    api_key_encrypted TEXT,
    base_url TEXT,
    team_id TEXT,
    project_key TEXT,
    is_active BOOLEAN DEFAULT false,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, integration_type)
);

CREATE INDEX IF NOT EXISTS idx_external_integrations_workspace ON external_integrations(workspace_id);

-- RLS for external_integrations
ALTER TABLE external_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view integrations"
    ON external_integrations FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can create integrations"
    ON external_integrations FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can update integrations"
    ON external_integrations FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can delete integrations"
    ON external_integrations FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE TRIGGER update_external_integrations_updated_at
    BEFORE UPDATE ON external_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- #31: external_pushes
CREATE TABLE IF NOT EXISTS external_pushes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
    integration_type TEXT NOT NULL CHECK (integration_type IN ('linear', 'jira')),
    external_id TEXT,
    external_url TEXT,
    external_status TEXT,
    push_status TEXT NOT NULL DEFAULT 'pending' CHECK (push_status IN ('pending', 'success', 'failed')),
    error_message TEXT,
    pushed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_pushes_workspace ON external_pushes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_external_pushes_decision ON external_pushes(decision_id);

-- RLS for external_pushes
ALTER TABLE external_pushes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view pushes"
    ON external_pushes FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can create pushes"
    ON external_pushes FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can update pushes"
    ON external_pushes FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE TRIGGER update_external_pushes_updated_at
    BEFORE UPDATE ON external_pushes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
