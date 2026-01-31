# Discovery OS — Development Plan

**Last updated:** 2026-01-31 (Phase E complete)
**Spec coverage:** ~72% built → targeting 100% across 8 phases
**Current DB tables:** 28 | **API routes:** 34 | **Pages:** 19

---

## Overall Progress

| Phase | Name | Status | Key Deliverables |
|-------|------|--------|------------------|
| A | Evidence Strength Foundation | COMPLETE | Calculation engine, weight config, templates, UI |
| B | Decision Records MVP | COMPLETE | Decisions table, CRUD, log page, detail page, executive brief, gate logic, override mechanic |
| C | Enhanced Canvas | COMPLETE | Section types, sort/filter, constraint indicators, source diversity, unvalidated warnings |
| D | Vector Search + Enrichment | COMPLETE | pgvector, embeddings, similarity search, Python service, smart search UI |
| E | AI Agents | COMPLETE | Evidence Hunter, Decay Monitor, Contradiction Detector, Analysis Crew |
| F | Discovery Brief + External Push | UP NEXT | Brief generation, Linear/Jira integration |
| G | Outcomes + Calibration | PLANNED | Outcomes tracking, calibration dashboard |
| H | Polish + Portfolio | PLANNED | Demo data, loading states, architecture docs |

---

## AI Agent System — Architecture Overview

The spec defines 4 AI agents that automate the grunt work so PMs can focus on judgment. These agents run on a **Python FastAPI service (Railway)** using **LangGraph** for orchestration and **CrewAI** for multi-agent analysis, with **n8n** handling triggers and external integrations.

### Agent Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         NEXT.JS APP                             │
│  /api/agent/validate → Trigger agent pipeline                   │
│  /api/agent/analyze  → Trigger analysis crew                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         n8n                                     │
│  • Webhook trigger → call Python agent service                  │
│  • Scheduled evidence refresh → update embeddings               │
│  • New evidence → trigger embedding generation                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PYTHON SERVICE (Railway)                      │
│                        FastAPI                                   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  LangGraph (Orchestrator + Evidence Hunter)               │  │
│  │  • POST /agent/orchestrate — Main entry point             │  │
│  │  • POST /agent/hunt — Evidence hunting                    │  │
│  │  • POST /search — Semantic search                         │  │
│  │  • POST /embed — Generate embeddings                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  CrewAI (Analysis Crew)                                   │  │
│  │  • Sentiment Analyst — classifies evidence tone           │  │
│  │  • Theme Synthesizer — clusters and summarizes            │  │
│  │  • Validator — scores confidence, finds gaps              │  │
│  │  • POST /crew/analyze — Run analysis crew                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Local Models: all-MiniLM-L6-v2 (embeddings)                    │
└─────────────────────────────────────────────────────────────────┘
```

### The 4 Agents

| # | Agent | Trigger | Autonomy | Priority | Depends On |
|---|-------|---------|----------|----------|------------|
| 1 | **Evidence Hunter** | Idea marked "needs validation" | Level 3 (Act + Notify) | P1 | Phase D (vector search) |
| 2 | **Decay Monitor** | Daily schedule (6 AM) | Level 2 (Alert only) | P2 | Phase A (recency), Phase B (decisions) |
| 3 | **Contradiction Detector** | New evidence ingested | Level 2 (Alert only) | P2 | Phase D (embeddings + similarity) |
| 4 | **Competitor Monitor** | Feature spec created / Weekly | Level 2 (Alert only) | P3 | Phase B (decisions), Phase F (briefs) |

### Agent 1: Evidence Hunter (P1)
**Purpose:** Automate evidence gathering when an idea needs validation.

**Workflow:**
1. Receive hypothesis text + keywords
2. Parallel search: Slack, Intercom, Notion, PostHog via source APIs
3. Embed hypothesis + each result
4. Filter by semantic similarity (> 0.7 threshold)
5. For each relevant result → ingest as new evidence
6. Notify PM: "Found 8 pieces of evidence... Confidence updated: 34% → 62%"

**Implementation:** LangGraph (stateful graph with generate_queries → search_vector → filter_rank nodes, conditional looping if insufficient results)

**n8n trigger:** Supabase webhook on hypothesis.status = 'needs_validation'

### Agent 2: Decay Monitor (P2)
**Purpose:** Proactively identify hypotheses at risk due to stale evidence.

**Workflow:**
1. Query all active hypotheses daily
2. For each: get linked evidence, calculate days since most recent, check confidence trend
3. Flag if: no evidence in 21+ days, OR confidence declining 3+ days, OR decision scheduled within 7 days + confidence < 60%
4. Generate daily digest with attention-needed + healthy sections
5. Send via Slack/Email

**Implementation:** Scheduled n8n workflow → queries Supabase → generates report

### Agent 3: Contradiction Detector (P2)
**Purpose:** Flag when new evidence conflicts with existing evidence.

**Workflow:**
1. New evidence arrives with embedding
2. Search for similar evidence (similarity > 0.8)
3. Compare sentiment, segment, source for each similar piece
4. If sentiment mismatch on same topic from different users → alert
5. Show: conflicting pieces, possible explanations, action buttons

**Implementation:** Triggered by evidence ingestion webhook → LangGraph analysis

### Agent 4: Competitor & Market Monitor (P3)
**Purpose:** Track competitor releases for features in development.

**Sources:** Competitor changelogs, Product Hunt, tech news, G2/Capterra, social media

**Workflow:**
1. Feature spec created → extract keywords
2. Weekly scan: competitor sites, Product Hunt, news
3. LangGraph analyzes: relevant? direct competitor? how similar?
4. If match: alert with competitor details + suggested actions
5. Update Decision Record with market context

**Implementation:** n8n scheduled workflow → web scraping → LangGraph relevance analysis

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

## Phase E: AI Agents — COMPLETE

**Goal:** Automate evidence gathering, staleness detection, contradiction flagging, and deep analysis. This is the intelligence layer.

### What was built

**SQL Migration** (`supabase_phase_e_agents.sql`):
- `agent_alerts` table (#28) with RLS policies and indexes
- Supports 5 agent types: evidence_hunter, decay_monitor, contradiction_detector, competitor_monitor, analysis_crew
- Alert types: info, warning, action_needed
- JSONB metadata for agent-specific structured data

**Python Service — New Dependencies** (`embedding-service/requirements.txt`):
- langgraph, langchain, langchain-anthropic, crewai, anthropic, supabase, httpx

**Python Service — Infrastructure**:
- `embedding-service/config.py` — Shared env config (Supabase, Anthropic, model settings)
- `embedding-service/db.py` — Supabase client helper using service role key

**Agent 1: Evidence Hunter** (`embedding-service/agents/evidence_hunter.py`):
- LangGraph agent with 5 nodes: generate_queries → search_vector → filter_rank → summarize → store_results
- Conditional looping: if < 3 results and < 2 iterations, refines queries and searches again
- Uses `search_evidence()` RPC for vector similarity search
- Auto-links found evidence to decisions, recalculates strength
- Endpoint: `POST /agent/hunt`

**Agent 2: Decay Monitor** (`embedding-service/agents/decay_monitor.py`):
- Sequential flow checking for stale evidence on active decisions
- Flag conditions: evidence >21 days old, >50% older than 90 days, strength <40 with commit status
- Claude generates markdown digest report
- Endpoint: `POST /agent/decay-report`
- n8n: Daily scheduled trigger

**Agent 3: Contradiction Detector** (`embedding-service/agents/contradiction_detector.py`):
- Searches similar evidence via pgvector (similarity >0.75)
- Sentiment-based contradiction detection from independent sources
- Claude semantic analysis fallback when sentiment data missing
- Endpoint: `POST /agent/detect-contradictions`
- Fire-and-forget trigger after evidence embedding

**Agent 4: Analysis Crew** (`embedding-service/agents/analysis_crew.py`):
- CrewAI with 3 agents: Sentiment Analyst, Theme Synthesizer, Validator
- Sequential process: sentiment → themes → validation
- Claude generates executive summary from crew outputs
- Endpoint: `POST /crew/analyze`

**Note:** Competitor & Market Monitor (Agent 4 from original plan) was replaced with the CrewAI Analysis Crew as a higher-priority deliverable. Competitor Monitor can be added in a future phase.

**Next.js API Routes**:
- `POST /api/agent/hunt` — Evidence Hunter trigger
- `POST /api/agent/decay-report` — Decay Monitor trigger
- `POST /api/agent/detect-contradictions` — Contradiction Detector trigger
- `POST /api/agent/analyze` — CrewAI Analysis trigger
- `GET/PATCH /api/agent/alerts` — Alert listing and management

**UI Updates**:
- Dashboard: Agent Activity card showing latest 5 alerts with type icons
- Decision detail: "Hunt Evidence" button (status = validate/park), "Deep Analysis" button (2+ evidence)
- Decision detail: Agent results display sections and decision-related alerts

### Files created
| # | File | Purpose |
|---|------|---------|
| 1 | `supabase_phase_e_agents.sql` | SQL migration for agent_alerts table |
| 2 | `embedding-service/config.py` | Shared env config |
| 3 | `embedding-service/db.py` | Supabase client helper |
| 4 | `embedding-service/agents/__init__.py` | Package init |
| 5 | `embedding-service/agents/evidence_hunter.py` | LangGraph Evidence Hunter |
| 6 | `embedding-service/agents/decay_monitor.py` | Decay Monitor |
| 7 | `embedding-service/agents/contradiction_detector.py` | Contradiction Detector |
| 8 | `embedding-service/agents/analysis_crew.py` | CrewAI Analysis Crew |
| 9 | `app/src/app/api/agent/hunt/route.ts` | Evidence Hunter API route |
| 10 | `app/src/app/api/agent/decay-report/route.ts` | Decay Report API route |
| 11 | `app/src/app/api/agent/detect-contradictions/route.ts` | Contradiction API route |
| 12 | `app/src/app/api/agent/analyze/route.ts` | CrewAI Analysis API route |
| 13 | `app/src/app/api/agent/alerts/route.ts` | Alert management API route |

### Files modified
| # | File | Changes |
|---|------|---------|
| 1 | `embedding-service/requirements.txt` | Added langgraph, crewai, anthropic, supabase deps |
| 2 | `embedding-service/main.py` | Added 4 agent endpoints, updated version to 2.0.0 |
| 3 | `embedding-service/.env.example` | Added ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| 4 | `app/src/types/database.ts` | Added agent_alerts types, AgentType, AlertType |
| 5 | `app/src/app/dashboard/page.tsx` | Added Agent Activity card |
| 6 | `app/src/app/decisions/[id]/page.tsx` | Added Hunt + Deep Analysis buttons, results display, alerts |

### Deployment steps
1. Run `supabase_phase_e_agents.sql` in Supabase SQL Editor
2. Set Railway env vars: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy Python service to Railway (new deps will install)
4. Deploy Next.js to Vercel (automatic on push)
5. Set up n8n daily workflow for Decay Monitor

---

## Phase F: Discovery Brief + External Push — PLANNED

**Goal:** Pre-session intelligence and external PM tool integration

### What to build
- Discovery Brief generation API (Claude prompt using workspace evidence + decision history)
- Brief display UI (shown before session starts)
- Linear integration (API key setup in workspace settings, push decision API, field mapping UI)
- Jira integration (similar to Linear)
- Shareable brief links (public read-only URLs)

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
| **AI/LLM** | Claude Sonnet (Anthropic SDK) | Analysis, synthesis, reasoning |
| **Embeddings** | all-MiniLM-L6-v2 (local on Railway) | RAG vector generation |
| **Agent Frameworks** | LangGraph + CrewAI | Multi-agent orchestration |
| **Integration Orchestration** | n8n | External data fetching, triggers, webhooks |
| **Python Service** | FastAPI on Railway | Agent execution environment |
| **Deployment** | Vercel (frontend) + Railway (Python) | Hosting |
| **Styling** | Tailwind CSS + shadcn/ui | Component library |

### Framework Responsibilities

| Framework | Role |
|-----------|------|
| **n8n** | External integrations (Slack, Notion, Mixpanel), triggers, webhooks, calls Python service |
| **LangGraph** | Core agent orchestration — Orchestrator Agent, Evidence Hunter Agent |
| **CrewAI** | Analysis crew — Sentiment Analyst, Theme Synthesizer, Validator working as team |
| **Claude (direct)** | Quick analysis fallback, executive brief generation, session analysis |

---

## Quick Reference: Current Database (25 tables)

profiles, templates, template_sections, sessions, session_objectives, session_checklist_items, constraints, session_constraints, sections, sticky_notes, evidence, sticky_note_links, session_analyses, workspaces, workspace_members, evidence_bank, sticky_note_evidence_links, insights_feed, workspace_settings, daily_insights_analysis, workspace_evidence_sources, workspace_invites, validation_workflows, validation_workflow_history, **confidence_history**

### Tables coming in future phases
- `decisions` (Phase B)
- `evidence_hypothesis_links` (Phase B)
- `outcomes` (Phase G)
- `pm_calibration` (Phase G)
