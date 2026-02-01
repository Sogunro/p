# Discovery Board -- Database Schema

> **Version:** 3.0.0 | **Last Updated:** 2026-02-01 | **Tables:** 33 | **Engine:** PostgreSQL on Supabase with Row Level Security (RLS)

---

## Overview

This document describes the complete database schema for **Discovery Board**, a product discovery tool for product managers. The database runs on **PostgreSQL** via **Supabase**, using:

- **Supabase Auth** (`auth.users`) for authentication
- **Row Level Security (RLS)** on every table to enforce data isolation
- **pgvector** extension for semantic search over evidence embeddings
- **uuid-ossp** extension for UUID generation
- **SECURITY DEFINER** helper functions to avoid RLS circular dependencies in workspace queries

All tables use UUID primary keys. Timestamps are `TIMESTAMPTZ` defaulting to `NOW()`. Most tables have `updated_at` triggers that auto-update on row modification.

---

## Table of Contents

1. [Core Tables](#1-core-tables) -- profiles, templates, template_sections
2. [Workspace Tables](#2-workspace-tables) -- workspaces, workspace_members, workspace_invites, workspace_settings, workspace_evidence_sources
3. [Session Tables](#3-session-tables) -- sessions, session_objectives, session_checklist_items, constraints, session_constraints
4. [Canvas Tables](#4-canvas-tables) -- sections, sticky_notes, sticky_note_links
5. [Evidence Tables](#5-evidence-tables) -- evidence, evidence_bank, sticky_note_evidence_links
6. [Insights Tables](#6-insights-tables) -- insights_feed, daily_insights_analysis
7. [Decision Tables](#7-decision-tables) -- decisions, evidence_decision_links
8. [Analysis Tables](#8-analysis-tables) -- session_analyses
9. [Agent Tables](#9-agent-tables) -- agent_alerts, confidence_history
10. [Outcome Tables](#10-outcome-tables) -- outcomes, pm_calibration
11. [Validation Tables](#11-validation-tables) -- validation_workflows, validation_workflow_history
12. [External Tables](#12-external-tables) -- discovery_briefs, external_integrations, external_pushes
13. [Helper Functions](#13-helper-functions)
14. [Triggers](#14-triggers)
15. [Seed Data](#15-seed-data)
16. [Entity Relationship Diagram](#16-entity-relationship-diagram)
17. [Migration Order](#17-migration-order)
18. [Table Count Summary](#18-table-count-summary)

---

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector for semantic search
```

---

## 1. Core Tables

### 1.1 profiles

User accounts. Each row maps 1:1 to a Supabase Auth user. Created automatically via trigger on `auth.users` insert.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, FK -> auth.users ON DELETE CASCADE | Supabase Auth user ID |
| email | TEXT | NOT NULL | User email address |
| full_name | TEXT | | Display name |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Account creation time |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last profile update |

**RLS Policies:**
- `Users can view own profile` -- SELECT WHERE auth.uid() = id
- `Users can update own profile` -- UPDATE WHERE auth.uid() = id

**Triggers:**
- `on_auth_user_created` -- AFTER INSERT on auth.users, calls `handle_new_user()` to auto-create profile
- `update_profiles_updated_at` -- BEFORE UPDATE, auto-sets updated_at
- `on_profile_created` -- AFTER INSERT, calls `create_default_constraints()` to seed default constraints
- `on_profile_created_create_workspace` -- AFTER INSERT, calls `create_workspace_for_user()` to auto-create workspace

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

</details>

---

### 1.2 templates

Pre-built and custom canvas templates. System templates are visible to all users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | |
| name | TEXT | NOT NULL | Template name |
| description | TEXT | | Template description |
| is_system | BOOLEAN | DEFAULT FALSE | True for built-in templates |
| created_by | UUID | FK -> profiles ON DELETE CASCADE | NULL for system templates |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**RLS Policies:**
- `Anyone can view system templates` -- SELECT WHERE is_system = TRUE OR auth.uid() = created_by
- `Users can create templates` -- INSERT WHERE auth.uid() = created_by AND is_system = FALSE
- `Users can update own templates` -- UPDATE WHERE auth.uid() = created_by AND is_system = FALSE
- `Users can delete own templates` -- DELETE WHERE auth.uid() = created_by AND is_system = FALSE

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view system templates" ON templates
    FOR SELECT USING (is_system = TRUE OR auth.uid() = created_by);

CREATE POLICY "Users can create templates" ON templates
    FOR INSERT WITH CHECK (auth.uid() = created_by AND is_system = FALSE);

CREATE POLICY "Users can update own templates" ON templates
    FOR UPDATE USING (auth.uid() = created_by AND is_system = FALSE);

CREATE POLICY "Users can delete own templates" ON templates
    FOR DELETE USING (auth.uid() = created_by AND is_system = FALSE);
```

</details>

---

### 1.3 template_sections

Default sections that belong to a template. When a user creates a session from a template, these sections are copied.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | |
| template_id | UUID | NOT NULL, FK -> templates ON DELETE CASCADE | Parent template |
| name | TEXT | NOT NULL | Section name |
| order_index | INTEGER | DEFAULT 0 | Display order |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**RLS Policies:**
- `Users can view template sections` -- SELECT WHERE parent template is system or owned by user

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS template_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE template_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view template sections" ON template_sections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM templates
            WHERE templates.id = template_sections.template_id
            AND (templates.is_system = TRUE OR templates.created_by = auth.uid())
        )
    );
```

</details>

---

## 2. Workspace Tables

### 2.1 workspaces

Team/workspace container. Every user gets a default workspace on signup.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| name | TEXT | NOT NULL | Workspace name |
| created_by | UUID | FK -> profiles ON DELETE SET NULL | Creator |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**RLS Policies:**
- `Users can view workspaces they belong to` -- SELECT via workspace_members
- `Owners can update their workspaces` -- UPDATE where user role = 'owner'
- `Authenticated users can create workspaces` -- INSERT where auth.uid() IS NOT NULL

**Triggers:** `update_workspaces_updated_at`

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

</details>

---

### 2.2 workspace_members

Maps users to workspaces with role-based access.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| workspace_id | UUID | NOT NULL, FK -> workspaces ON DELETE CASCADE | |
| user_id | UUID | NOT NULL, FK -> profiles ON DELETE CASCADE | |
| role | TEXT | DEFAULT 'member', CHECK IN ('owner','admin','member') | User role in workspace |
| joined_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Unique Constraint:** (workspace_id, user_id)

**RLS Policies:**
- `Users can view workspace members` -- SELECT where user_id = self or shared workspace
- `Owners/admins can manage members` -- UPDATE for owners/admins
- `Owners/admins can delete members` -- DELETE for owners/admins
- `Users can join workspaces` -- INSERT where user_id = auth.uid()

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace members" ON workspace_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
    );

CREATE POLICY "Owners/admins can manage members" ON workspace_members
    FOR UPDATE USING (
        workspace_id IN (
            SELECT wm.workspace_id FROM workspace_members wm
            WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Owners/admins can delete members" ON workspace_members
    FOR DELETE USING (
        workspace_id IN (
            SELECT wm.workspace_id FROM workspace_members wm
            WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Users can join workspaces" ON workspace_members
    FOR INSERT WITH CHECK (user_id = auth.uid());
```

</details>

---

### 2.3 workspace_invites

Invite links for joining workspaces. Uses 8-character alphanumeric codes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| workspace_id | UUID | NOT NULL, FK -> workspaces ON DELETE CASCADE | |
| invite_code | TEXT | UNIQUE, NOT NULL | 8-char alphanumeric code |
| created_by | UUID | FK -> profiles ON DELETE SET NULL | Who created the invite |
| role | TEXT | DEFAULT 'member', CHECK IN ('admin','member') | Role for joiners |
| expires_at | TIMESTAMPTZ | | NULL = no expiration |
| max_uses | INTEGER | | NULL = unlimited |
| use_count | INTEGER | DEFAULT 0 | Times used |
| is_active | BOOLEAN | DEFAULT TRUE | Deactivation flag |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_workspace_invites_code`, `idx_workspace_invites_workspace`

**RLS Policies:** Owners/admins can CRUD; anyone can view active invites by code.

<details>
<summary>Full SQL</summary>

```sql
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

CREATE POLICY "Users can view invites for their workspaces" ON workspace_invites
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Anyone can view active invites by code" ON workspace_invites
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Owners/admins can create invites" ON workspace_invites
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Owners/admins can update invites" ON workspace_invites
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Owners/admins can delete invites" ON workspace_invites
    FOR DELETE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE INDEX IF NOT EXISTS idx_workspace_invites_code ON workspace_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id);
```

</details>

---

### 2.4 workspace_settings

Workspace-level configuration for feed scheduling, integrations, and evidence strength weights.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| workspace_id | UUID | NOT NULL, UNIQUE, FK -> workspaces ON DELETE CASCADE | One-to-one with workspace |
| feed_schedule_time | TIME | DEFAULT '09:00' | Daily feed schedule time |
| feed_timezone | TEXT | DEFAULT 'UTC' | Timezone for scheduling |
| feed_enabled | BOOLEAN | DEFAULT TRUE | Feed on/off |
| slack_enabled | BOOLEAN | DEFAULT FALSE | Slack integration toggle |
| slack_webhook_url | TEXT | | Slack webhook URL |
| notion_enabled | BOOLEAN | DEFAULT FALSE | Notion integration toggle |
| notion_webhook_url | TEXT | | Notion webhook URL |
| mixpanel_enabled | BOOLEAN | DEFAULT FALSE | Mixpanel integration toggle |
| mixpanel_webhook_url | TEXT | | Mixpanel webhook URL |
| airtable_enabled | BOOLEAN | DEFAULT FALSE | Airtable integration toggle |
| airtable_webhook_url | TEXT | | Airtable webhook URL |
| last_fetch_at | TIMESTAMPTZ | | Last n8n fetch timestamp |
| weight_config | JSONB | DEFAULT (see below) | Source type weights for evidence strength |
| weight_template | TEXT | DEFAULT 'default', CHECK IN ('default','b2b_enterprise','plg_growth','support_led','research_heavy') | Preset weight config |
| recency_config | JSONB | DEFAULT (see below) | Recency decay ranges and factors |
| target_segments | TEXT[] | DEFAULT '{}' | Target user segments for segment matching |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Default weight_config:**
```json
{
    "interview": 1.0, "support": 0.8, "sales": 0.7, "analytics": 0.7,
    "slack": 0.4, "social": 0.3, "internal": 0.1, "manual": 0.5,
    "notion": 0.5, "mixpanel": 0.7, "airtable": 0.5, "intercom": 0.8, "gong": 0.7
}
```

**Default recency_config:**
```json
{
    "ranges": [
        {"max_days": 7, "factor": 1.0},
        {"max_days": 30, "factor": 0.8},
        {"max_days": 90, "factor": 0.5},
        {"max_days": 999999, "factor": 0.2}
    ]
}
```

**RLS Policies:** Workspace members can view/insert; owners/admins can update.

**Triggers:** `update_workspace_settings_updated_at`

<details>
<summary>Full SQL</summary>

```sql
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
    weight_config JSONB DEFAULT '{
        "interview": 1.0, "support": 0.8, "sales": 0.7, "analytics": 0.7,
        "slack": 0.4, "social": 0.3, "internal": 0.1, "manual": 0.5,
        "notion": 0.5, "mixpanel": 0.7, "airtable": 0.5, "intercom": 0.8, "gong": 0.7
    }',
    weight_template TEXT DEFAULT 'default'
        CHECK (weight_template IN ('default', 'b2b_enterprise', 'plg_growth', 'support_led', 'research_heavy')),
    recency_config JSONB DEFAULT '{
        "ranges": [
            {"max_days": 7, "factor": 1.0},
            {"max_days": 30, "factor": 0.8},
            {"max_days": 90, "factor": 0.5},
            {"max_days": 999999, "factor": 0.2}
        ]
    }',
    target_segments TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view settings for their workspaces" ON workspace_settings
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can create settings for their workspaces" ON workspace_settings
    FOR INSERT WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Owners/admins can update settings" ON workspace_settings
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE TRIGGER update_workspace_settings_updated_at
    BEFORE UPDATE ON workspace_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

</details>

---

### 2.5 workspace_evidence_sources

Per-source integration configuration for automated evidence fetching via n8n.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| workspace_id | UUID | NOT NULL, UNIQUE, FK -> workspaces ON DELETE CASCADE | One-to-one with workspace |
| slack_enabled | BOOLEAN | DEFAULT FALSE | Enable Slack fetching |
| slack_channel_ids | TEXT[] | DEFAULT '{}' | Slack channel IDs to monitor |
| notion_enabled | BOOLEAN | DEFAULT FALSE | Enable Notion fetching |
| notion_database_ids | TEXT[] | DEFAULT '{}' | Notion database IDs to monitor |
| airtable_enabled | BOOLEAN | DEFAULT FALSE | Enable Airtable fetching |
| airtable_sources | JSONB | DEFAULT '[]' | Array of {base_id, table_id} objects |
| mixpanel_enabled | BOOLEAN | DEFAULT FALSE | Enable Mixpanel fetching |
| auto_fetch_enabled | BOOLEAN | DEFAULT FALSE | Enable scheduled auto-fetch |
| auto_fetch_time | TIME | DEFAULT '18:00' | Daily auto-fetch time |
| lookback_hours | INTEGER | DEFAULT 24 | Hours to look back when fetching |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_workspace_evidence_sources_workspace`

**RLS Policies:** Workspace members can view/insert; owners/admins can update/delete.

**Triggers:** `update_workspace_evidence_sources_updated_at`

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS workspace_evidence_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
    slack_enabled BOOLEAN DEFAULT FALSE,
    slack_channel_ids TEXT[] DEFAULT '{}',
    notion_enabled BOOLEAN DEFAULT FALSE,
    notion_database_ids TEXT[] DEFAULT '{}',
    airtable_enabled BOOLEAN DEFAULT FALSE,
    airtable_sources JSONB DEFAULT '[]',
    mixpanel_enabled BOOLEAN DEFAULT FALSE,
    auto_fetch_enabled BOOLEAN DEFAULT FALSE,
    auto_fetch_time TIME DEFAULT '18:00',
    lookback_hours INTEGER DEFAULT 24,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workspace_evidence_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace evidence sources" ON workspace_evidence_sources
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can insert their workspace evidence sources" ON workspace_evidence_sources
    FOR INSERT WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update their workspace evidence sources" ON workspace_evidence_sources
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Users can delete their workspace evidence sources" ON workspace_evidence_sources
    FOR DELETE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE INDEX IF NOT EXISTS idx_workspace_evidence_sources_workspace ON workspace_evidence_sources(workspace_id);

CREATE TRIGGER update_workspace_evidence_sources_updated_at
    BEFORE UPDATE ON workspace_evidence_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

</details>

---

## 3. Session Tables

### 3.1 sessions

Discovery sessions created by users within a workspace.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | |
| user_id | UUID | NOT NULL, FK -> profiles ON DELETE CASCADE | Session owner |
| workspace_id | UUID | FK -> workspaces ON DELETE SET NULL | Parent workspace |
| template_id | UUID | FK -> templates ON DELETE SET NULL | Template used (NULL if blank) |
| title | TEXT | NOT NULL | Session title |
| status | TEXT | DEFAULT 'draft', CHECK IN ('draft','active','completed') | Session lifecycle state |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_sessions_user_id`, `idx_sessions_workspace`

**RLS Policies:**
- Users can CRUD own sessions (user_id = auth.uid())
- Workspace members can view sessions in their workspace

**Triggers:** `update_sessions_updated_at`

<details>
<summary>Full SQL</summary>

```sql
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

CREATE POLICY "Users can view own sessions" ON sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create sessions" ON sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON sessions
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Workspace members can view sessions" ON sessions
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

</details>

---

### 3.2 session_objectives

Required objectives for each discovery session.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | |
| session_id | UUID | NOT NULL, FK -> sessions ON DELETE CASCADE | |
| content | TEXT | NOT NULL | Objective text |
| order_index | INTEGER | DEFAULT 0 | Display order |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_session_objectives_session_id`

**RLS Policies:** FOR ALL via session ownership

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS session_objectives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE session_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own session objectives" ON session_objectives
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_objectives.session_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_session_objectives_session_id ON session_objectives(session_id);
```

</details>

---

### 3.3 session_checklist_items

Optional checklist items for tracking session completeness.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | |
| session_id | UUID | NOT NULL, FK -> sessions ON DELETE CASCADE | |
| content | TEXT | NOT NULL | Checklist item text |
| is_checked | BOOLEAN | DEFAULT FALSE | Completion status |
| is_default | BOOLEAN | DEFAULT FALSE | True if from default list |
| order_index | INTEGER | DEFAULT 0 | Display order |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_session_checklist_session_id`

**Triggers:** `update_session_checklist_updated_at`

<details>
<summary>Full SQL</summary>

```sql
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

CREATE POLICY "Users can manage own session checklist" ON session_checklist_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_checklist_items.session_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_session_checklist_session_id ON session_checklist_items(session_id);

CREATE TRIGGER update_session_checklist_updated_at
    BEFORE UPDATE ON session_checklist_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

</details>

---

### 3.4 constraints

User-defined strategic constraints (vision, KPIs, budget, etc.). Persisted per user, reusable across sessions. Default constraints are auto-created on signup.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | |
| user_id | UUID | NOT NULL, FK -> profiles ON DELETE CASCADE | |
| type | TEXT | NOT NULL | vision, kpi, resources, budget, timeline, technical, custom |
| label | TEXT | NOT NULL | Display label |
| value | TEXT | | Constraint value/description |
| is_system | BOOLEAN | DEFAULT FALSE | True for pre-populated types |
| input_type | TEXT | DEFAULT 'text' | text, number, currency, date, select |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**RLS Policies:** Users can CRUD own constraints (user_id = auth.uid()).

**Triggers:** `update_constraints_updated_at`

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    value TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    input_type TEXT DEFAULT 'text',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE constraints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own constraints" ON constraints
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create constraints" ON constraints
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own constraints" ON constraints
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own constraints" ON constraints
    FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_constraints_updated_at
    BEFORE UPDATE ON constraints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

</details>

---

### 3.5 session_constraints

Junction table linking constraints to specific sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | |
| session_id | UUID | NOT NULL, FK -> sessions ON DELETE CASCADE | |
| constraint_id | UUID | NOT NULL, FK -> constraints ON DELETE CASCADE | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Unique Constraint:** (session_id, constraint_id)

**RLS Policies:** FOR ALL via session ownership.

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS session_constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    constraint_id UUID NOT NULL REFERENCES constraints(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, constraint_id)
);

ALTER TABLE session_constraints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own session constraints" ON session_constraints
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_constraints.session_id
            AND sessions.user_id = auth.uid()
        )
    );
```

</details>

---

## 4. Canvas Tables

### 4.1 sections

Canvas sections within a session. Support typed sections for categorization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | |
| session_id | UUID | NOT NULL, FK -> sessions ON DELETE CASCADE | |
| name | TEXT | NOT NULL | Section name |
| section_type | TEXT | DEFAULT 'general', CHECK IN ('general','problems','solutions','assumptions','evidence','decisions') | Categorization type |
| order_index | INTEGER | DEFAULT 0 | Display order |
| position_x | INTEGER | DEFAULT 0 | Canvas X position |
| position_y | INTEGER | DEFAULT 0 | Canvas Y position |
| width | INTEGER | DEFAULT 300 | Section width in pixels |
| height | INTEGER | DEFAULT 400 | Section height in pixels |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_sections_session_id`

**Triggers:** `update_sections_updated_at`

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    section_type TEXT DEFAULT 'general'
        CHECK (section_type IN ('general', 'problems', 'solutions', 'assumptions', 'evidence', 'decisions')),
    order_index INTEGER DEFAULT 0,
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 300,
    height INTEGER DEFAULT 400,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sections" ON sections
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = sections.session_id
            AND sessions.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_sections_session_id ON sections(session_id);

CREATE TRIGGER update_sections_updated_at
    BEFORE UPDATE ON sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

</details>

---

### 4.2 sticky_notes

Individual sticky notes within canvas sections.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | |
| section_id | UUID | NOT NULL, FK -> sections ON DELETE CASCADE | |
| content | TEXT | NOT NULL | Note content |
| position_x | INTEGER | DEFAULT 0 | Position within section |
| position_y | INTEGER | DEFAULT 0 | Position within section |
| has_evidence | BOOLEAN | DEFAULT FALSE | Auto-computed via trigger when evidence attached |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_sticky_notes_section_id`

**Triggers:** `update_sticky_notes_updated_at`

<details>
<summary>Full SQL</summary>

```sql
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

CREATE TRIGGER update_sticky_notes_updated_at
    BEFORE UPDATE ON sticky_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

</details>

---

### 4.3 sticky_note_links

Connections between sticky notes (many-to-many self-referential).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | |
| source_note_id | UUID | NOT NULL, FK -> sticky_notes ON DELETE CASCADE | |
| target_note_id | UUID | NOT NULL, FK -> sticky_notes ON DELETE CASCADE | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Unique Constraint:** (source_note_id, target_note_id)

**Check Constraint:** source_note_id != target_note_id (no self-links)

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS sticky_note_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_note_id UUID NOT NULL REFERENCES sticky_notes(id) ON DELETE CASCADE,
    target_note_id UUID NOT NULL REFERENCES sticky_notes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_note_id, target_note_id),
    CHECK (source_note_id != target_note_id)
);

ALTER TABLE sticky_note_links ENABLE ROW LEVEL SECURITY;

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
```

</details>

---

## 5. Evidence Tables

### 5.1 evidence

Direct evidence attached to sticky notes (legacy approach; see also evidence_bank for workspace-level evidence).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | |
| sticky_note_id | UUID | NOT NULL, FK -> sticky_notes ON DELETE CASCADE | |
| evidence_bank_id | UUID | FK -> evidence_bank ON DELETE SET NULL | Optional link to bank item |
| type | TEXT | NOT NULL, CHECK IN ('url','text') | Evidence type |
| url | TEXT | | URL if type='url' |
| content | TEXT | | Text content if type='text' |
| title | TEXT | | Optional label |
| strength | TEXT | DEFAULT 'medium', CHECK IN ('high','medium','low') | Evidence strength |
| fetched_content | TEXT | | Content fetched from URL by n8n |
| fetch_status | TEXT | DEFAULT 'unfetched' | unfetched, fetched, failed |
| fetched_at | TIMESTAMPTZ | | When content was fetched |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_evidence_sticky_note_id`, `idx_evidence_fetch_status`

**Triggers:** `on_evidence_change` -- auto-updates `sticky_notes.has_evidence` on INSERT/DELETE

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sticky_note_id UUID NOT NULL REFERENCES sticky_notes(id) ON DELETE CASCADE,
    evidence_bank_id UUID REFERENCES evidence_bank(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('url', 'text')),
    url TEXT,
    content TEXT,
    title TEXT,
    strength TEXT DEFAULT 'medium' CHECK (strength IN ('high', 'medium', 'low')),
    fetched_content TEXT,
    fetch_status TEXT DEFAULT 'unfetched',
    fetched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

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

-- Trigger to auto-update has_evidence on sticky_notes
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
```

</details>

---

### 5.2 evidence_bank

Workspace-level shared, reusable evidence items. Supports manual and automated ingestion from external sources, vector embeddings for semantic search, and computed evidence strength scoring.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | |
| created_by | UUID | FK -> profiles ON DELETE CASCADE, NULLABLE | User who added it (NULL for service-role inserts) |
| workspace_id | UUID | FK -> workspaces ON DELETE CASCADE | |
| title | TEXT | NOT NULL | Evidence title |
| type | TEXT | NOT NULL, CHECK IN ('url','text','file') | Evidence type |
| url | TEXT | | URL for URL-type evidence |
| content | TEXT | | Text content |
| source | TEXT | | Source description |
| tags | TEXT[] | DEFAULT '{}' | Tags array |
| strength | TEXT | DEFAULT 'medium', CHECK IN ('high','medium','low') | Manual strength label |
| source_system | TEXT | DEFAULT 'manual', CHECK IN ('manual','slack','notion','mixpanel','airtable','intercom','gong','interview','support','analytics','social') | Source system |
| source_metadata | JSONB | DEFAULT '{}' | Extra source metadata |
| fetched_content | TEXT | | Content fetched from URL by n8n |
| fetch_status | TEXT | DEFAULT 'unfetched' | unfetched, fetched, failed |
| fetch_metadata | JSONB | DEFAULT '{}' | Fetch metadata (author, last_edited, etc.) |
| fetched_at | TIMESTAMPTZ | | When content was fetched |
| source_weight | NUMERIC(3,2) | DEFAULT 0.50 | Weight by source type (0-1) |
| recency_factor | NUMERIC(3,2) | DEFAULT 1.00 | Decay factor based on age |
| sentiment | TEXT | CHECK IN ('positive','negative','neutral') | AI-classified sentiment |
| segment | TEXT | | User segment (enterprise, smb, etc.) |
| computed_strength | NUMERIC(5,2) | DEFAULT 0.00 | Calculated evidence strength 0-100 |
| source_timestamp | TIMESTAMPTZ | | When evidence was created in source system |
| embedding | vector(384) | | Semantic embedding (all-MiniLM-L6-v2) |
| has_direct_voice | BOOLEAN | DEFAULT FALSE | Whether evidence contains direct user voice |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_evidence_bank_workspace`, `idx_evidence_bank_source`, `idx_evidence_bank_strength`, `idx_evidence_bank_fetch_status`, `idx_evidence_bank_workspace_fetch_status`, `idx_evidence_bank_created_at`, `idx_evidence_bank_computed_strength`, `idx_evidence_bank_source_weight`, `idx_evidence_bank_segment`, `idx_evidence_bank_sentiment`, `idx_evidence_bank_embedding` (IVFFlat vector_cosine_ops, lists=50)

**RLS Policies:** Workspace members can CRUD evidence in their workspaces.

**Triggers:** `update_evidence_bank_updated_at`

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS evidence_bank (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('url', 'text', 'file')),
    url TEXT,
    content TEXT,
    source TEXT,
    tags TEXT[] DEFAULT '{}',
    strength TEXT DEFAULT 'medium' CHECK (strength IN ('high', 'medium', 'low')),
    source_system TEXT DEFAULT 'manual' CHECK (source_system IN (
        'manual', 'slack', 'notion', 'mixpanel', 'airtable',
        'intercom', 'gong', 'interview', 'support', 'analytics', 'social'
    )),
    source_metadata JSONB DEFAULT '{}',
    fetched_content TEXT,
    fetch_status TEXT DEFAULT 'unfetched',
    fetch_metadata JSONB DEFAULT '{}',
    fetched_at TIMESTAMPTZ,
    source_weight NUMERIC(3,2) DEFAULT 0.50,
    recency_factor NUMERIC(3,2) DEFAULT 1.00,
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    segment TEXT,
    computed_strength NUMERIC(5,2) DEFAULT 0.00,
    source_timestamp TIMESTAMPTZ,
    embedding vector(384),
    has_direct_voice BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_evidence_bank_workspace ON evidence_bank(workspace_id);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_source ON evidence_bank(source_system);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_strength ON evidence_bank(strength);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_fetch_status ON evidence_bank(fetch_status);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_workspace_fetch_status ON evidence_bank(workspace_id, fetch_status);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_created_at ON evidence_bank(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_computed_strength ON evidence_bank(computed_strength DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_source_weight ON evidence_bank(source_weight);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_segment ON evidence_bank(segment);
CREATE INDEX IF NOT EXISTS idx_evidence_bank_sentiment ON evidence_bank(sentiment);

CREATE INDEX IF NOT EXISTS idx_evidence_bank_embedding
    ON evidence_bank USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

CREATE TRIGGER update_evidence_bank_updated_at
    BEFORE UPDATE ON evidence_bank
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

</details>

---

### 5.3 sticky_note_evidence_links

Many-to-many junction linking sticky notes to evidence_bank items.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| sticky_note_id | UUID | NOT NULL, FK -> sticky_notes ON DELETE CASCADE | |
| evidence_bank_id | UUID | NOT NULL, FK -> evidence_bank ON DELETE CASCADE | |
| linked_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Unique Constraint:** (sticky_note_id, evidence_bank_id)

**Indexes:** `idx_sticky_note_evidence_links_note`, `idx_sticky_note_evidence_links_bank`

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS sticky_note_evidence_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sticky_note_id UUID REFERENCES sticky_notes(id) ON DELETE CASCADE NOT NULL,
    evidence_bank_id UUID REFERENCES evidence_bank(id) ON DELETE CASCADE NOT NULL,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sticky_note_id, evidence_bank_id)
);

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

CREATE INDEX IF NOT EXISTS idx_sticky_note_evidence_links_note ON sticky_note_evidence_links(sticky_note_id);
CREATE INDEX IF NOT EXISTS idx_sticky_note_evidence_links_bank ON sticky_note_evidence_links(evidence_bank_id);
```

</details>

---

## 6. Insights Tables

### 6.1 insights_feed

Daily fetched insights from external tools via n8n. Pre-bank staging area.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| workspace_id | UUID | NOT NULL, FK -> workspaces ON DELETE CASCADE | |
| source_system | TEXT | NOT NULL, CHECK IN ('slack','notion','mixpanel','airtable') | Source tool |
| title | TEXT | NOT NULL | Insight title |
| content | TEXT | | Insight body |
| url | TEXT | | URL reference |
| source_url | TEXT | | Original source URL |
| strength | TEXT | DEFAULT 'medium', CHECK IN ('high','medium','low') | |
| source_metadata | JSONB | DEFAULT '{}' | |
| is_added_to_bank | BOOLEAN | DEFAULT FALSE | Whether promoted to evidence_bank |
| is_dismissed | BOOLEAN | DEFAULT FALSE | User dismissed this insight |
| ai_summary | TEXT | | AI-generated summary |
| ai_themes | JSONB | DEFAULT '[]' | AI-detected themes |
| ai_action_items | JSONB | DEFAULT '[]' | AI-suggested actions |
| pain_points | JSONB | DEFAULT '[]' | Extracted pain points |
| feature_requests | JSONB | DEFAULT '[]' | Extracted feature requests |
| sentiment | TEXT | | positive, negative, neutral |
| key_quotes | JSONB | DEFAULT '[]' | Notable quotes |
| tags | JSONB | DEFAULT '[]' | Tags |
| analysis_id | UUID | FK -> daily_insights_analysis ON DELETE SET NULL | Link to daily analysis |
| fetched_at | TIMESTAMPTZ | DEFAULT NOW() | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_insights_feed_workspace`, `idx_insights_feed_source`, `idx_insights_feed_fetched`, `idx_insights_feed_analysis`

**RLS Policies:** Workspace members can view/update; service role can insert (for n8n).

<details>
<summary>Full SQL</summary>

```sql
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
    ai_summary TEXT,
    ai_themes JSONB DEFAULT '[]',
    ai_action_items JSONB DEFAULT '[]',
    pain_points JSONB DEFAULT '[]',
    feature_requests JSONB DEFAULT '[]',
    sentiment TEXT,
    key_quotes JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    analysis_id UUID REFERENCES daily_insights_analysis(id) ON DELETE SET NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE insights_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view insights in their workspaces" ON insights_feed
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update insights in their workspaces" ON insights_feed
    FOR UPDATE USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Service role can insert insights" ON insights_feed
    FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_insights_feed_workspace ON insights_feed(workspace_id);
CREATE INDEX IF NOT EXISTS idx_insights_feed_source ON insights_feed(source_system);
CREATE INDEX IF NOT EXISTS idx_insights_feed_fetched ON insights_feed(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_feed_analysis ON insights_feed(analysis_id) WHERE analysis_id IS NOT NULL;
```

</details>

---

### 6.2 daily_insights_analysis

AI analysis of daily insight batches. One record per workspace per day.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| workspace_id | UUID | NOT NULL, FK -> workspaces ON DELETE CASCADE | |
| analysis_date | DATE | NOT NULL | |
| insight_count | INTEGER | DEFAULT 0 | Number of insights analyzed |
| sources_included | TEXT[] | DEFAULT '{}' | Source systems included |
| summary | TEXT | | AI summary |
| themes | JSONB | DEFAULT '[]' | Detected themes |
| patterns | JSONB | DEFAULT '[]' | Detected patterns |
| priorities | JSONB | DEFAULT '[]' | Priority rankings |
| cross_source_connections | JSONB | DEFAULT '[]' | Cross-source connections |
| action_items | JSONB | DEFAULT '[]' | Suggested actions |
| raw_response | JSONB | | Full AI response |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Unique Constraint:** (workspace_id, analysis_date)

**Indexes:** `idx_daily_insights_analysis_workspace_date`

**Triggers:** `update_daily_insights_analysis_updated_at`

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS daily_insights_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    analysis_date DATE NOT NULL,
    insight_count INTEGER DEFAULT 0,
    sources_included TEXT[] DEFAULT '{}',
    summary TEXT,
    themes JSONB DEFAULT '[]',
    patterns JSONB DEFAULT '[]',
    priorities JSONB DEFAULT '[]',
    cross_source_connections JSONB DEFAULT '[]',
    action_items JSONB DEFAULT '[]',
    raw_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, analysis_date)
);

ALTER TABLE daily_insights_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analyses for their workspaces" ON daily_insights_analysis
    FOR SELECT USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE POLICY "Users can create analyses for their workspaces" ON daily_insights_analysis
    FOR INSERT WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE POLICY "Users can update analyses for their workspaces" ON daily_insights_analysis
    FOR UPDATE USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE POLICY "Users can delete analyses for their workspaces" ON daily_insights_analysis
    FOR DELETE USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE INDEX IF NOT EXISTS idx_daily_insights_analysis_workspace_date
    ON daily_insights_analysis(workspace_id, analysis_date DESC);

CREATE TRIGGER update_daily_insights_analysis_updated_at
    BEFORE UPDATE ON daily_insights_analysis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

</details>

---

## 7. Decision Tables

### 7.1 decisions

First-class decision records with evidence-backed gating (commit/validate/park).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| workspace_id | UUID | NOT NULL, FK -> workspaces ON DELETE CASCADE | |
| session_id | UUID | FK -> sessions ON DELETE SET NULL | Optional link to session |
| title | TEXT | NOT NULL | Decision title |
| hypothesis | TEXT | | Hypothesis statement |
| description | TEXT | | Detailed description |
| status | TEXT | NOT NULL, DEFAULT 'validate', CHECK IN ('commit','validate','park') | User-set status |
| gate_recommendation | TEXT | CHECK IN ('commit','validate','park') | Auto-calculated from evidence strength |
| evidence_strength | NUMERIC(5,2) | DEFAULT 0.00 | Aggregate evidence strength 0-100 |
| evidence_count | INTEGER | DEFAULT 0 | Number of linked evidence items |
| success_metrics | JSONB | DEFAULT '[]' | Success metric definitions |
| is_overridden | BOOLEAN | DEFAULT FALSE | True if user overrode gate recommendation |
| override_reason | TEXT | | Required when overriding |
| overridden_at | TIMESTAMPTZ | | When override happened |
| overridden_by | UUID | FK -> profiles ON DELETE SET NULL | Who overrode |
| external_ref | TEXT | | External ticket ref (Linear, Jira) |
| external_url | TEXT | | External ticket URL |
| created_by | UUID | FK -> profiles ON DELETE SET NULL | Creator |
| owner | TEXT | | Decision owner name/identifier |
| review_date | DATE | | Scheduled review date |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_decisions_workspace`, `idx_decisions_status`, `idx_decisions_session`, `idx_decisions_evidence_strength`, `idx_decisions_created_at`

**RLS Policies:** Workspace members can CRUD.

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    hypothesis TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'validate' CHECK (status IN ('commit', 'validate', 'park')),
    gate_recommendation TEXT CHECK (gate_recommendation IN ('commit', 'validate', 'park')),
    evidence_strength NUMERIC(5,2) DEFAULT 0.00,
    evidence_count INTEGER DEFAULT 0,
    success_metrics JSONB DEFAULT '[]',
    is_overridden BOOLEAN DEFAULT FALSE,
    override_reason TEXT,
    overridden_at TIMESTAMPTZ,
    overridden_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    external_ref TEXT,
    external_url TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    owner TEXT,
    review_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view decisions in their workspaces" ON decisions
    FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can create decisions in their workspaces" ON decisions
    FOR INSERT WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can update decisions in their workspaces" ON decisions
    FOR UPDATE USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete decisions in their workspaces" ON decisions
    FOR DELETE USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_decisions_workspace ON decisions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_decisions_session ON decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_decisions_evidence_strength ON decisions(evidence_strength DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON decisions(created_at DESC);
```

</details>

---

### 7.2 evidence_decision_links

Links evidence_bank items to decisions for evidence-backed gating.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| decision_id | UUID | NOT NULL, FK -> decisions ON DELETE CASCADE | |
| evidence_id | UUID | NOT NULL, FK -> evidence_bank ON DELETE CASCADE | |
| segment_match_factor | NUMERIC(3,2) | DEFAULT 1.00 | Segment match score |
| relevance_note | TEXT | | Why this evidence is relevant |
| linked_by | UUID | FK -> profiles ON DELETE SET NULL | Who linked it |
| linked_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Unique Constraint:** (decision_id, evidence_id)

**Indexes:** `idx_evidence_decision_links_decision`, `idx_evidence_decision_links_evidence`

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS evidence_decision_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
    evidence_id UUID NOT NULL REFERENCES evidence_bank(id) ON DELETE CASCADE,
    segment_match_factor NUMERIC(3,2) DEFAULT 1.00,
    relevance_note TEXT,
    linked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(decision_id, evidence_id)
);

ALTER TABLE evidence_decision_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evidence links for decisions in their workspaces" ON evidence_decision_links
    FOR SELECT USING (
        decision_id IN (SELECT id FROM decisions WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        ))
    );

CREATE POLICY "Users can create evidence links for decisions in their workspaces" ON evidence_decision_links
    FOR INSERT WITH CHECK (
        decision_id IN (SELECT id FROM decisions WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        ))
    );

CREATE POLICY "Users can delete evidence links for decisions in their workspaces" ON evidence_decision_links
    FOR DELETE USING (
        decision_id IN (SELECT id FROM decisions WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        ))
    );

CREATE INDEX IF NOT EXISTS idx_evidence_decision_links_decision ON evidence_decision_links(decision_id);
CREATE INDEX IF NOT EXISTS idx_evidence_decision_links_evidence ON evidence_decision_links(evidence_id);
```

</details>

---

## 8. Analysis Tables

### 8.1 session_analyses

AI analysis results for discovery sessions. Includes both basic and comprehensive (Phase 5) analysis fields.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | |
| session_id | UUID | NOT NULL, FK -> sessions ON DELETE CASCADE | |
| objective_score | INTEGER | CHECK 0-100 | Overall session score |
| summary | TEXT | | Analysis summary |
| assumptions | JSONB | | Identified assumptions |
| evidence_backed | JSONB | | Evidence-backed items |
| validation_recommendations | JSONB | | Validation suggestions |
| constraint_analysis | JSONB | | Constraint alignment analysis |
| checklist_review | JSONB | | Checklist completion analysis |
| raw_response | JSONB | | Full AI response |
| session_diagnosis | JSONB | | Session health: quality, maturity, nature, strengths, gaps |
| evidence_assessment | JSONB | | Evidence quality: sources, types, quality_breakdown, score |
| strategic_alignment | JSONB | | Alignment: vision, goals, KPI impact scores |
| solutions_analysis | JSONB | | Solutions: recommendations (BUILD_NOW/VALIDATE_FIRST/DEFER) |
| pattern_detection | JSONB | | Patterns: shared evidence, convergent, contradictions, gaps |
| priority_ranking | JSONB | | Ranked items with score breakdowns |
| next_steps | JSONB | | Actions: build_now, validate_first, defer |
| hypotheses | JSONB | | IF/THEN/BECAUSE hypotheses with research questions |
| conflicts | JSONB | | Detected conflicts with suggestions |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_session_analyses_session_id`

**RLS Policies:** Users can view/create/delete via session ownership.

<details>
<summary>Full SQL</summary>

```sql
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
    session_diagnosis JSONB,
    evidence_assessment JSONB,
    strategic_alignment JSONB,
    solutions_analysis JSONB,
    pattern_detection JSONB,
    priority_ranking JSONB,
    next_steps JSONB,
    hypotheses JSONB,
    conflicts JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE session_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses" ON session_analyses
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_analyses.session_id AND sessions.user_id = auth.uid())
    );

CREATE POLICY "Users can create analyses" ON session_analyses
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_analyses.session_id AND sessions.user_id = auth.uid())
    );

CREATE POLICY "Users can delete own analyses" ON session_analyses
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_analyses.session_id AND sessions.user_id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_session_analyses_session_id ON session_analyses(session_id);
```

</details>

---

## 9. Agent Tables

### 9.1 agent_alerts

AI agent outputs and alerts. Supports the 7-agent architecture plus legacy agent types.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| workspace_id | UUID | NOT NULL, FK -> workspaces ON DELETE CASCADE | |
| agent_type | TEXT | NOT NULL, CHECK (see below) | Which agent produced this |
| alert_type | TEXT | NOT NULL, DEFAULT 'info', CHECK IN ('info','warning','action_needed') | Severity |
| title | TEXT | NOT NULL | Alert title |
| content | TEXT | NOT NULL, DEFAULT '' | Alert body |
| metadata | JSONB | DEFAULT '{}' | Agent-specific structured data |
| related_decision_id | UUID | FK -> decisions ON DELETE SET NULL | |
| related_evidence_ids | UUID[] | DEFAULT '{}' | Related evidence bank IDs |
| is_read | BOOLEAN | DEFAULT FALSE | |
| is_dismissed | BOOLEAN | DEFAULT FALSE | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**agent_type values:** `strength_calculator`, `contradiction_detector`, `segment_identifier`, `session_analyzer`, `brief_generator`, `decay_monitor`, `competitor_monitor`, `evidence_hunter` (legacy), `analysis_crew` (legacy)

**Indexes:** `idx_agent_alerts_workspace`, `idx_agent_alerts_type`, `idx_agent_alerts_unread` (partial), `idx_agent_alerts_created`, `idx_agent_alerts_decision` (partial)

**RLS Policies:** Workspace members can CRUD; service role can insert.

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS agent_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    agent_type TEXT NOT NULL CHECK (agent_type IN (
        'strength_calculator', 'contradiction_detector', 'segment_identifier',
        'session_analyzer', 'brief_generator', 'decay_monitor', 'competitor_monitor',
        'evidence_hunter', 'analysis_crew'
    )),
    alert_type TEXT NOT NULL DEFAULT 'info' CHECK (alert_type IN ('info', 'warning', 'action_needed')),
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    metadata JSONB DEFAULT '{}',
    related_decision_id UUID REFERENCES decisions(id) ON DELETE SET NULL,
    related_evidence_ids UUID[] DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agent alerts in their workspaces" ON agent_alerts
    FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert agent alerts in their workspaces" ON agent_alerts
    FOR INSERT WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can update agent alerts in their workspaces" ON agent_alerts
    FOR UPDATE USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete agent alerts in their workspaces" ON agent_alerts
    FOR DELETE USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Service role can insert agent alerts" ON agent_alerts
    FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agent_alerts_workspace ON agent_alerts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_type ON agent_alerts(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_unread ON agent_alerts(workspace_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_agent_alerts_created ON agent_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_decision ON agent_alerts(related_decision_id) WHERE related_decision_id IS NOT NULL;
```

</details>

---

### 9.2 confidence_history

Tracks evidence strength changes over time for any entity (polymorphic).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| workspace_id | UUID | NOT NULL, FK -> workspaces ON DELETE CASCADE | |
| entity_type | TEXT | NOT NULL, CHECK IN ('evidence_bank','sticky_note','decision','hypothesis') | What entity this tracks |
| entity_id | UUID | NOT NULL | ID of the tracked entity |
| score | NUMERIC(5,2) | NOT NULL | Current score |
| previous_score | NUMERIC(5,2) | | Previous score |
| delta | NUMERIC(5,2) | | Change amount |
| trigger_type | TEXT | CHECK IN ('evidence_linked','evidence_removed','recency_decay','weight_change','manual_override','recalculation') | What caused the change |
| trigger_evidence_id | UUID | FK -> evidence_bank ON DELETE SET NULL | Evidence that triggered change |
| factors | JSONB | DEFAULT '{}' | Breakdown of factors at this point |
| recorded_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_confidence_history_entity`, `idx_confidence_history_workspace`, `idx_confidence_history_recorded_at`

**RLS Policies:** Workspace members can view/insert.

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS confidence_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('evidence_bank', 'sticky_note', 'decision', 'hypothesis')),
    entity_id UUID NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    previous_score NUMERIC(5,2),
    delta NUMERIC(5,2),
    trigger_type TEXT CHECK (trigger_type IN (
        'evidence_linked', 'evidence_removed', 'recency_decay',
        'weight_change', 'manual_override', 'recalculation'
    )),
    trigger_evidence_id UUID REFERENCES evidence_bank(id) ON DELETE SET NULL,
    factors JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE confidence_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view confidence history in their workspaces" ON confidence_history
    FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert confidence history in their workspaces" ON confidence_history
    FOR INSERT WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_confidence_history_entity ON confidence_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_confidence_history_workspace ON confidence_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_confidence_history_recorded_at ON confidence_history(recorded_at DESC);
```

</details>

---

## 10. Outcome Tables

### 10.1 outcomes

Tracks what happened after decisions were made. Links back to decisions for calibration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| workspace_id | UUID | NOT NULL, FK -> workspaces ON DELETE CASCADE | |
| decision_id | UUID | NOT NULL, FK -> decisions ON DELETE CASCADE | |
| outcome_type | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('success','partial','failure','pending') | Result |
| title | TEXT | NOT NULL, DEFAULT '' | Outcome title |
| target_metrics | JSONB | DEFAULT '[]' | Expected metric targets |
| actual_metrics | JSONB | DEFAULT '[]' | Actual metric results |
| learnings | TEXT | | What was learned |
| source_retrospective | TEXT | | Link to retro document |
| review_date | DATE | | When outcome was reviewed |
| created_by | UUID | FK -> auth.users ON DELETE SET NULL | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_outcomes_workspace`, `idx_outcomes_decision`, `idx_outcomes_type`

**Triggers:** `update_outcomes_updated_at`

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
    outcome_type TEXT NOT NULL DEFAULT 'pending' CHECK (outcome_type IN ('success', 'partial', 'failure', 'pending')),
    title TEXT NOT NULL DEFAULT '',
    target_metrics JSONB DEFAULT '[]'::jsonb,
    actual_metrics JSONB DEFAULT '[]'::jsonb,
    learnings TEXT,
    source_retrospective TEXT,
    review_date DATE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view outcomes" ON outcomes
    FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Workspace members can create outcomes" ON outcomes
    FOR INSERT WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Workspace members can update outcomes" ON outcomes
    FOR UPDATE USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Workspace members can delete outcomes" ON outcomes
    FOR DELETE USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_outcomes_workspace ON outcomes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_decision ON outcomes(decision_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_type ON outcomes(outcome_type);

CREATE TRIGGER update_outcomes_updated_at
    BEFORE UPDATE ON outcomes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

</details>

---

### 10.2 pm_calibration

Tracks prediction accuracy per user per workspace over time periods.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| workspace_id | UUID | NOT NULL, FK -> workspaces ON DELETE CASCADE | |
| user_id | UUID | NOT NULL, FK -> auth.users ON DELETE CASCADE | |
| total_predictions | INTEGER | DEFAULT 0 | Total predictions made |
| correct_predictions | INTEGER | DEFAULT 0 | Correct predictions |
| prediction_accuracy | DECIMAL(5,2) | DEFAULT 0 | Accuracy percentage |
| source_reliability | JSONB | DEFAULT '{}' | Per-source reliability scores |
| period_start | DATE | NOT NULL | Period start date |
| period_end | DATE | NOT NULL | Period end date |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Unique Constraint:** (workspace_id, user_id, period_start, period_end)

**Indexes:** `idx_pm_calibration_workspace`, `idx_pm_calibration_user`, `idx_pm_calibration_period`

**Triggers:** `update_pm_calibration_updated_at`

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS pm_calibration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_predictions INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    prediction_accuracy DECIMAL(5,2) DEFAULT 0,
    source_reliability JSONB DEFAULT '{}'::jsonb,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, user_id, period_start, period_end)
);

ALTER TABLE pm_calibration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view calibration data" ON pm_calibration
    FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Workspace members can create calibration data" ON pm_calibration
    FOR INSERT WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Workspace members can update calibration data" ON pm_calibration
    FOR UPDATE USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Workspace members can delete calibration data" ON pm_calibration
    FOR DELETE USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_pm_calibration_workspace ON pm_calibration(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pm_calibration_user ON pm_calibration(user_id);
CREATE INDEX IF NOT EXISTS idx_pm_calibration_period ON pm_calibration(period_start, period_end);

CREATE TRIGGER update_pm_calibration_updated_at
    BEFORE UPDATE ON pm_calibration
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

</details>

---

## 11. Validation Tables

### 11.1 validation_workflows

Hypothesis tracking and validation progress for discovery sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| session_id | UUID | NOT NULL, FK -> sessions ON DELETE CASCADE | |
| analysis_id | UUID | FK -> session_analyses ON DELETE SET NULL | |
| user_id | UUID | NOT NULL, FK -> auth.users ON DELETE CASCADE | |
| workspace_id | UUID | FK -> workspaces ON DELETE CASCADE | |
| item_type | TEXT | NOT NULL, CHECK IN ('problem','assumption','hypothesis','solution') | What is being validated |
| item_content | TEXT | NOT NULL | Content being validated |
| item_section | TEXT | | Source section name |
| original_confidence | NUMERIC(3,2) | CHECK 0-1 | Starting confidence |
| hypothesis_if | TEXT | | IF part of hypothesis |
| hypothesis_then | TEXT | | THEN part of hypothesis |
| hypothesis_because | TEXT | | BECAUSE part of hypothesis |
| validation_method | TEXT | | survey, interview, analytics, prototype_test, A_B_test |
| research_questions | JSONB | DEFAULT '[]' | |
| success_criteria | TEXT | | |
| sample_size_target | TEXT | | |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','in_progress','validated','invalidated','needs_more_data','pivoted') | |
| priority | TEXT | DEFAULT 'medium', CHECK IN ('high','medium','low') | |
| actual_sample_size | INTEGER | | |
| test_results | TEXT | | |
| key_findings | JSONB | DEFAULT '[]' | |
| final_confidence | NUMERIC(3,2) | CHECK 0-1 | |
| decision | TEXT | | build, pivot, kill, investigate_more |
| decision_rationale | TEXT | | |
| next_actions | JSONB | DEFAULT '[]' | |
| started_at | TIMESTAMPTZ | | |
| completed_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_validation_workflows_session`, `idx_validation_workflows_user`, `idx_validation_workflows_workspace`, `idx_validation_workflows_status`

**Triggers:** `trigger_validation_workflows_updated_at`

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS validation_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    analysis_id UUID REFERENCES session_analyses(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('problem', 'assumption', 'hypothesis', 'solution')),
    item_content TEXT NOT NULL,
    item_section TEXT,
    original_confidence NUMERIC(3,2) CHECK (original_confidence >= 0 AND original_confidence <= 1),
    hypothesis_if TEXT,
    hypothesis_then TEXT,
    hypothesis_because TEXT,
    validation_method TEXT,
    research_questions JSONB DEFAULT '[]'::jsonb,
    success_criteria TEXT,
    sample_size_target TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'validated', 'invalidated', 'needs_more_data', 'pivoted')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    actual_sample_size INTEGER,
    test_results TEXT,
    key_findings JSONB DEFAULT '[]'::jsonb,
    final_confidence NUMERIC(3,2) CHECK (final_confidence >= 0 AND final_confidence <= 1),
    decision TEXT,
    decision_rationale TEXT,
    next_actions JSONB DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE validation_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their validation workflows" ON validation_workflows
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view workspace validation workflows" ON validation_workflows
    FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can create validation workflows" ON validation_workflows
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their validation workflows" ON validation_workflows
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their validation workflows" ON validation_workflows
    FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_validation_workflows_session ON validation_workflows(session_id);
CREATE INDEX IF NOT EXISTS idx_validation_workflows_user ON validation_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_validation_workflows_workspace ON validation_workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_validation_workflows_status ON validation_workflows(status);

CREATE TRIGGER trigger_validation_workflows_updated_at
    BEFORE UPDATE ON validation_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

</details>

---

### 11.2 validation_workflow_history

Audit trail for validation workflow changes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| workflow_id | UUID | NOT NULL, FK -> validation_workflows ON DELETE CASCADE | |
| changed_by | UUID | NOT NULL, FK -> auth.users ON DELETE CASCADE | |
| field_changed | TEXT | NOT NULL | Name of field that changed |
| old_value | TEXT | | Previous value |
| new_value | TEXT | | New value |
| change_note | TEXT | | Optional note about the change |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_validation_history_workflow`

<details>
<summary>Full SQL</summary>

```sql
CREATE TABLE IF NOT EXISTS validation_workflow_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES validation_workflows(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    field_changed TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE validation_workflow_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow history" ON validation_workflow_history
    FOR SELECT USING (
        workflow_id IN (
            SELECT id FROM validation_workflows
            WHERE user_id = auth.uid()
            OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can create workflow history" ON validation_workflow_history
    FOR INSERT WITH CHECK (changed_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_validation_history_workflow ON validation_workflow_history(workflow_id);
```

</details>

---

## 12. External Tables

### 12.1 discovery_briefs

AI-generated executive discovery briefs that can be shared publicly via token.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| workspace_id | UUID | NOT NULL, FK -> workspaces ON DELETE CASCADE | |
| session_id | UUID | FK -> sessions ON DELETE SET NULL | |
| title | TEXT | NOT NULL | Brief title |
| content | TEXT | NOT NULL, DEFAULT '' | Brief body (markdown) |
| evidence_count | INTEGER | DEFAULT 0 | Evidence items referenced |
| decision_count | INTEGER | DEFAULT 0 | Decisions referenced |
| key_themes | JSONB | DEFAULT '[]' | Key themes identified |
| top_risks | JSONB | DEFAULT '[]' | Top risks identified |
| share_token | TEXT | UNIQUE | Public sharing token |
| is_public | BOOLEAN | DEFAULT FALSE | Whether publicly accessible |
| generated_by | UUID | FK -> auth.users ON DELETE SET NULL | |
| raw_response | JSONB | | Full AI response |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_discovery_briefs_workspace`, `idx_discovery_briefs_session`, `idx_discovery_briefs_share_token` (partial)

**Triggers:** `update_discovery_briefs_updated_at`

<details>
<summary>Full SQL</summary>

```sql
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

ALTER TABLE discovery_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view discovery briefs" ON discovery_briefs
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
        OR (is_public = true AND share_token IS NOT NULL)
    );
CREATE POLICY "Workspace members can create discovery briefs" ON discovery_briefs
    FOR INSERT WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Workspace members can update discovery briefs" ON discovery_briefs
    FOR UPDATE USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Workspace members can delete discovery briefs" ON discovery_briefs
    FOR DELETE USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_discovery_briefs_workspace ON discovery_briefs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_discovery_briefs_session ON discovery_briefs(session_id);
CREATE INDEX IF NOT EXISTS idx_discovery_briefs_share_token ON discovery_briefs(share_token) WHERE share_token IS NOT NULL;

CREATE TRIGGER update_discovery_briefs_updated_at
    BEFORE UPDATE ON discovery_briefs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

</details>

---

### 12.2 external_integrations

Configuration for external tool integrations (Linear, Jira). One per workspace per integration type.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| workspace_id | UUID | NOT NULL, FK -> workspaces ON DELETE CASCADE | |
| integration_type | TEXT | NOT NULL, CHECK IN ('linear','jira') | |
| api_key_encrypted | TEXT | | Encrypted API key |
| base_url | TEXT | | API base URL |
| team_id | TEXT | | Team/org identifier |
| project_key | TEXT | | Project key |
| is_active | BOOLEAN | DEFAULT FALSE | |
| config | JSONB | DEFAULT '{}' | Additional config |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Unique Constraint:** (workspace_id, integration_type)

**Indexes:** `idx_external_integrations_workspace`

**Triggers:** `update_external_integrations_updated_at`

<details>
<summary>Full SQL</summary>

```sql
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

ALTER TABLE external_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view integrations" ON external_integrations
    FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Workspace members can create integrations" ON external_integrations
    FOR INSERT WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Workspace members can update integrations" ON external_integrations
    FOR UPDATE USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Workspace members can delete integrations" ON external_integrations
    FOR DELETE USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_external_integrations_workspace ON external_integrations(workspace_id);

CREATE TRIGGER update_external_integrations_updated_at
    BEFORE UPDATE ON external_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

</details>

---

### 12.3 external_pushes

Records of decisions pushed to external tools (Linear, Jira).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| workspace_id | UUID | NOT NULL, FK -> workspaces ON DELETE CASCADE | |
| decision_id | UUID | NOT NULL, FK -> decisions ON DELETE CASCADE | |
| integration_type | TEXT | NOT NULL, CHECK IN ('linear','jira') | Target tool |
| external_id | TEXT | | ID in external system |
| external_url | TEXT | | URL in external system |
| external_status | TEXT | | Status in external system |
| push_status | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','success','failed') | Push result |
| error_message | TEXT | | Error details if failed |
| pushed_by | UUID | FK -> auth.users ON DELETE SET NULL | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `idx_external_pushes_workspace`, `idx_external_pushes_decision`

**Triggers:** `update_external_pushes_updated_at`

<details>
<summary>Full SQL</summary>

```sql
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

ALTER TABLE external_pushes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view pushes" ON external_pushes
    FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Workspace members can create pushes" ON external_pushes
    FOR INSERT WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Workspace members can update pushes" ON external_pushes
    FOR UPDATE USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_external_pushes_workspace ON external_pushes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_external_pushes_decision ON external_pushes(decision_id);

CREATE TRIGGER update_external_pushes_updated_at
    BEFORE UPDATE ON external_pushes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

</details>

---

## 13. Helper Functions

```sql
-- Auto-update updated_at timestamp
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

-- Generate 8-character invite codes (excludes ambiguous chars: 0, O, 1, I)
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

-- Get all workspace IDs for a user (SECURITY DEFINER to avoid RLS circular dependency)
CREATE OR REPLACE FUNCTION get_user_workspace_ids(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE SQL SECURITY DEFINER STABLE
AS $$
    SELECT workspace_id FROM workspace_members WHERE user_id = user_uuid;
$$;

-- Get single workspace ID for a user
CREATE OR REPLACE FUNCTION get_user_workspace_id(user_uuid UUID)
RETURNS UUID AS $$
    SELECT workspace_id FROM workspace_members WHERE user_id = user_uuid LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Create default constraints for new users
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

-- Create workspace for new user (auto-creates workspace + membership + settings)
CREATE OR REPLACE FUNCTION create_workspace_for_user()
RETURNS TRIGGER AS $$
DECLARE
    new_workspace_id UUID;
BEGIN
    INSERT INTO workspaces (name, created_by)
    VALUES (COALESCE(NEW.full_name, 'My Workspace') || '''s Workspace', NEW.id)
    RETURNING id INTO new_workspace_id;

    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, NEW.id, 'owner');

    INSERT INTO workspace_settings (workspace_id)
    VALUES (new_workspace_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update has_evidence flag on sticky_notes
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

-- Semantic vector search for evidence
CREATE OR REPLACE FUNCTION search_evidence(
  query_embedding vector(384),
  target_workspace_id UUID,
  match_limit INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID, title TEXT, content TEXT, url TEXT, type TEXT,
  source_system TEXT, strength TEXT, computed_strength FLOAT,
  segment TEXT, source_timestamp TIMESTAMPTZ, created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT eb.id, eb.title, eb.content, eb.url, eb.type,
    eb.source_system, eb.strength, eb.computed_strength::FLOAT,
    eb.segment, eb.source_timestamp, eb.created_at,
    (1 - (eb.embedding <=> query_embedding))::FLOAT AS similarity
  FROM evidence_bank eb
  WHERE eb.workspace_id = target_workspace_id
    AND eb.embedding IS NOT NULL
    AND (1 - (eb.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY eb.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;
```

---

## 14. Triggers

| Trigger | Table | Event | Function | Purpose |
|---------|-------|-------|----------|---------|
| on_auth_user_created | auth.users | AFTER INSERT | handle_new_user() | Auto-create profile |
| update_profiles_updated_at | profiles | BEFORE UPDATE | update_updated_at() | Auto-update timestamp |
| on_profile_created | profiles | AFTER INSERT | create_default_constraints() | Seed default constraints |
| on_profile_created_create_workspace | profiles | AFTER INSERT | create_workspace_for_user() | Auto-create workspace |
| update_workspaces_updated_at | workspaces | BEFORE UPDATE | update_updated_at() | Auto-update timestamp |
| update_workspace_settings_updated_at | workspace_settings | BEFORE UPDATE | update_updated_at() | Auto-update timestamp |
| update_workspace_evidence_sources_updated_at | workspace_evidence_sources | BEFORE UPDATE | update_updated_at() | Auto-update timestamp |
| update_sessions_updated_at | sessions | BEFORE UPDATE | update_updated_at() | Auto-update timestamp |
| update_session_checklist_updated_at | session_checklist_items | BEFORE UPDATE | update_updated_at() | Auto-update timestamp |
| update_constraints_updated_at | constraints | BEFORE UPDATE | update_updated_at() | Auto-update timestamp |
| update_sections_updated_at | sections | BEFORE UPDATE | update_updated_at() | Auto-update timestamp |
| update_sticky_notes_updated_at | sticky_notes | BEFORE UPDATE | update_updated_at() | Auto-update timestamp |
| on_evidence_change | evidence | AFTER INSERT OR DELETE | update_has_evidence() | Sync has_evidence flag |
| update_evidence_bank_updated_at | evidence_bank | BEFORE UPDATE | update_updated_at() | Auto-update timestamp |
| update_daily_insights_analysis_updated_at | daily_insights_analysis | BEFORE UPDATE | update_updated_at() | Auto-update timestamp |
| trigger_validation_workflows_updated_at | validation_workflows | BEFORE UPDATE | update_updated_at() | Auto-update timestamp |
| update_discovery_briefs_updated_at | discovery_briefs | BEFORE UPDATE | update_updated_at_column() | Auto-update timestamp |
| update_external_integrations_updated_at | external_integrations | BEFORE UPDATE | update_updated_at_column() | Auto-update timestamp |
| update_external_pushes_updated_at | external_pushes | BEFORE UPDATE | update_updated_at_column() | Auto-update timestamp |
| update_outcomes_updated_at | outcomes | BEFORE UPDATE | update_updated_at_column() | Auto-update timestamp |
| update_pm_calibration_updated_at | pm_calibration | BEFORE UPDATE | update_updated_at_column() | Auto-update timestamp |

---

## 15. Seed Data

### System Templates

```sql
INSERT INTO templates (id, name, description, is_system) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Blank Canvas',
     'Start from scratch with an empty canvas', TRUE),
    ('00000000-0000-0000-0000-000000000002', 'Full Discovery Session',
     'Complete discovery template with Problem Space, Target Users, Observed Problems, and Proposed Solutions sections', TRUE)
ON CONFLICT (id) DO NOTHING;
```

### Template Sections (Full Discovery Session)

| Section | Order |
|---------|-------|
| Problem Space | 0 |
| Target Users | 1 |
| Observed Problems | 2 |
| Proposed Solutions | 3 |

### Default Constraints (per user on signup)

| Type | Label | Input Type |
|------|-------|------------|
| vision | Vision | text |
| kpi | KPIs / Success Metrics | text |
| resources | Engineering Resources | number |
| budget | Budget | currency |
| timeline | Timeline | date |
| technical | Technical Limitations | text |

### Default Checklist Items (per session)

1. Identified at least one target user segment
2. Documented observed problems with context
3. Linked evidence to key assumptions
4. Considered constraints in proposed solutions
5. Defined next validation steps

---

## 16. Entity Relationship Diagram

```
auth.users
    |
    v
profiles ──────────────────────────────────────────────┐
    |                                                    |
    |--< constraints                                     |
    |       |                                            |
    |       └──< session_constraints >── sessions        |
    |                                       |            |
    |--< sessions ──────────────────────────┘            |
    |       |                                            |
    |       |--< session_objectives                      |
    |       |--< session_checklist_items                 |
    |       |--< session_analyses                        |
    |       |       |                                    |
    |       |       └──< validation_workflows            |
    |       |               |                            |
    |       |               └──< validation_workflow_history
    |       |                                            |
    |       |--< sections                                |
    |       |       |                                    |
    |       |       └──< sticky_notes                    |
    |       |               |                            |
    |       |               |--< evidence                |
    |       |               |--< sticky_note_links (self-ref)
    |       |               └──< sticky_note_evidence_links
    |       |                       |                    |
    |       |                       v                    |
    |       |               evidence_bank <──────────────┤
    |       |                   |                        |
    |       |--< decisions      |                        |
    |       |       |           |                        |
    |       |       └──< evidence_decision_links ────────┘
    |       |       |
    |       |       |--< outcomes
    |       |       |--< external_pushes
    |       |       └──< agent_alerts
    |       |
    |       └──< discovery_briefs
    |
    └── (created_by) ──> workspaces
                            |
                            |--< workspace_members >── profiles
                            |--< workspace_settings
                            |--< workspace_invites
                            |--< workspace_evidence_sources
                            |--< evidence_bank
                            |--< insights_feed
                            |       |
                            |       └── daily_insights_analysis
                            |--< decisions
                            |--< agent_alerts
                            |--< confidence_history
                            |--< outcomes
                            |--< pm_calibration
                            |--< discovery_briefs
                            |--< external_integrations
                            |--< external_pushes
                            └--< validation_workflows
```

**Key relationships:**
- `profiles` 1:1 `auth.users` -- every auth user has a profile
- `workspaces` 1:N `workspace_members` N:1 `profiles` -- many-to-many via junction
- `sessions` belong to `profiles` (owner) and optionally `workspaces`
- `sections` -> `sticky_notes` -> `evidence` -- canvas hierarchy
- `evidence_bank` is workspace-level shared evidence, linked to notes via `sticky_note_evidence_links`
- `decisions` are workspace-level, linked to evidence via `evidence_decision_links`
- `outcomes` track post-decision results, linked back to `decisions`
- `agent_alerts` and `confidence_history` are workspace-scoped
- `discovery_briefs` can be publicly shared via `share_token`
- `external_pushes` link `decisions` to `external_integrations` (Linear/Jira)

---

## 17. Migration Order

The following SQL migration files were merged into this document, listed in chronological order:

| # | File | Description | Tables Added/Modified |
|---|------|-------------|----------------------|
| 1 | `supabase_consolidated_schema.sql` | Consolidated schema (Phases 1-6): core tables, workspaces, sessions, canvas, evidence, insights, analysis, validation | 24 tables created |
| 2 | `supabase_phase_a_evidence_strength.sql` | Evidence strength foundation: scoring columns, weight config, confidence_history | +1 table (confidence_history), modified evidence_bank + workspace_settings |
| 3 | `supabase_phase_b_decisions.sql` | Decision records MVP: decisions + evidence-decision links | +2 tables (decisions, evidence_decision_links) |
| 4 | `supabase_phase_c_enhanced_canvas.sql` | Enhanced canvas: section_type column on sections | Modified sections |
| 5 | `supabase_phase_d_vector_search.sql` | Vector search: pgvector extension, embedding column, search function | Modified evidence_bank, added search_evidence function |
| 6 | `supabase_phase_e_agents.sql` | AI agent system: agent_alerts table | +1 table (agent_alerts) |
| 7 | `supabase_phase_f_discovery_brief_push.sql` | Discovery briefs + external push: briefs, integrations, pushes | +3 tables (discovery_briefs, external_integrations, external_pushes) |
| 8 | `supabase_phase_g_outcomes_calibration.sql` | Outcomes + calibration: outcomes, pm_calibration | +2 tables (outcomes, pm_calibration) |
| 9 | `supabase_agent_architecture_update.sql` | Agent architecture v2: expanded agent_type CHECK constraint to 7+2 agent types | Modified agent_alerts |
| 10 | `supabase_fix_evidence_bank_column.sql` | Fix: renamed user_id to created_by on evidence_bank, made nullable, added source_metadata | Modified evidence_bank |
| 11 | `supabase_user_flow_improvements.sql` | User flow: added owner + review_date to decisions, has_direct_voice to evidence_bank | Modified decisions + evidence_bank |

---

## 18. Table Count Summary

| # | Table | Group | Phase |
|---|-------|-------|-------|
| 1 | profiles | Core | Base |
| 2 | templates | Core | Base |
| 3 | template_sections | Core | Base |
| 4 | workspaces | Workspaces | Phase 2 |
| 5 | workspace_members | Workspaces | Phase 2 |
| 6 | workspace_invites | Workspaces | Phase 3 |
| 7 | workspace_settings | Workspaces | Phase 2 |
| 8 | workspace_evidence_sources | Workspaces | Phase 4 |
| 9 | sessions | Sessions | Base |
| 10 | session_objectives | Sessions | Base |
| 11 | session_checklist_items | Sessions | Base |
| 12 | constraints | Sessions | Base |
| 13 | session_constraints | Sessions | Base |
| 14 | sections | Canvas | Base |
| 15 | sticky_notes | Canvas | Base |
| 16 | sticky_note_links | Canvas | Base |
| 17 | evidence | Evidence | Base |
| 18 | evidence_bank | Evidence | Phase 2 |
| 19 | sticky_note_evidence_links | Evidence | Phase 2 |
| 20 | insights_feed | Insights | Phase 4 |
| 21 | daily_insights_analysis | Insights | Phase 4 |
| 22 | decisions | Decisions | Phase B |
| 23 | evidence_decision_links | Decisions | Phase B |
| 24 | session_analyses | Analysis | Base |
| 25 | agent_alerts | Agents | Phase E |
| 26 | confidence_history | Agents | Phase A |
| 27 | outcomes | Outcomes | Phase G |
| 28 | pm_calibration | Outcomes | Phase G |
| 29 | validation_workflows | Validation | Phase 6 |
| 30 | validation_workflow_history | Validation | Phase 6 |
| 31 | discovery_briefs | External | Phase F |
| 32 | external_integrations | External | Phase F |
| 33 | external_pushes | External | Phase F |

**Total: 33 tables**
