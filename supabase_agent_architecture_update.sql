-- ============================================
-- Agent Architecture Update: 7-Agent System
-- ============================================
-- Replaces the old 4-agent system (evidence_hunter, decay_monitor,
-- contradiction_detector, analysis_crew) with 7 agents:
--
-- Auto-triggered (on evidence link):
--   1. strength_calculator - Pure logic evidence scoring
--   2. contradiction_detector - Conflict detection (Haiku)
--   3. segment_identifier - User segment extraction (Haiku)
--
-- User-triggered:
--   4. session_analyzer - Session analysis + recommendations (Sonnet)
--   5. brief_generator - Executive decision brief (Sonnet)
--
-- Scheduled:
--   6. decay_monitor - Stale evidence alerts (daily)
--   7. competitor_monitor - Market movement alerts (weekly)
-- ============================================

-- Step 1: Drop old CHECK constraint on agent_type
-- The constraint name may vary, so we try the common patterns
DO $$
BEGIN
    -- Try dropping by common constraint names
    ALTER TABLE agent_alerts DROP CONSTRAINT IF EXISTS agent_alerts_agent_type_check;
    ALTER TABLE agent_alerts DROP CONSTRAINT IF EXISTS agent_alerts_check;

    RAISE NOTICE 'Dropped existing agent_type CHECK constraint';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'No constraint to drop or already dropped: %', SQLERRM;
END $$;

-- Step 2: Add new CHECK constraint with all 7 agent types + legacy types
ALTER TABLE agent_alerts ADD CONSTRAINT agent_alerts_agent_type_check
    CHECK (agent_type IN (
        -- New 7-agent architecture
        'strength_calculator',
        'contradiction_detector',
        'segment_identifier',
        'session_analyzer',
        'brief_generator',
        'decay_monitor',
        'competitor_monitor',
        -- Legacy types (for existing alert rows from Phase E)
        'evidence_hunter',
        'analysis_crew'
    ));

-- Step 3: Verify
SELECT DISTINCT agent_type, COUNT(*) as count
FROM agent_alerts
GROUP BY agent_type
ORDER BY agent_type;
