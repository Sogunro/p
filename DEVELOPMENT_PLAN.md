# Discovery OS — Development Plan

**Last updated:** 2026-01-31 (Phase F complete, Agent Architecture v2)
**Spec coverage:** ~85% built → targeting 100% across 8 phases
**Current DB tables:** 31 | **API routes:** 44 | **Pages:** 23

---

## Overall Progress

| Phase | Name | Status | Key Deliverables |
|-------|------|--------|------------------|
| A | Evidence Strength Foundation | COMPLETE | Calculation engine, weight config, templates, UI |
| B | Decision Records MVP | COMPLETE | Decisions table, CRUD, log page, detail page, executive brief, gate logic, override mechanic |
| C | Enhanced Canvas | COMPLETE | Section types, sort/filter, constraint indicators, source diversity, unvalidated warnings |
| D | Vector Search + Enrichment | COMPLETE | pgvector, embeddings, similarity search, Python service, smart search UI |
| E | AI Agents (v2) | COMPLETE | 7-agent architecture, auto-triggers, Haiku/Sonnet split |
| F | Discovery Brief + External Push | COMPLETE | Brief generation, Linear/Jira push, shareable links |
| G | Outcomes + Calibration | PLANNED | Outcomes tracking, calibration dashboard |
| H | Polish + Portfolio | PLANNED | Demo data, loading states, architecture docs |

---

## AI Agent System — Architecture v2

7 specialized agents running on **Python FastAPI (Railway)** with **Haiku/Sonnet model split** for cost optimization. Auto-triggered agents fire on evidence linking, user-triggered agents run on button click, scheduled agents run via n8n cron.

### Agent Layer Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         NEXT.JS APP                              │
│  Auto-trigger: /api/evidence-bank/link → agent-triggers.ts       │
│  User-trigger: /api/agent/analyze-session, /generate-brief       │
│  Proxy routes: /api/agent/* → Railway                            │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    PYTHON SERVICE (Railway)                       │
│                    FastAPI v3.0.0                                 │
│                                                                   │
│  AUTO-TRIGGERED (on evidence link):                               │
│  ├─ Strength Calculator  — TypeScript (local, no LLM)            │
│  ├─ Contradiction Detector — Claude Haiku (~$0.0003/call)        │
│  └─ Segment Identifier    — Claude Haiku (~$0.0003/call)         │
│                                                                   │
│  USER-TRIGGERED (button click):                                   │
│  ├─ Session Analyzer — Claude Sonnet (~$0.01-0.05/call)          │
│  └─ Brief Generator  — Claude Sonnet (~$0.01-0.05/call)          │
│                                                                   │
│  SCHEDULED (n8n cron):                                            │
│  ├─ Decay Monitor      — Claude Sonnet (daily)                   │
│  └─ Competitor Monitor — Claude Haiku (weekly, P3 stub)          │
│                                                                   │
│  Local Models: all-MiniLM-L6-v2 (embeddings)                     │
└──────────────────────────────────────────────────────────────────┘
```

### The 7 Agents

| # | Agent | Trigger | Model | Cost/Call |
|---|-------|---------|-------|-----------|
| 1 | **Strength Calculator** | Auto (evidence link) | None (pure logic) | $0 |
| 2 | **Contradiction Detector** | Auto (evidence link) | Haiku | ~$0.0003 |
| 3 | **Segment Identifier** | Auto (evidence link) | Haiku | ~$0.0003 |
| 4 | **Session Analyzer** | User button | Sonnet | ~$0.01-0.05 |
| 5 | **Brief Generator** | User button | Sonnet | ~$0.01-0.05 |
| 6 | **Decay Monitor** | Daily cron | Sonnet | ~$0.01 |
| 7 | **Competitor Monitor** | Weekly cron (stub) | Haiku | ~$0.0003 |

**Key design decisions:**
- **No CrewAI** — removed entirely. All agents use direct Anthropic SDK calls.
- **Haiku for simple tasks** — segment classification, keyword extraction, contradiction detection
- **Sonnet for complex reasoning** — session analysis, brief generation, decay reports
- **Auto-trigger from server** — `/api/evidence-bank/link` fires 3 agents in parallel (fire-and-forget)
- **Strength Calculator in TypeScript** — reuses existing `evidence-strength.ts`, no LLM needed

---

## Phase A: Evidence Strength Foundation — COMPLETE

**Goal:** Computed evidence strength replaces manual high/medium/low

### What was built
- **SQL Migration** (`supabase_phase_a_evidence_strength.sql`)
  - 6 new columns on `evidence_bank`: source_weight, recency_factor, sentiment, segment, computed_strength, source_timestamp
  - 4 new columns on `workspace_settings`: weight_config, weight_template, recency_config, target_segments
  - Expanded source_system enum: +intercom, gong, interview, support, analytics, social
  - New table: `confidence_history` (table #25)
  - Indexes on new columns

- **Calculation Engine** (`app/src/lib/evidence-strength.ts`)
  - Formula: `base_weight × recency × segment_match × corroboration_bonus` → scaled 0-100
  - Recency decay: <7d=1.0, 7-30d=0.8, 30-90d=0.5, >90d=0.2
  - Corroboration bonus: 3+ independent sources = 1.3x
  - Quality gates: source diversity cap (70%), direct voice, independence, recency floor (50%)
  - Coverage indicators: sources, segments, recency distribution, gaps
  - "Why this score" breakdown generator

- **5 Weighting Templates**
  - Default, B2B Enterprise, PLG Growth, Support-Led, Research-Heavy

- **API Endpoints**
  - `GET/PUT /api/workspace/weight-config` — Read/update weight configuration
  - `POST /api/evidence-bank/recalculate` — Batch recalculate all evidence strength

- **UI**
  - `/settings/evidence-weights` — Template selector, per-source weight sliders, recency config, target segments, recalculate button
  - Evidence popover: shows numeric computed strength (color-coded by band)
  - Sticky notes: shows average strength badge when linked evidence has computed scores
  - Dashboard nav: added "Weights" link

- **TypeScript Types** (`app/src/types/database.ts`)
  - `SourceSystemExpanded`, `WeightTemplate`, `ConfidenceTriggerType`, `Sentiment`
  - `WeightConfig`, `RecencyConfig`, `EvidenceStrengthResult`, `QualityGateResult`, `CoverageIndicators`
  - `confidence_history` table type

### Files created
- `app/src/lib/evidence-strength.ts`
- `app/src/app/api/workspace/weight-config/route.ts`
- `app/src/app/api/evidence-bank/recalculate/route.ts`
- `app/src/app/settings/evidence-weights/page.tsx`
- `supabase_phase_a_evidence_strength.sql`

### Files modified
- `app/src/types/database.ts`
- `app/src/components/session/evidence-popover.tsx`
- `app/src/components/session/sticky-note.tsx`
- `app/src/components/session/session-canvas.tsx`
- `app/src/app/evidence-bank/page.tsx`
- `app/src/app/dashboard/page.tsx`

---

## Phase B: Decision Records MVP — COMPLETE

**Goal:** Decisions become first-class objects (the product's MVP wedge)

### What was built
- **SQL Migration** (`supabase_phase_b_decisions.sql`)
  - New table: `decisions` (#26) — workspace_id, session_id, title, hypothesis, description, status (commit/validate/park), gate_recommendation, evidence_strength, evidence_count, success_metrics, is_overridden, override_reason, overridden_at, overridden_by, external_ref, external_url, created_by, timestamps
  - New table: `evidence_decision_links` (#27) — decision_id, evidence_id, segment_match_factor, relevance_note, linked_by, linked_at, UNIQUE(decision_id, evidence_id)
  - Full RLS: SELECT/INSERT/UPDATE/DELETE on decisions, SELECT/INSERT/DELETE on links
  - 7 indexes on workspace_id, status, session_id, evidence_strength, created_at, decision_id, evidence_id

- **API Endpoints** (5 new routes)
  - `GET /api/decisions` — List decisions with optional status/session/search filters
  - `POST /api/decisions` — Create a new decision
  - `GET /api/decisions/[id]` — Get decision with linked evidence details and session info
  - `PATCH /api/decisions/[id]` — Update decision fields, handles override detection
  - `DELETE /api/decisions/[id]` — Delete a decision
  - `POST /api/decisions/[id]/evidence` — Link evidence to decision, auto-recalculates strength + gate
  - `DELETE /api/decisions/[id]/evidence` — Unlink evidence, auto-recalculates strength + gate
  - `POST /api/decisions/[id]/brief` — Generate executive brief via Claude AI

- **Pages** (2 new pages)
  - `/decisions` — Decision log page with stats bar (total/commit/validate/park/overridden), status filter pills, search, inline create form
  - `/decisions/[id]` — Decision detail page with editable fields, evidence browser with link/unlink from bank, gate panel with strength score + recommendation + override dialog, executive brief generation + copy

- **Decision Gate Logic**
  - Auto-calculated gate recommendation on evidence link/unlink:
    - Score ≥70 → "Commit" (green)
    - Score 40-70 → "Validate" (yellow)
    - Score <40 → "Park" (red)
  - Override mechanic: when user sets status different from gate recommendation, reason is required
  - Override tracked with is_overridden, override_reason, overridden_at, overridden_by
  - Visual override indicator (purple) on both log and detail pages

- **Executive Brief** (Claude AI)
  - Generates concise brief with: Decision Summary, Evidence Assessment, Key Risks, Recommendation
  - Includes override notes when applicable
  - Copy to clipboard support

- **TypeScript Types** (`app/src/types/database.ts`)
  - `DecisionStatus` = 'commit' | 'validate' | 'park'
  - `Decision`, `EvidenceDecisionLink` convenience types
  - Full Row/Insert/Update types for both tables

- **Dashboard**: Added "Decisions" nav link

### Files created
- `app/src/app/api/decisions/route.ts`
- `app/src/app/api/decisions/[id]/route.ts`
- `app/src/app/api/decisions/[id]/evidence/route.ts`
- `app/src/app/api/decisions/[id]/brief/route.ts`
- `app/src/app/decisions/page.tsx`
- `app/src/app/decisions/[id]/page.tsx`
- `supabase_phase_b_decisions.sql`

### Files modified
- `app/src/types/database.ts`
- `app/src/app/dashboard/page.tsx`

---

## Phase C: Enhanced Canvas — COMPLETE

**Goal:** Canvas shows real-time confidence, constraints, and sorting

### What was built
- **SQL Migration** (`supabase_phase_c_enhanced_canvas.sql`)
  - Added `section_type` column to `sections` table (general/problems/solutions/assumptions/evidence/decisions)
  - Backfill existing sections based on name patterns

- **Section Types** (6 types with visual differentiation)
  - General (📋 gray), Problems (🔍 orange), Solutions (💡 blue), Assumptions (❓ yellow), Evidence (📎 green), Decisions (⚖️ purple)
  - Clickable type icon in section header opens dropdown to change type
  - Type-specific accent colors on section borders when no notes have evidence

- **Sort/Filter Controls** (canvas toolbar)
  - Filter by: All Sections, Has Evidence, Has Assumptions, Problems, Solutions, Decisions
  - Sort by: Default Order, By Strength (highest first), By Evidence Count (most first)

- **Constraint Match Indicators** (per sticky note)
  - Top-right corner badge on each note: ✓ (all match), ~ (partial), ✗ (none)
  - Compares note content against session constraint values
  - Tooltip shows per-constraint match breakdown

- **Source Diversity Indicator** (per section)
  - "N src" badge in section header showing count of unique source systems
  - Blue highlight when 3+ diverse sources (good diversity)
  - Tooltip shows actual source type names

- **Average Strength Badge** (per section)
  - Shows average computed_strength across all linked evidence in section
  - Color-coded: green (≥70), yellow (40-70), red (<40)

- **Unvalidated Problem Warning** (solutions sections)
  - Orange ring + "!" badge on solution notes when:
    - Note is in a "solutions" section AND
    - All "problems" sections have weak evidence (avg <40) or no evidence AND
    - The note itself has no evidence
  - Tooltip: "Solution lacks validated problem — validate the linked problem first"

- **TypeScript Types** (`app/src/types/database.ts`)
  - Added `SectionType` = 'general' | 'problems' | 'solutions' | 'assumptions' | 'evidence' | 'decisions'
  - Added `section_type` field to sections Row/Insert/Update

### Files created
- `supabase_phase_c_enhanced_canvas.sql`

### Files modified
- `app/src/types/database.ts` — SectionType, section_type field
- `app/src/components/session/session-canvas.tsx` — Filter/sort state, constraint passing, section type handler, unvalidated warning logic
- `app/src/components/session/section-container.tsx` — Section type icon/menu, source diversity badge, avg strength badge, type-based accents
- `app/src/components/session/sticky-note.tsx` — Constraint match indicator, unvalidated warning badge

---

## Phase D: Vector Search + Enrichment + Python Service — COMPLETE

**Goal:** Intelligent search-and-link experience via embeddings. Also sets up the Python service infrastructure that agents (Phase E) will use.

### What was built

**SQL migration** (`supabase_phase_d_vector_search.sql` — timestamps 5:00-5:03 PM):
- Enabled pgvector extension
- Added `embedding vector(384)` column to `evidence_bank`
- Created `search_evidence()` function for cosine similarity search within workspace
- Created IVFFlat index for fast approximate nearest neighbor search

**Python FastAPI embedding service** (`embedding-service/`):
- `main.py` — FastAPI with `/embed`, `/embed-batch`, and `/health` endpoints
- Uses `all-MiniLM-L6-v2` model (384-dim vectors, normalized)
- Bearer token auth via `EMBEDDING_API_KEY` env var
- `Dockerfile` for Railway deployment (pre-downloads model at build time)
- `railway.json` for Railway config with healthcheck

**Next.js API routes:**
- `POST /api/evidence-bank/embed` — Generate embeddings for single item or batch all
- `POST /api/evidence-bank/search` — Semantic search (calls Python service for query embedding, then Supabase RPC)

**UI enhancements:**
- Evidence popover: Added "Search" tab (4th tab) with semantic search — shows similarity % match, link/unlink evidence
- Evidence Bank page: Added "Smart Search" toggle for semantic mode, "Embed All" button to batch generate embeddings, status notifications

### Files created
- `supabase_phase_d_vector_search.sql` — pgvector migration
- `embedding-service/main.py` — FastAPI embedding service
- `embedding-service/requirements.txt` — Python dependencies
- `embedding-service/Dockerfile` — Docker build config
- `embedding-service/railway.json` — Railway deployment config
- `embedding-service/.env.example` — Environment variable template
- `embedding-service/.gitignore` — Python gitignore
- `app/src/app/api/evidence-bank/embed/route.ts` — Embed API route
- `app/src/app/api/evidence-bank/search/route.ts` — Search API route

### Files modified
- `app/src/types/database.ts` — Added `embedding` field to evidence_bank types, `VectorSearchResult` interface
- `app/src/components/session/evidence-popover.tsx` — Added semantic "Search" tab with similarity display
- `app/src/app/evidence-bank/page.tsx` — Added Smart Search mode, Embed All button, semantic results display

### Environment variables needed
- `EMBEDDING_SERVICE_URL` — URL of deployed Python service (e.g., `https://your-service.railway.app`)
- `EMBEDDING_API_KEY` — Shared secret for authenticating between Next.js and Python service

### Deployment steps
1. Run `supabase_phase_d_vector_search.sql` in Supabase SQL Editor
2. Deploy `embedding-service/` to Railway (Docker)
3. Set `EMBEDDING_API_KEY` on both Railway and Vercel
4. Set `EMBEDDING_SERVICE_URL` on Vercel (pointing to Railway URL)
5. Click "Embed All" on Evidence Bank page to generate embeddings for existing evidence

---

## Phase E: AI Agents (v2 Architecture) — COMPLETE

**Goal:** 7-agent system with auto-triggers, Haiku/Sonnet model split, no CrewAI dependency.

### Architecture Transition (v1 → v2)

| v1 Agent | Action | v2 Agent |
|----------|--------|----------|
| Evidence Hunter | **REMOVED** | _(replaced by auto-trigger flow)_ |
| Analysis Crew (CrewAI) | **REMOVED** | _(replaced by Session Analyzer + Brief Generator)_ |
| Contradiction Detector | **KEPT, switched to Haiku** | Auto-triggered on evidence link |
| Decay Monitor | **KEPT + MODIFIED** | Also monitors sticky notes |
| _(none)_ | **ADDED** | Strength Calculator (pure logic, no LLM) |
| _(none)_ | **ADDED** | Segment Identifier (Claude Haiku) |
| _(none)_ | **ADDED** | Competitor Monitor (Claude Haiku, weekly stub) |
| _(none)_ | **ADDED** | Session Analyzer (Claude Sonnet) |
| _(none)_ | **ADDED** | Brief Generator (Claude Sonnet) |

### What was built

**SQL Migrations**:
- `supabase_phase_e_agents.sql` — `agent_alerts` table (#28) with RLS
- `supabase_agent_architecture_update.sql` — Updated agent_type CHECK constraint for 7 new + 2 legacy types

**Python Service (Railway) — 5 Agent Modules**:
- `embedding-service/agents/contradiction_detector.py` — Switched to Haiku model
- `embedding-service/agents/segment_identifier.py` — NEW: Haiku-based user segment classification (Enterprise/Mid-market/SMB/Consumer/Internal)
- `embedding-service/agents/session_analyzer.py` — NEW: Sonnet-based session analysis with commit/validate/park recommendations
- `embedding-service/agents/brief_generator.py` — NEW: Sonnet-based executive decision briefs with evidence breakdown
- `embedding-service/agents/competitor_monitor.py` — NEW: Haiku keyword extraction stub (web search deferred)
- `embedding-service/agents/decay_monitor.py` — MODIFIED: Now monitors both committed decisions AND validating sticky notes
- `embedding-service/config.py` — Added `CLAUDE_HAIKU_MODEL` + `CLAUDE_SONNET_MODEL`
- `embedding-service/main.py` — Version 3.0.0, 6 new endpoints, removed old hunt/analyze endpoints
- `embedding-service/requirements.txt` — Removed crewai dependency

**Auto-Trigger Flow**:
- `app/src/lib/agent-triggers.ts` — Fires 3 agents in parallel on evidence link: Strength Calculator (local), Contradiction Detector (Railway), Segment Identifier (Railway)
- `app/src/app/api/evidence-bank/link/route.ts` — Modified to call `triggerAgentsOnEvidenceLink()` fire-and-forget

**Next.js API Proxy Routes** (6 total):
- `POST /api/agent/detect-contradictions` — Contradiction Detector
- `POST /api/agent/segment-identify` — Segment Identifier
- `POST /api/agent/analyze-session` — Session Analyzer
- `POST /api/agent/generate-brief` — Brief Generator
- `POST /api/agent/decay-report` — Decay Monitor
- `POST /api/agent/competitor-monitor` — Competitor Monitor
- `GET/PATCH /api/agent/alerts` — Alert listing and management

**UI Updates**:
- Decision detail: Removed "Hunt Evidence" + "Deep Analysis" buttons, replaced with "Generate Brief" calling Railway
- Decision detail: Updated agent icons for all 7 agent types + 2 legacy
- Dashboard: Updated agent icons for all 7 agent types + 2 legacy

### Files created (v2 additions)
| # | File | Purpose |
|---|------|---------|
| 1 | `supabase_agent_architecture_update.sql` | Agent type constraint migration |
| 2 | `embedding-service/agents/segment_identifier.py` | Segment Identifier (Haiku) |
| 3 | `embedding-service/agents/session_analyzer.py` | Session Analyzer (Sonnet) |
| 4 | `embedding-service/agents/brief_generator.py` | Brief Generator (Sonnet) |
| 5 | `embedding-service/agents/competitor_monitor.py` | Competitor Monitor stub (Haiku) |
| 6 | `app/src/lib/agent-triggers.ts` | Auto-trigger orchestration |
| 7 | `app/src/app/api/agent/segment-identify/route.ts` | Segment Identifier proxy |
| 8 | `app/src/app/api/agent/analyze-session/route.ts` | Session Analyzer proxy |
| 9 | `app/src/app/api/agent/generate-brief/route.ts` | Brief Generator proxy |
| 10 | `app/src/app/api/agent/competitor-monitor/route.ts` | Competitor Monitor proxy |

### Files deleted (v1 → v2)
| # | File | Reason |
|---|------|--------|
| 1 | `embedding-service/agents/evidence_hunter.py` | Agent removed |
| 2 | `embedding-service/agents/analysis_crew.py` | CrewAI removed |
| 3 | `app/src/app/api/agent/hunt/route.ts` | Endpoint removed |
| 4 | `app/src/app/api/agent/analyze/route.ts` | Endpoint removed |

### Files modified (v2)
| # | File | Changes |
|---|------|---------|
| 1 | `embedding-service/requirements.txt` | Removed crewai |
| 2 | `embedding-service/main.py` | Removed old endpoints, added 6 new, v3.0.0 |
| 3 | `embedding-service/config.py` | Added CLAUDE_HAIKU_MODEL + CLAUDE_SONNET_MODEL |
| 4 | `embedding-service/Dockerfile` | Removed build-essential |
| 5 | `embedding-service/agents/contradiction_detector.py` | Switched to Haiku |
| 6 | `embedding-service/agents/decay_monitor.py` | Added sticky note monitoring |
| 7 | `app/src/types/database.ts` | 7 new + 2 legacy agent types |
| 8 | `app/src/app/api/evidence-bank/link/route.ts` | Added auto-trigger call |
| 9 | `app/src/app/decisions/[id]/page.tsx` | Removed old buttons, new agent icons |
| 10 | `app/src/app/dashboard/page.tsx` | Updated agent icons |

### Deployment steps
1. Run `supabase_agent_architecture_update.sql` in Supabase SQL Editor
2. Deploy Python service to Railway (crewai removed, new agents added)
3. Deploy Next.js to Vercel
4. Set up n8n: Daily trigger for Decay Monitor, Weekly trigger for Competitor Monitor

---

## Phase F: Discovery Brief + External Push — COMPLETE

**Goal:** Pre-session intelligence, shareable briefs, and external PM tool integration (Linear + Jira).

### What was built

**SQL Migration** (`supabase_phase_f_discovery_brief_push.sql`):
- `discovery_briefs` table (#29) — workspace-wide or session-specific briefs with share tokens
- `external_integrations` table (#30) — Linear/Jira config with encrypted API keys
- `external_pushes` table (#31) — Push history with status tracking
- RLS policies for all 3 tables (workspace members + public read for shared briefs)

**Discovery Brief API**:
- `GET /api/discovery-brief` — List briefs for workspace (optional session filter)
- `POST /api/discovery-brief` — Generate brief using Claude Sonnet (synthesizes evidence + decisions + agent alerts)
- `GET/PATCH/DELETE /api/discovery-brief/[id]` — Individual brief CRUD
- `POST /api/discovery-brief/[id]/share` — Generate share token, make public
- `DELETE /api/discovery-brief/[id]/share` — Revoke sharing

**Shareable Brief Links**:
- `/brief/[token]` — Public read-only page (no auth required)
- Renders title, date, evidence count, decision count, key themes, full content

**Linear Integration**:
- `GET/POST/DELETE /api/integrations/linear` — CRUD for Linear config
- `POST /api/integrations/linear/push` — Push decision as Linear issue via GraphQL API

**Jira Integration**:
- `GET/POST/DELETE /api/integrations/jira` — CRUD for Jira config
- `POST /api/integrations/jira/push` — Push decision as Jira ticket via REST API v3

**UI Pages**:
- `/discovery-brief` — Brief list with card grid, generate button, share/revoke/delete
- `/settings/pm-tools` — Linear + Jira configuration (API key, team/project, enable/disable)
- Decision detail: "Push to Linear" / "Push to Jira" buttons with result display
- Dashboard nav: Added "Briefs" and "PM Tools" links

**TypeScript Types**:
- `DiscoveryBrief`, `ExternalIntegration`, `ExternalPush` interfaces
- `IntegrationType` = 'linear' | 'jira'
- `PushStatus` = 'pending' | 'success' | 'failed'

### Files created
| # | File | Purpose |
|---|------|---------|
| 1 | `supabase_phase_f_discovery_brief_push.sql` | 3 tables + RLS |
| 2 | `app/src/app/api/discovery-brief/route.ts` | Brief list + generate |
| 3 | `app/src/app/api/discovery-brief/[id]/route.ts` | Brief CRUD |
| 4 | `app/src/app/api/discovery-brief/[id]/share/route.ts` | Shareable links |
| 5 | `app/src/app/brief/[token]/page.tsx` | Public brief viewer |
| 6 | `app/src/app/discovery-brief/page.tsx` | Brief list page |
| 7 | `app/src/app/api/integrations/linear/route.ts` | Linear config |
| 8 | `app/src/app/api/integrations/linear/push/route.ts` | Linear push |
| 9 | `app/src/app/api/integrations/jira/route.ts` | Jira config |
| 10 | `app/src/app/api/integrations/jira/push/route.ts` | Jira push |
| 11 | `app/src/app/settings/pm-tools/page.tsx` | PM Tools settings |

### Files modified
| # | File | Changes |
|---|------|---------|
| 1 | `app/src/types/database.ts` | Added DiscoveryBrief, ExternalIntegration, ExternalPush types |
| 2 | `app/src/app/decisions/[id]/page.tsx` | Added "Push to..." section |
| 3 | `app/src/app/dashboard/page.tsx` | Added Briefs + PM Tools nav links |

### Deployment steps
1. Run `supabase_phase_f_discovery_brief_push.sql` in Supabase SQL Editor
2. Deploy Next.js to Vercel
3. Set `ANTHROPIC_API_KEY` on Vercel (for brief generation)

---

## Phase G: Outcomes + Calibration — PLANNED

**Goal:** Close the feedback loop — track what happened after decisions

### Database changes needed
- New table: `outcomes` (decision_id, result, target_metrics, actual_metrics, learnings, source_retrospective)
- New table: `pm_calibration` (workspace_id, user_id, prediction_accuracy, source_reliability JSONB)

### What to build
- Outcome tracking UI (link outcomes to decisions, track actual vs predicted)
- Calibration dashboard page (source reliability over time, team accuracy)
- Weekly evidence health ritual (scheduled Decay Monitor digest — leverages Agent 2)
- Auto-generated draft outcomes (Claude suggests metrics based on decision)
- Real-time contradiction detection on canvas (leverages Agent 3)

---

## Phase H: Polish + Portfolio — PLANNED

**Goal:** Demo-ready product with seeded data and documentation

### What to build
- Seed demo data with varied evidence types, decisions, outcomes
- Loading states and error handling across all agent interactions
- Architecture documentation (for portfolio)
- Portfolio presentation narrative showing framework skills:
  - **n8n** — Integration orchestration, no-code automation, webhook handling
  - **LangGraph** — Stateful agents, conditional logic, looping workflows
  - **CrewAI** — Multi-agent collaboration, role-based design

---

## Tech Stack Summary

| Layer | Tool | Purpose |
|-------|------|---------|
| **Frontend** | Next.js 16 + TypeScript | UI + API routes |
| **Database** | Supabase PostgreSQL + pgvector | Structured data + vector search + RLS |
| **AI/LLM** | Claude Sonnet + Haiku (Anthropic SDK) | Complex reasoning (Sonnet) + simple tasks (Haiku) |
| **Embeddings** | all-MiniLM-L6-v2 (local on Railway) | RAG vector generation |
| **Integration Orchestration** | n8n | Scheduled triggers (decay monitor, competitor monitor) |
| **Python Service** | FastAPI v3.0.0 on Railway | 7-agent execution environment |
| **External Integrations** | Linear GraphQL + Jira REST v3 | PM tool push |
| **Deployment** | Vercel (frontend) + Railway (Python) | Hosting |
| **Styling** | Tailwind CSS + shadcn/ui | Component library |

### Model Usage

| Model | Cost | Used By |
|-------|------|---------|
| **Claude Haiku** | ~$0.0003/call | Contradiction Detector, Segment Identifier, Competitor Monitor |
| **Claude Sonnet** | ~$0.01-0.05/call | Session Analyzer, Brief Generator, Decay Monitor, Discovery Briefs |
| **all-MiniLM-L6-v2** | $0 (local) | Embedding generation for vector search |

---

## Quick Reference: Current Database (31 tables)

profiles, templates, template_sections, sessions, session_objectives, session_checklist_items, constraints, session_constraints, sections, sticky_notes, evidence, sticky_note_links, session_analyses, workspaces, workspace_members, evidence_bank, sticky_note_evidence_links, insights_feed, workspace_settings, daily_insights_analysis, workspace_evidence_sources, workspace_invites, validation_workflows, validation_workflow_history, confidence_history, decisions, evidence_decision_links, agent_alerts, **discovery_briefs**, **external_integrations**, **external_pushes**

### Tables coming in future phases
- `outcomes` (Phase G)
- `pm_calibration` (Phase G)
