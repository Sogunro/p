-- Add evidence strength scoring
-- Run this in Supabase SQL Editor

-- Add strength column to evidence table
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS strength TEXT DEFAULT 'medium' CHECK (strength IN ('high', 'medium', 'low'));

-- Add description for strength levels:
-- high: Customer interview, user research, analytics data, A/B test results
-- medium: Survey responses, support tickets, competitor analysis
-- low: Anecdotal feedback, assumptions, internal opinions

COMMENT ON COLUMN evidence.strength IS 'Evidence strength: high (customer interviews, analytics), medium (surveys, support tickets), low (anecdotal, assumptions)';
