-- ============================================
-- FIX: evidence_bank column name and nullable
-- ============================================
-- The original schema created evidence_bank with:
--   user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
-- But all application code references 'created_by' and expects it to be nullable
-- (webhook inserts set created_by: null since they run as service role, not a user)
--
-- This migration:
-- 1. Renames user_id to created_by (if user_id exists)
-- 2. Makes it nullable (DROP NOT NULL)
-- 3. Adds source_metadata JSONB column (if missing)
-- ============================================

-- Step 1: Rename user_id to created_by if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'evidence_bank' AND column_name = 'user_id'
    ) THEN
        -- Drop the NOT NULL constraint first
        ALTER TABLE evidence_bank ALTER COLUMN user_id DROP NOT NULL;
        -- Rename the column
        ALTER TABLE evidence_bank RENAME COLUMN user_id TO created_by;
        RAISE NOTICE 'Renamed user_id to created_by and made nullable';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'evidence_bank' AND column_name = 'created_by'
    ) THEN
        -- Column already named created_by, just ensure it's nullable
        ALTER TABLE evidence_bank ALTER COLUMN created_by DROP NOT NULL;
        RAISE NOTICE 'created_by already exists, ensured nullable';
    END IF;
END $$;

-- Step 2: Add source_metadata column if missing
ALTER TABLE evidence_bank ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}';

-- Step 3: Verify the fix
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'evidence_bank'
AND column_name IN ('created_by', 'user_id', 'source_metadata')
ORDER BY column_name;
