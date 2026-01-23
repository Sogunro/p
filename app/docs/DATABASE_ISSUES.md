# Database Issues & Reference Document

> **Last Updated:** 2026-01-23

This document tracks database schema issues, RLS policy problems, and gaps between the current implementation and the product vision.

---

## Table of Contents
1. [Current Database Overview](#current-database-overview)
2. [RLS Policy Issues](#rls-policy-issues)
3. [Schema Inconsistencies](#schema-inconsistencies)
4. [Missing Features (Vision vs Built)](#missing-features-vision-vs-built)
5. [SQL File Consolidation Notes](#sql-file-consolidation-notes)
6. [Fix Recommendations](#fix-recommendations)

---

## Current Database Overview

### Tables (22 Total)

| Category | Tables |
|----------|--------|
| **User & Auth** | `profiles` |
| **Templates** | `templates`, `template_sections` |
| **Sessions** | `sessions`, `sections`, `sticky_notes`, `session_objectives`, `session_checklist_items`, `session_constraints`, `constraints` |
| **Evidence** | `evidence`, `evidence_bank`, `sticky_note_evidence_links`, `sticky_note_links` |
| **Analysis** | `session_analyses`, `daily_insights_analysis` |
| **Workspace** | `workspaces`, `workspace_members`, `workspace_invites`, `workspace_settings`, `workspace_evidence_sources` |
| **Insights** | `insights_feed` |

---

## RLS Policy Issues

### Issue 1: Sessions Not Workspace-Scoped

**Severity:** HIGH

**Problem:**
The `sessions` table has a `workspace_id` column, but the RLS policies only check `user_id = auth.uid()`.

**Current Policies:**
```sql
-- SELECT: (auth.uid() = user_id)
-- INSERT: (auth.uid() = user_id)
-- UPDATE: (auth.uid() = user_id)
-- DELETE: (auth.uid() = user_id)
```

**Impact:**
- Team members in the same workspace CANNOT see each other's sessions
- Defeats the purpose of workspace collaboration

**Fix Required:**
Add workspace-based policies:
```sql
-- Allow workspace members to view sessions
CREATE POLICY "Workspace members can view sessions"
ON sessions FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
  )
);
```

---

### Issue 2: Duplicate RLS Policies

**Severity:** MEDIUM

**Affected Tables:**

#### `sticky_note_evidence_links`
| Policy Name | Command | Duplicate? |
|-------------|---------|------------|
| Users can create links for their notes | INSERT | YES |
| Users can insert their sticky note evidence links | INSERT | YES (duplicate) |
| Users can delete links for their notes | DELETE | YES |
| Users can delete their sticky note evidence links | DELETE | YES (duplicate) |
| Users can view links for notes in their sessions | SELECT | YES |
| Users can view their sticky note evidence links | SELECT | YES (duplicate) |

#### `daily_insights_analysis`
| Policy Name | Command | Method |
|-------------|---------|--------|
| Users can create analyses for their workspaces | INSERT | `get_user_workspace_ids()` |
| Users can insert their daily insights analysis | INSERT | Direct subquery |
| Users can update analyses for their workspaces | UPDATE | `get_user_workspace_ids()` |
| Users can update their daily insights analysis | UPDATE | Direct subquery |
| Users can view analyses for their workspaces | SELECT | `get_user_workspace_ids()` |
| Users can view their daily insights analysis | SELECT | Direct subquery |

**Fix Required:**
Remove duplicate policies, keep the ones using `get_user_workspace_ids()` function (more efficient).

---

### Issue 3: evidence_bank Conflicting Policies

**Severity:** MEDIUM

**Problem:**
The `evidence_bank` table has BOTH user-based AND workspace-based policies:

```sql
-- User-based (problematic):
"Users can manage own evidence bank" - ALL - (auth.uid() = user_id)

-- Workspace-based (correct):
"Users can view evidence in their workspaces" - SELECT - workspace_id IN (...)
"Users can add evidence to their workspaces" - INSERT - workspace_id IN (...)
"Users can update evidence in their workspaces" - UPDATE - workspace_id IN (...)
"Users can delete evidence in their workspaces" - DELETE - workspace_id IN (...)
```

**Impact:**
- Users might only see their OWN evidence instead of team evidence
- Workspace collaboration broken for evidence bank

**Fix Required:**
Remove the user-based `ALL` policy, keep only workspace-based policies.

---

## Schema Inconsistencies

### Issue 4: constraints Table Structure

**Current Structure:**
```
constraints (
  id, user_id, type, label, value, is_system,
  created_at, updated_at, input_type
)
```

**Problem:**
- Constraints are user-scoped (`user_id`), not workspace-scoped
- Generic `type` field doesn't match vision's structured constraints (Vision, Goals, KPIs, Budget, Timeline)

**Vision Requirement:**
- Product Vision (north star)
- Strategic Goals (ranked priority)
- Key KPIs with targets
- Budget available
- Timeline constraints
- Tech stack limitations
- Must-have / Cannot-do guardrails

---

### Issue 5: insights_feed Has Many AI Fields

**Current columns:**
- `ai_summary`, `ai_themes`, `ai_action_items`
- `pain_points`, `feature_requests`, `sentiment`, `key_quotes`, `tags`

**Observation:**
These fields exist but may not be populated by current implementation. Verify n8n workflow populates these.

---

## Missing Features (Vision vs Built)

### Feature Gap Analysis

| Vision Feature | Database Support | Status |
|----------------|------------------|--------|
| Discovery Sessions | `sessions`, `sections`, `sticky_notes` | BUILT |
| Evidence Library | `evidence_bank` | BUILT |
| AI Discovery Analysis | `session_analyses` | BUILT |
| Strategic Constraints | `constraints` (basic) | PARTIAL |
| Discovery Quality Checklist | `session_checklist_items` | BUILT |
| Evidence Feed | `insights_feed` | BUILT |
| **Validation Workflow** | NO TABLE | NOT BUILT |
| **Chatbot Assistant** | NO TABLE | NOT BUILT |
| Auto-fetch from URLs | `fetch_status`, `fetched_content` columns | BUILT (needs implementation) |

### Missing Tables

#### 1. `validation_workflows`
For hypothesis generation feature:
```sql
validation_workflows (
  id UUID,
  session_id UUID REFERENCES sessions(id),
  sticky_note_id UUID REFERENCES sticky_notes(id),
  hypothesis TEXT,
  research_questions JSONB,
  suggested_method TEXT,
  success_criteria TEXT,
  sample_size_guidance TEXT,
  status TEXT DEFAULT 'pending',
  created_at, updated_at
)
```

#### 2. `chatbot_conversations`
For AI assistant feature:
```sql
chatbot_conversations (
  id UUID,
  workspace_id UUID REFERENCES workspaces(id),
  session_id UUID REFERENCES sessions(id), -- optional context
  user_id UUID REFERENCES auth.users(id),
  messages JSONB,
  created_at, updated_at
)
```

---

## SQL File Consolidation Notes

### Original Files (10 total)

| File | Keep/Consolidate |
|------|------------------|
| `supabase_migration.sql` | Consolidate |
| `supabase_full_migration.sql` | Consolidate |
| `supabase_phase2_migration.sql` | Consolidate |
| `supabase_phase3_team_invites.sql` | Consolidate |
| `supabase_phase4_evidence_sources.sql` | Consolidate |
| `supabase_phase4_evidence_update.sql` | Consolidate |
| `supabase_phase4_insights_analysis.sql` | Consolidate |
| `supabase_phase5_evidence_fetch.sql` | Consolidate |
| `supabase_template_update.sql` | Consolidate |
| `supabase_evidence_strength.sql` | Consolidate |

### Consolidation Strategy
All files merged into: `supabase_consolidated_schema.sql`

Old files kept for historical reference but not used for deployments.

---

## Fix Recommendations

### Priority 1 (Critical)
1. [ ] Add workspace-based RLS policies for `sessions` table
2. [ ] Remove user-based policy from `evidence_bank`
3. [ ] Remove duplicate RLS policies

### Priority 2 (Important)
4. [ ] Consider making `constraints` workspace-scoped
5. [ ] Verify `insights_feed` AI fields are being populated

### Priority 3 (Future Features)
6. [ ] Create `validation_workflows` table when building that feature
7. [ ] Create `chatbot_conversations` table when building that feature
8. [ ] Restructure constraints for strategic alignment feature

---

## Quick Reference: Table Relationships

```
profiles (1) ──────┬───── (N) sessions
                   │
workspaces (1) ────┼───── (N) workspace_members
                   │           └── user_id → profiles
                   │
                   ├───── (N) workspace_settings
                   ├───── (N) workspace_invites
                   ├───── (N) workspace_evidence_sources
                   ├───── (N) evidence_bank
                   ├───── (N) insights_feed
                   └───── (N) daily_insights_analysis

sessions (1) ──────┬───── (N) sections
                   │           └── (N) sticky_notes
                   │                    └── (N) evidence
                   │                    └── (N) sticky_note_evidence_links
                   │                    └── (N) sticky_note_links
                   ├───── (N) session_objectives
                   ├───── (N) session_checklist_items
                   ├───── (N) session_constraints
                   └───── (N) session_analyses
```

---

*Document maintained as part of Product Discovery Tool development.*
