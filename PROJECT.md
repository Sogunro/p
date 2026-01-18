# Product Discovery Tool

## Project Overview

An AI-powered tool that helps product managers conduct structured, evidence-based product discovery sessions.

---

## Current Status: Phase 2 Complete - Ready for Deployment

**Project Type:** Internal tool / Proof-of-concept

**Core Problem to Solve:** PMs lack a systematic way to validate their discovery session conclusions against stated objectives and identify unvalidated assumptions.

---

## MVP Features

### 1. Discovery Canvas (Whiteboard)

**Templates:**
- Blank canvas (start from scratch)
- Pre-built templates with default sections:
  - Problem Space
  - Target Users
  - Observed Problems
  - Proposed Solutions

**Sections:**
- Each template comes with pre-defined sections
- Users can add custom sections to any template
- Sections are containers for sticky notes

**Sticky Notes:**
- Create, edit, delete sticky notes within sections
- Visual states:
  - **Yellow (default):** No evidence attached = Assumption
  - **Green:** Evidence attached = Evidence-backed
- Link sticky notes to each other (visual connections + relationship tracking)

### 2. Evidence Linking

- Attach evidence to any sticky note
- Evidence input methods:
  - Paste URL/link (to Notion, Airtable, Google Docs, etc.)
  - Paste text directly
- **Evidence Strength Classification:**
  - **High:** Customer interviews, user research, analytics data, A/B test results
  - **Medium:** Surveys, support tickets, competitor analysis
  - **Low:** Anecdotal feedback, assumptions, internal opinions
- When evidence is attached, sticky note turns green with "Evidence" indicator
- No API integrations in MVP—manual paste only

### 3. Session Structure

**Objectives (Required):**
- Users must define session objectives before starting
- Enforces structured approach to discovery

**Checklist (Optional):**
- Prompted after defining objectives
- Pre-populated default checklist items (user can modify):
  - Identified at least one target user segment
  - Documented observed problems with context
  - Linked evidence to key assumptions
  - Considered constraints in proposed solutions
  - Defined next validation steps
- Users can add custom checklist items
- Check off items during/after session

### 4. Constraints Definition

**Pre-populated constraint types:**
- Vision
- KPIs / Success Metrics
- Engineering Resources
- Budget
- Timeline
- Technical Limitations

**Custom constraints:**
- Users can add their own constraint types
- All constraints visible during session to keep ideas grounded

### 5. AI Analysis

**Triggered:** End of session (user-initiated)

**Inputs analyzed:**
- All sticky notes and their content
- Evidence attachments (with strength classification)
- Note-to-note relationships (smart links)
- Session objectives
- Checklist status
- Defined constraints

**Outputs:**
- **Objective Score:** How well session addressed stated objectives
- **Assumption Mapping:** List of assumptions vs. evidence-backed items
- **Confidence Score:** Per idea/conclusion (weighted by evidence strength)
- **Validation Recommendations:**
  - Which items need more validation
  - Why they need validation
  - Suggested validation methods
  - Questions to answer
- **Constraint Analysis:** How ideas align with defined constraints
- **Checklist Review:** Which items were met/unmet

**Export Options:**
- Copy to clipboard (Markdown format)
- Download as .md file
- Download as .json (for integrations)

---

## Phase 2 Features

### 6. Workspace System

**Team-Based Multi-Tenancy:**
- Workspaces are auto-created when users sign up
- First user becomes workspace owner
- Sessions are scoped to workspaces
- Future: Invite team members, role-based permissions

### 7. Evidence Bank

**Centralized Evidence Repository:**
- Team-shared evidence storage across all sessions
- Manual evidence entry (URL or text)
- Evidence from n8n integrations
- Search and filter by source, strength, tags
- Source tracking: manual, slack, notion, mixpanel, airtable

**Evidence Strength Classification:**
- **High:** Customer interviews, analytics data, A/B tests
- **Medium:** Surveys, support tickets, competitor analysis
- **Low:** Anecdotal feedback, assumptions

**Linking to Sticky Notes:**
- "Link from Bank" tab in evidence popover
- Many-to-many relationship (one evidence item can be linked to multiple notes)
- Visual indicator for linked bank evidence

### 8. User Insights Feed

**Automated Evidence Collection:**
- n8n webhook receives insights from external tools
- Daily scheduled fetch at user-configured time
- Sources: Slack, Notion, Mixpanel, Airtable

**Feed Management:**
- Review pending insights
- "Add to Bank" - moves insight to Evidence Bank
- "Dismiss" - removes from pending queue
- Shows source system and fetch timestamp

### 9. Integration Settings

**Feed Configuration:**
- Set daily feed schedule time and timezone
- Enable/disable each integration source
- View webhook URL and workspace ID for n8n setup

### 10. Analysis Gate

**Evidence Freshness Check:**
- Before analysis, checks if evidence was fetched recently (within 24 hours)
- If stale, prompts user with options:
  - "Fetch Insights" - navigate to insights page
  - "Proceed Anyway" - skip check and analyze
- Ensures analysis uses current evidence

---

## Phase 2 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/evidence-bank` | List all evidence in workspace |
| POST | `/api/evidence-bank` | Add new evidence manually |
| DELETE | `/api/evidence-bank` | Remove evidence |
| POST | `/api/evidence-bank/link` | Link evidence to sticky note |
| DELETE | `/api/evidence-bank/link` | Unlink evidence from note |
| GET | `/api/insights-feed` | Get insights feed items |
| POST | `/api/insights-feed/add-to-bank` | Move insight to Evidence Bank |
| POST | `/api/insights-feed/dismiss` | Dismiss insight |
| POST | `/api/webhook/insights` | n8n webhook to push insights |
| GET | `/api/workspace/settings` | Get workspace settings |
| PUT | `/api/workspace/settings` | Update feed schedule |

---

## n8n Webhook Integration

**Webhook URL:** `/api/webhook/insights`

**Required Headers:**
- `x-webhook-secret`: Your webhook secret from environment

**Payload Format:**
```json
{
  "workspace_id": "uuid",
  "source_system": "slack | notion | mixpanel | airtable",
  "items": [
    {
      "title": "Customer feedback about dark mode",
      "content": "User said: 'Would love dark mode'",
      "url": "https://slack.com/archives/...",
      "strength": "medium",
      "source_metadata": {
        "channel": "#feedback",
        "author": "john@company.com"
      }
    }
  ]
}
```

---

## Future Modules (Phase 3+)

| Module | Description | Priority |
|--------|-------------|----------|
| Team Collaboration | Invite members, role permissions, shared sessions | Phase 3 |
| Real-time Sync | Multi-user editing, live updates, presence indicators | Phase 3 |
| Direct Integrations | Pull evidence directly via OAuth (no n8n) | Phase 3 |
| Custom Templates | User-defined templates, template marketplace | Phase 4 |
| Analytics Dashboard | Track sessions, insights trends, team metrics | Phase 4 |

---

## Documentation

- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Complete database tables, relationships, RLS policies
- [UI_FLOW.md](UI_FLOW.md) - Screen layouts, user flows, component specs

---

## Tech Stack

### Core Application
- **Framework:** Next.js (React-based, includes API routes for backend)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (email/password)
- **Deployment:** Vercel (free tier)

### AI & Automation
- **AI Analysis:** Claude API (Sonnet for cost efficiency)
- **Workflow Automation:** n8n (existing subscription)

### Integrations (via n8n) - Phase 3
- Slack (connected)
- Notion (connected)
- Mixpanel (connected)
- Airtable (connected)

---

## Estimated Costs (Monthly)

| Component | Cost |
|-----------|------|
| Vercel Hosting | $0 (free tier) |
| Supabase | $0 (free tier) or $25 (Pro) |
| Claude API | $20-100 (usage dependent) |
| n8n | Existing subscription |
| **Total** | **$20-125/month** |

---

## Open Questions

1. Target user persona (solo PM vs. enterprise teams)?
2. Pricing model and willingness to pay?
3. Key differentiator from Notion + ChatGPT workflow?

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-17 | Start with MVP focused on session analysis | Reduce scope, validate core value first |
| 2026-01-17 | Next.js + Supabase + Vercel stack | All-in-one framework, free tiers, fast deployment |
| 2026-01-17 | Email/password auth via Supabase | Simple, sufficient for internal tool |
| 2026-01-17 | Build order: Frontend → DB → Backend → n8n | Core product first, integrations last |
| 2026-01-17 | MVP feature scope finalized | Canvas, evidence linking, objectives, checklist, constraints, AI analysis |
| 2026-01-17 | Evidence = manual paste (URL/text) for MVP | Defer n8n integrations to Phase 2 |
| 2026-01-17 | Objectives required, checklist optional | Balance structure with flexibility |
| 2026-01-17 | Database schema designed | 13 tables covering all MVP features |
| 2026-01-17 | UI flow documented | 8 screens with layouts and components |
| 2026-01-17 | Use shadcn/ui + React Flow | Rapid development with proven components |
| 2026-01-17 | Add evidence strength scoring | Improves AI analysis quality with weighted confidence |
| 2026-01-17 | Include note links in AI analysis | Enables pattern recognition across related concepts |
| 2026-01-17 | Add export functionality | Users need to share findings with stakeholders |
| 2026-01-17 | Add delete session feature | Basic CRUD completeness for session management |
| 2026-01-17 | AI analysis in Next.js app | Keep control, easier debugging, evidence in context |
| 2026-01-17 | Evidence Bank per workspace | Enables team collaboration, shared evidence |
| 2026-01-17 | Auto-create workspace on signup | Simplest onboarding, first user is owner |
| 2026-01-17 | Daily feed schedule via n8n | User sets time, n8n runs scheduled workflow |
| 2026-01-17 | Support all 4 integrations | Slack, Notion, Mixpanel, Airtable via n8n webhooks |
| 2026-01-17 | Analysis gate for evidence freshness | Ensures analysis uses current evidence |

---

## Next Steps

- [x] Select tech stack
- [x] Finalize MVP feature scope
- [x] Design database schema
- [x] Design UI flow
- [x] Create Supabase project
- [x] Initialize Next.js project
- [x] Set up database tables (migration script created)
- [x] Build core UI components
- [x] Implement auth flow
- [x] Build API routes + Claude integration
- [x] Configure environment variables
- [x] Add evidence strength scoring
- [x] Add smart linking in AI analysis
- [x] Add export functionality
- [x] Add delete session feature
- [x] Test locally

### Phase 2 Completed
- [x] Create Phase 2 database migration (6 new tables)
- [x] Implement workspace system (auto-create on signup)
- [x] Build Evidence Bank (API + UI)
- [x] Build Insights Feed (webhook + UI)
- [x] Build integration settings page
- [x] Add "Link from Bank" to evidence popover
- [x] Add analysis gate for evidence freshness
- [x] Update PROJECT.md documentation

### Deployment
- [ ] Run Phase 2 migration in Supabase
- [ ] Set up environment variables in Vercel
- [ ] Deploy to Vercel
- [ ] Configure n8n webhooks to point to production URL
