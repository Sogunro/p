-- ============================================
-- Phase C: Enhanced Canvas
-- ============================================
-- Run this migration in Supabase SQL Editor
-- Timestamp: 2026-01-31 4:30 PM
--
-- Changes:
-- 1. Add section_type column to sections table
-- ============================================


-- ============================================
-- 1. ADD section_type TO sections TABLE
-- ============================================
-- Timestamp: 4:30 PM

ALTER TABLE sections
ADD COLUMN IF NOT EXISTS section_type TEXT DEFAULT 'general'
CHECK (section_type IN ('general', 'problems', 'solutions', 'assumptions', 'evidence', 'decisions'));

COMMENT ON COLUMN sections.section_type IS 'Section type: general, problems, solutions, assumptions, evidence, decisions';

-- Backfill existing sections based on name patterns
UPDATE sections SET section_type = 'problems'
WHERE LOWER(name) LIKE '%problem%' AND section_type = 'general';

UPDATE sections SET section_type = 'solutions'
WHERE LOWER(name) LIKE '%solution%' AND section_type = 'general';

UPDATE sections SET section_type = 'assumptions'
WHERE LOWER(name) LIKE '%assumption%' AND section_type = 'general';

UPDATE sections SET section_type = 'evidence'
WHERE LOWER(name) LIKE '%evidence%' AND section_type = 'general';


-- ============================================
-- VERIFICATION
-- ============================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sections' AND column_name = 'section_type';


-- ============================================
-- DONE!
-- ============================================
-- After running this migration:
-- 1. sections.section_type column added (general/problems/solutions/assumptions/evidence/decisions)
-- 2. Existing sections backfilled based on name patterns
--
-- Next: Build the enhanced canvas UI
-- ============================================
