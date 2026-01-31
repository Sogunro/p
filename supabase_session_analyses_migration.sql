-- ============================================
-- Session Analyses Table Enhancement
-- ============================================
-- This migration adds dedicated columns for all AI analysis fields
-- that were previously only stored in raw_response.
--
-- Run this in Supabase SQL Editor to enable proper querying
-- of analysis data instead of relying on raw_response parsing.
-- ============================================

-- Add new JSONB columns for comprehensive analysis storage
ALTER TABLE session_analyses ADD COLUMN IF NOT EXISTS session_diagnosis JSONB;
ALTER TABLE session_analyses ADD COLUMN IF NOT EXISTS evidence_assessment JSONB;
ALTER TABLE session_analyses ADD COLUMN IF NOT EXISTS strategic_alignment JSONB;
ALTER TABLE session_analyses ADD COLUMN IF NOT EXISTS solutions_analysis JSONB;
ALTER TABLE session_analyses ADD COLUMN IF NOT EXISTS pattern_detection JSONB;
ALTER TABLE session_analyses ADD COLUMN IF NOT EXISTS priority_ranking JSONB;
ALTER TABLE session_analyses ADD COLUMN IF NOT EXISTS next_steps JSONB;
ALTER TABLE session_analyses ADD COLUMN IF NOT EXISTS hypotheses JSONB;
ALTER TABLE session_analyses ADD COLUMN IF NOT EXISTS conflicts JSONB;

-- ============================================
-- Column Descriptions
-- ============================================
-- session_diagnosis: Overall session quality assessment
--   {
--     "overall_quality": "good | fair | poor",
--     "evidence_maturity": "high | medium | low",
--     "session_nature": "validated | hybrid | assumption-heavy",
--     "key_strengths": ["..."],
--     "key_gaps": ["..."],
--     "readiness_to_build": "ready | needs_validation | not_ready"
--   }
--
-- evidence_assessment: Evidence quality breakdown
--   {
--     "total_sources": number,
--     "source_types": ["interview", "analytics", ...],
--     "quality_breakdown": { "strong": n, "weak": n, "none": n },
--     "evidence_quality_score": 0-100
--   }
--
-- strategic_alignment: Vision/goals alignment scores
--   {
--     "vision_alignment_score": 0-100,
--     "vision_alignment_explanation": "...",
--     "goals_coverage": [{ "goal": "...", "impact": "...", "problems_addressed": [...] }],
--     "kpi_impact": [{ "kpi": "...", "estimated_impact": "...", "confidence": "..." }],
--     "overall_alignment_score": 0-100
--   }
--
-- solutions_analysis: Solution recommendations with constraints
--   [
--     {
--       "solution": "...",
--       "problem_solved": "...",
--       "recommendation": "BUILD_NOW | VALIDATE_FIRST | DEFER | BLOCKED",
--       "budget_fit": "...",
--       "timeline_fit": "...",
--       "tech_feasibility": "...",
--       "guardrails_check": "...",
--       "reasoning": "..."
--     }
--   ]
--
-- pattern_detection: Cross-evidence patterns and contradictions
--   {
--     "shared_evidence": [{ "evidence_title": "...", "used_by_problems": [...] }],
--     "convergent_patterns": [{ "pattern": "...", "source_count": n, ... }],
--     "contradictions": [{ "issue": "...", "sources_conflicting": [...], ... }],
--     "evidence_gaps": ["..."]
--   }
--
-- priority_ranking: Ranked list of problems/solutions
--   [
--     {
--       "rank": 1,
--       "item": "...",
--       "type": "problem | solution",
--       "total_score": 0-100,
--       "score_breakdown": { ... },
--       "why_this_rank": "..."
--     }
--   ]
--
-- next_steps: Categorized action items
--   {
--     "build_now": [{ "action": "...", "reason": "...", "which_solutions": [...] }],
--     "validate_first": [{ "action": "...", "method": "...", "sample_size": "...", ... }],
--     "defer": [{ "item": "...", "reason": "...", "revisit_when": "..." }]
--   }
--
-- hypotheses: Testable hypotheses for validation
--   [
--     {
--       "for_problem": "...",
--       "hypothesis": { "if": "...", "then": "...", "because": "..." },
--       "research_questions": ["..."],
--       "success_criteria": "...",
--       "sample_size_recommendation": "..."
--     }
--   ]
--
-- conflicts: Identified conflicts with constraints
--   [
--     {
--       "type": "budget_exceeded | timeline_exceeded | off_strategy | ...",
--       "item": "...",
--       "details": "...",
--       "suggestion": "..."
--     }
--   ]

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to verify columns were added:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'session_analyses'
ORDER BY ordinal_position;

-- ============================================
-- DONE!
-- ============================================
-- After running this migration:
-- 1. Update the API route to save these fields
-- 2. Analysis page can query columns directly instead of parsing raw_response
-- ============================================
