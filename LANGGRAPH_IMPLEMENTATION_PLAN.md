# LangGraph Implementation + User Flow Improvements

**Created:** 2026-02-01
**Status:** PLANNED
**Goal:** Add LangGraph agent orchestration + close gaps between user flow spec and current implementation

---

## Part 1: LangGraph Integration

### Why LangGraph

Current `agent-triggers.ts` runs 3 agents in parallel with `Promise.allSettled` — fire-and-forget, no coordination. LangGraph adds:

1. **Agent coordination** — Segment Identifier output feeds into Strength Calculator (segment affects weight)
2. **Conditional follow-up** — If contradictions found AND strength > 70%, auto-create decision alerts
3. **Structured state** — Full trace of what ran, inputs, outputs, errors per execution
4. **Retry with fallback** — If Railway is down, retry; if repeated failure, fall back to defaults
5. **Extensible** — New agent steps (gap analysis, voice detection) plug into existing graphs

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Next.js API Route                                               │
│  POST /api/agent/orchestrate                                     │
│                                                                  │
│  Receives: { evidence_id, sticky_note_id, workspace_id }        │
│  Calls: FastAPI /orchestrate/evidence-link                       │
│  Returns: { strength, segment, contradictions, alerts }          │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  FastAPI (Railway) — LangGraph Orchestrator                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Graph: EvidenceLinkFlow                                         │
│                                                                  │
│  START                                                           │
│    │                                                             │
│    ├──► [Segment Identifier]  ──┐                                │
│    │      (Haiku)               │                                │
│    │                            ├──► [Strength Calculator]       │
│    ├──► [Contradiction Det.]  ──┘      (uses segment + contras)  │
│    │      (Haiku + embeddings)               │                   │
│    │                                         ▼                   │
│    │                              [Conditional Router]           │
│    │                                    │                        │
│    │                        ┌───────────┼───────────┐            │
│    │                        ▼           ▼           ▼            │
│    │                   [Create     [Update      [Save            │
│    │                    Alert]      Gate Rec]    Results]         │
│    │                        │           │           │            │
│    │                        └───────────┼───────────┘            │
│    │                                    ▼                        │
│    │                                   END                       │
│                                                                  │
│  Graph: SessionAnalysisFlow                                      │
│                                                                  │
│  START                                                           │
│    │                                                             │
│    ▼                                                             │
│  [Gather Session Data] ──► [Gap Analyzer] ──► [Session Analyzer] │
│                              (Haiku)            (Sonnet)         │
│                                                    │             │
│                                                    ▼             │
│                                            [Quality Gate]        │
│                                              │         │         │
│                                         [Retry]    [Format +     │
│                                                     Save]        │
│                                                       │          │
│                                                      END         │
└──────────────────────────────────────────────────────────────────┘
```

### LangGraph State Definitions

```python
# Evidence Link Flow
class EvidenceLinkState(TypedDict):
    evidence_id: str
    sticky_note_id: str
    workspace_id: str
    evidence_text: str
    segment: str                    # from Segment Identifier
    contradictions: list[dict]      # from Contradiction Detector
    contradiction_count: int
    strength: float                 # from Strength Calculator
    strength_band: str              # "strong" | "moderate" | "weak"
    has_direct_voice: bool          # NEW: from Voice Detector
    gap_warnings: list[str]         # NEW: from Gap Analyzer
    alerts_created: list[str]
    gate_updated: bool

# Session Analysis Flow
class SessionAnalysisState(TypedDict):
    session_id: str
    workspace_id: str
    notes: list[dict]
    evidence: list[dict]
    constraints: list[dict]
    gap_analysis: dict              # NEW
    analysis: dict                  # from Session Analyzer (Sonnet)
    quality_score: float
    retry_count: int
    ranked_problems: list[dict]     # NEW: sorted by strength
    recommendations: list[dict]     # NEW: COMMIT/VALIDATE/PARK
```

### New Python Files

| # | File | Purpose |
|---|------|---------|
| 1 | `embedding-service/graphs/__init__.py` | LangGraph package |
| 2 | `embedding-service/graphs/evidence_link.py` | Evidence link flow graph |
| 3 | `embedding-service/graphs/session_analysis.py` | Session analysis flow graph |
| 4 | `embedding-service/graphs/nodes/segment.py` | Segment Identifier node |
| 5 | `embedding-service/graphs/nodes/contradiction.py` | Contradiction Detector node |
| 6 | `embedding-service/graphs/nodes/strength.py` | Strength Calculator node |
| 7 | `embedding-service/graphs/nodes/gap_analyzer.py` | Gap Analyzer node (NEW) |
| 8 | `embedding-service/graphs/nodes/voice_detector.py` | Direct Voice Detector node (NEW) |
| 9 | `embedding-service/graphs/nodes/session_analyzer.py` | Session Analyzer node |

### New API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `FastAPI POST /orchestrate/evidence-link` | Runs EvidenceLinkFlow graph |
| `FastAPI POST /orchestrate/session-analysis` | Runs SessionAnalysisFlow graph |
| `Next.js POST /api/agent/orchestrate` | Proxy to FastAPI orchestrator |

---

## Part 2: User Flow Improvements

### Gap Analysis Summary (from `discovery-os-user-flow.md`)

| Feature | Spec | Current | Priority |
|---------|------|---------|----------|
| Strength-based badge colors (green/yellow/red) | Required | Not implemented | HIGH |
| Direct voice indicator (checkmark/warning) | Required | Not implemented | HIGH |
| Gap analysis warnings on cards | Required | Not implemented | HIGH |
| Ranked problem list in evaluation mode | Required | Not implemented | HIGH |
| COMMIT/VALIDATE/PARK on problem cards | Required | Only on solutions | HIGH |
| Owner + review_date on decisions | Required | Missing from schema | HIGH |
| Commit to Decision dialog in analysis | Required | Not implemented | HIGH |
| Summary stats by strength bands | Required | Not implemented | HIGH |
| Section types matching spec | Required | 6 generic types | MEDIUM |
| Create as Assumption vs Create with Evidence | Required | Not implemented | MEDIUM |
| "What we're NOT doing" in brief | Required | Not implemented | MEDIUM |
| Stale evidence flags (>30 days) | Required | Not implemented | MEDIUM |
| Segment coverage warnings | Required | Not implemented | MEDIUM |
| Per-card fetch evidence | Required | Only bulk | LOW |

---

## Implementation Plan

### Phase 1: Schema + Card Display (Frontend)

**Step 1.1: Database schema updates**
- Add `owner` (text) and `review_date` (date) to `decisions` table
- Add `has_direct_voice` (boolean, default false) to `evidence_bank` table
- SQL migration file: `supabase_user_flow_improvements.sql`

**Step 1.2: Sticky note badge colors by strength**
- File: `app/src/components/session/sticky-note.tsx`
- Change badge: green (>70%), yellow (40-70%), red (<40%), gray (0%)
- Show strength % prominently on all cards (not just linked evidence)
- Show source count with link icon
- Add direct voice indicator: checkmark (green) or warning (yellow)

**Step 1.3: Gap analysis warnings on cards**
- File: `app/src/components/session/sticky-note.tsx`
- New warnings section at bottom of card:
  - "No direct user voice" if has_direct_voice = false on all linked evidence
  - "Single segment only" if all evidence shares same segment
  - "Evidence > 30 days old" if oldest evidence > 30 days
- Warnings passed from session-canvas as computed props

### Phase 2: Evaluation Mode Overhaul

**Step 2.1: Ranked problems view in analysis modal**
- File: `app/src/components/session/analysis-results-modal.tsx`
- New tab or replace Problems tab: ranked list of ALL notes by strength
- Each row shows: strength %, badge, title, source count, segment, recommendation
- Recommendation logic: >70% = COMMIT, 40-70% = VALIDATE, <40% = PARK

**Step 2.2: Summary stats by strength bands**
- File: `app/src/components/session/analysis-results-modal.tsx`
- Replace current Overview stats with: Total, Strong (>70%), Moderate (40-70%), Assumptions (<40%)

**Step 2.3: Additional flags on ranked cards**
- Flags: no direct voice, single segment, contradictions, stale evidence, constraint violations
- Constraint checking: compare each card against session constraints

**Step 2.4: Commit to Decision dialog**
- File: `app/src/components/session/analysis-results-modal.tsx`
- "Commit" button on cards with strength > 70%
- Opens dialog: decision title (pre-filled), success metric, owner, review date
- Creates decision record linked to session + evidence

**Step 2.5: Brief "What we're NOT doing" section**
- File: `app/src/app/api/discovery-brief/route.ts`
- Add parked items (strength < 40%) to brief prompt
- Section: "What We're Not Doing (And Why)" with item + reason

### Phase 3: LangGraph Backend

**Step 3.1: Install LangGraph in Python service**
- Add `langgraph`, `langchain-anthropic` to `requirements.txt`
- Set up graph package structure

**Step 3.2: Evidence Link Flow**
- Implement `EvidenceLinkFlow` graph
- Nodes: Segment Identifier, Contradiction Detector, Strength Calculator
- Conditional: create alerts if contradictions, update gate if strength > 70%
- New node: Voice Detector (Haiku) — checks if evidence contains direct user quotes

**Step 3.3: Gap Analyzer Node (NEW agent)**
- New Haiku-based agent
- Input: all evidence linked to a note
- Output: list of gaps (no direct voice, single segment, stale, low diversity)
- Runs as part of EvidenceLinkFlow after strength calculation

**Step 3.4: Session Analysis Flow**
- Implement `SessionAnalysisFlow` graph
- Nodes: Gather Data, Gap Analyzer, Session Analyzer (Sonnet), Quality Gate
- Quality gate: retry if recommendations < 3
- Output: ranked problems, recommendations, gap analysis

**Step 3.5: Update Next.js to use orchestrator**
- Replace `agent-triggers.ts` calls with single POST to `/api/agent/orchestrate`
- Update evidence link route to call orchestrator
- Update session analysis to call orchestrator

### Phase 4: Canvas Improvements

**Step 4.1: Section type alignment**
- Update SectionType to add: `'problem_space' | 'pain_points' | 'observed_problems' | 'proposed_solutions'`
- Keep existing types for backwards compatibility
- Default session creation pre-populates 4 spec sections

**Step 4.2: Dual-path note creation**
- Update note creation in session-canvas
- Two buttons: "Create as Assumption" (no evidence) vs "Create with Evidence" (opens evidence picker)
- Evidence picker includes: paste URL, search Evidence Bank, select from linked

---

## File Changes Summary

### New Files (12)
| # | File | Type |
|---|------|------|
| 1 | `supabase_user_flow_improvements.sql` | SQL migration |
| 2 | `embedding-service/graphs/__init__.py` | Python package |
| 3 | `embedding-service/graphs/evidence_link.py` | LangGraph flow |
| 4 | `embedding-service/graphs/session_analysis.py` | LangGraph flow |
| 5 | `embedding-service/graphs/nodes/__init__.py` | Python package |
| 6 | `embedding-service/graphs/nodes/segment.py` | Graph node |
| 7 | `embedding-service/graphs/nodes/contradiction.py` | Graph node |
| 8 | `embedding-service/graphs/nodes/strength.py` | Graph node |
| 9 | `embedding-service/graphs/nodes/gap_analyzer.py` | Graph node (NEW) |
| 10 | `embedding-service/graphs/nodes/voice_detector.py` | Graph node (NEW) |
| 11 | `embedding-service/graphs/nodes/session_analyzer.py` | Graph node |
| 12 | `app/src/app/api/agent/orchestrate/route.ts` | Next.js proxy |

### Modified Files (8)
| # | File | Changes |
|---|------|---------|
| 1 | `embedding-service/requirements.txt` | Add langgraph, langchain-anthropic |
| 2 | `embedding-service/main.py` | Add /orchestrate/* endpoints |
| 3 | `app/src/types/database.ts` | Add owner, review_date, has_direct_voice, new SectionTypes |
| 4 | `app/src/components/session/sticky-note.tsx` | Badge colors, voice indicator, gap warnings |
| 5 | `app/src/components/session/session-canvas.tsx` | Gap analysis computation, dual-path creation |
| 6 | `app/src/components/session/analysis-results-modal.tsx` | Ranked list, stats, commit dialog, flags |
| 7 | `app/src/app/api/discovery-brief/route.ts` | "Not doing" section |
| 8 | `app/src/lib/agent-triggers.ts` | Replace with orchestrator call |

---

## Verification

1. **LangGraph**: Link evidence → verify strength uses segment, contradictions create alerts
2. **Badge colors**: Card with 80% shows green, 50% shows yellow, 10% shows red
3. **Evaluation ranked list**: Analyze session → cards sorted by strength with recommendations
4. **Commit flow**: Click Commit on strong card → creates decision with owner + review date
5. **Gap warnings**: Card with no user interviews shows warning
6. **Brief**: Generate brief → includes "What we're NOT doing" section
7. **Build check**: `cd app && npx tsc --noEmit` — zero errors

---

## Build Order

```
Phase 1 (Schema + Cards) → Phase 2 (Evaluation) → Phase 3 (LangGraph) → Phase 4 (Canvas)
```

Phases 1-2 are frontend-only and can deploy immediately.
Phase 3 requires Railway Python service update.
Phase 4 is optional polish.
