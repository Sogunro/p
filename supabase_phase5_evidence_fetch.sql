-- Phase 5: Evidence Fetch Content Storage
-- Adds fields to evidence_bank to store fetched content from n8n

-- Add fetched content fields to evidence_bank
ALTER TABLE evidence_bank ADD COLUMN IF NOT EXISTS fetched_content TEXT;
ALTER TABLE evidence_bank ADD COLUMN IF NOT EXISTS fetch_status TEXT DEFAULT 'unfetched';
-- fetch_status: 'unfetched' | 'fetched' | 'failed'
ALTER TABLE evidence_bank ADD COLUMN IF NOT EXISTS fetch_metadata JSONB DEFAULT '{}';
ALTER TABLE evidence_bank ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;

-- Add comment for clarity
COMMENT ON COLUMN evidence_bank.fetched_content IS 'Actual content fetched from the URL by n8n (Notion page content, Slack message, etc.)';
COMMENT ON COLUMN evidence_bank.fetch_status IS 'Status of content fetch: unfetched, fetched, failed';
COMMENT ON COLUMN evidence_bank.fetch_metadata IS 'Metadata from fetch (author, last_edited, etc.)';
COMMENT ON COLUMN evidence_bank.fetched_at IS 'Timestamp when content was successfully fetched';

-- Create index for fetch_status to efficiently query unfetched evidence
CREATE INDEX IF NOT EXISTS idx_evidence_bank_fetch_status ON evidence_bank(fetch_status);

-- Create index for workspace + fetch_status combo queries
CREATE INDEX IF NOT EXISTS idx_evidence_bank_workspace_fetch_status ON evidence_bank(workspace_id, fetch_status);
