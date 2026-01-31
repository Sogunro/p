-- ============================================
-- Phase D: Vector Search + Enrichment
-- ============================================
-- Run this migration in Supabase SQL Editor
-- Timestamp: 2026-01-31 5:00 PM
--
-- Changes:
-- 1. Enable pgvector extension (5:00 PM)
-- 2. Add embedding column to evidence_bank (5:01 PM)
-- 3. Create search_evidence function (5:02 PM)
-- 4. Create embedding index (5:03 PM)
-- ============================================


-- ============================================
-- 1. ENABLE pgvector EXTENSION
-- ============================================
-- Timestamp: 5:00 PM

CREATE EXTENSION IF NOT EXISTS vector;


-- ============================================
-- 2. ADD embedding COLUMN TO evidence_bank
-- ============================================
-- Timestamp: 5:01 PM
-- Using 384 dimensions (all-MiniLM-L6-v2 model output)

ALTER TABLE evidence_bank
ADD COLUMN IF NOT EXISTS embedding vector(384);

COMMENT ON COLUMN evidence_bank.embedding IS 'Semantic embedding vector (384-dim, all-MiniLM-L6-v2)';


-- ============================================
-- 3. CREATE search_evidence FUNCTION
-- ============================================
-- Timestamp: 5:02 PM
-- Performs cosine similarity search within a workspace

CREATE OR REPLACE FUNCTION search_evidence(
  query_embedding vector(384),
  target_workspace_id UUID,
  match_limit INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  url TEXT,
  type TEXT,
  source_system TEXT,
  strength TEXT,
  computed_strength FLOAT,
  segment TEXT,
  source_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    eb.id,
    eb.title,
    eb.content,
    eb.url,
    eb.type,
    eb.source_system,
    eb.strength,
    eb.computed_strength::FLOAT,
    eb.segment,
    eb.source_timestamp,
    eb.created_at,
    (1 - (eb.embedding <=> query_embedding))::FLOAT AS similarity
  FROM evidence_bank eb
  WHERE eb.workspace_id = target_workspace_id
    AND eb.embedding IS NOT NULL
    AND (1 - (eb.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY eb.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;

COMMENT ON FUNCTION search_evidence IS 'Semantic vector search for evidence within a workspace using cosine similarity';


-- ============================================
-- 4. CREATE VECTOR INDEX
-- ============================================
-- Timestamp: 5:03 PM
-- IVFFlat index for fast approximate nearest neighbor search
-- Note: This index works best with 100+ rows. For smaller datasets,
-- exact search (without index) is used automatically.

CREATE INDEX IF NOT EXISTS idx_evidence_bank_embedding
ON evidence_bank
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 50);


-- ============================================
-- VERIFICATION
-- ============================================
-- Check pgvector is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check embedding column exists
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'evidence_bank' AND column_name = 'embedding';

-- Check search function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'search_evidence';


-- ============================================
-- DONE!
-- ============================================
-- After running this migration:
-- 1. pgvector extension enabled
-- 2. evidence_bank.embedding column added (vector(384))
-- 3. search_evidence() function created for semantic search
-- 4. IVFFlat index created for fast vector search
--
-- Next: Deploy Python embedding service and create API routes
-- ============================================
