# Database Schema

## Overview

PostgreSQL database hosted on Supabase. Uses Supabase Auth for user management.

---

## Tables

### 1. profiles

Extends Supabase Auth users with app-specific data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, FK → auth.users | User ID from Supabase Auth |
| email | text | NOT NULL | User email |
| full_name | text | | Display name |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

---

### 2. templates

Pre-built and custom canvas templates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| name | text | NOT NULL | Template name |
| description | text | | Template description |
| is_system | boolean | DEFAULT false | True for pre-built templates |
| created_by | uuid | FK → profiles | NULL for system templates |
| created_at | timestamptz | DEFAULT now() | |

**Default system templates:**
- Blank Canvas
- Problem Space
- Target Users
- Observed Problems
- Proposed Solutions

---

### 3. template_sections

Default sections for each template.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| template_id | uuid | FK → templates, NOT NULL | |
| name | text | NOT NULL | Section name |
| order_index | integer | DEFAULT 0 | Display order |
| created_at | timestamptz | DEFAULT now() | |

---

### 4. sessions

Discovery sessions created by users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| user_id | uuid | FK → profiles, NOT NULL | Session owner |
| template_id | uuid | FK → templates | Template used (NULL if blank) |
| title | text | NOT NULL | Session title |
| status | text | DEFAULT 'draft' | draft, active, completed |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

---

### 5. session_objectives

Required objectives for each session.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| session_id | uuid | FK → sessions, NOT NULL | |
| content | text | NOT NULL | Objective text |
| order_index | integer | DEFAULT 0 | Display order |
| created_at | timestamptz | DEFAULT now() | |

---

### 6. session_checklist_items

Optional checklist items for sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| session_id | uuid | FK → sessions, NOT NULL | |
| content | text | NOT NULL | Checklist item text |
| is_checked | boolean | DEFAULT false | Completion status |
| is_default | boolean | DEFAULT false | True if from default list |
| order_index | integer | DEFAULT 0 | Display order |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

---

### 7. constraints

User-defined constraints (persisted per user, reusable across sessions).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| user_id | uuid | FK → profiles, NOT NULL | |
| type | text | NOT NULL | vision, kpi, resources, budget, timeline, technical, custom |
| label | text | NOT NULL | Display label |
| value | text | | Constraint value/description |
| is_system | boolean | DEFAULT false | True for pre-populated types |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

---

### 8. session_constraints

Links constraints to specific sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| session_id | uuid | FK → sessions, NOT NULL | |
| constraint_id | uuid | FK → constraints, NOT NULL | |
| created_at | timestamptz | DEFAULT now() | |

**Unique constraint:** (session_id, constraint_id)

---

### 9. sections

Sections within a session canvas.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| session_id | uuid | FK → sessions, NOT NULL | |
| name | text | NOT NULL | Section name |
| order_index | integer | DEFAULT 0 | Display order |
| position_x | integer | DEFAULT 0 | Canvas X position |
| position_y | integer | DEFAULT 0 | Canvas Y position |
| width | integer | DEFAULT 300 | Section width |
| height | integer | DEFAULT 400 | Section height |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

---

### 10. sticky_notes

Individual sticky notes within sections.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| section_id | uuid | FK → sections, NOT NULL | |
| content | text | NOT NULL | Note content |
| position_x | integer | DEFAULT 0 | Position within section |
| position_y | integer | DEFAULT 0 | Position within section |
| has_evidence | boolean | DEFAULT false | Computed: true if evidence exists |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

---

### 11. evidence

Evidence attached to sticky notes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| sticky_note_id | uuid | FK → sticky_notes, NOT NULL | |
| type | text | NOT NULL | 'url' or 'text' |
| url | text | | URL if type = 'url' |
| content | text | | Text content if type = 'text' |
| title | text | | Optional title/label |
| created_at | timestamptz | DEFAULT now() | |

---

### 12. sticky_note_links

Links/connections between sticky notes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| source_note_id | uuid | FK → sticky_notes, NOT NULL | |
| target_note_id | uuid | FK → sticky_notes, NOT NULL | |
| created_at | timestamptz | DEFAULT now() | |

**Unique constraint:** (source_note_id, target_note_id)

---

### 13. session_analyses

AI analysis results for sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| session_id | uuid | FK → sessions, NOT NULL | |
| objective_score | integer | | 0-100 score |
| summary | text | | Overall analysis summary |
| assumptions | jsonb | | Array of assumption items |
| evidence_backed | jsonb | | Array of evidence-backed items |
| validation_recommendations | jsonb | | Validation suggestions |
| constraint_analysis | jsonb | | How ideas align with constraints |
| checklist_review | jsonb | | Checklist completion analysis |
| raw_response | jsonb | | Full Claude API response |
| created_at | timestamptz | DEFAULT now() | |

---

## Entity Relationship Diagram

```
profiles
    │
    ├──< sessions
    │       │
    │       ├──< session_objectives
    │       ├──< session_checklist_items
    │       ├──< session_constraints >── constraints
    │       ├──< sections
    │       │       │
    │       │       └──< sticky_notes
    │       │               │
    │       │               ├──< evidence
    │       │               └──< sticky_note_links (self-referential)
    │       │
    │       └──< session_analyses
    │
    └──< constraints

templates
    │
    └──< template_sections
```

---

## Row Level Security (RLS) Policies

All tables will have RLS enabled. Users can only access their own data.

```sql
-- Example policy for sessions table
CREATE POLICY "Users can view own sessions"
    ON sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
    ON sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
    ON sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
    ON sessions FOR DELETE
    USING (auth.uid() = user_id);
```

---

## Indexes

```sql
-- Performance indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sections_session_id ON sections(session_id);
CREATE INDEX idx_sticky_notes_section_id ON sticky_notes(section_id);
CREATE INDEX idx_evidence_sticky_note_id ON evidence(sticky_note_id);
CREATE INDEX idx_session_objectives_session_id ON session_objectives(session_id);
CREATE INDEX idx_session_checklist_session_id ON session_checklist_items(session_id);
```

---

## Default Data

### System Templates

```sql
INSERT INTO templates (id, name, description, is_system) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Blank Canvas', 'Start from scratch', true),
    ('00000000-0000-0000-0000-000000000002', 'Problem Space', 'Explore and define the problem space', true),
    ('00000000-0000-0000-0000-000000000003', 'Target Users', 'Identify and analyze target users', true),
    ('00000000-0000-0000-0000-000000000004', 'Observed Problems', 'Document observed user problems', true),
    ('00000000-0000-0000-0000-000000000005', 'Proposed Solutions', 'Brainstorm and evaluate solutions', true);
```

### Default Checklist Items (inserted per session)

1. Identified at least one target user segment
2. Documented observed problems with context
3. Linked evidence to key assumptions
4. Considered constraints in proposed solutions
5. Defined next validation steps

### Default Constraint Types (inserted per user on signup)

1. Vision
2. KPIs / Success Metrics
3. Engineering Resources
4. Budget
5. Timeline
6. Technical Limitations
