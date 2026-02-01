-- User Flow Improvements: Schema Updates
-- Run this migration to add support for:
-- 1. Decision ownership + review dates (Commit to Decision dialog)
-- 2. Direct voice tracking on evidence (Voice Detector agent)

-- Add owner and review_date to decisions table
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS owner TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS review_date DATE;

-- Add has_direct_voice to evidence_bank table
ALTER TABLE evidence_bank ADD COLUMN IF NOT EXISTS has_direct_voice BOOLEAN DEFAULT false;
