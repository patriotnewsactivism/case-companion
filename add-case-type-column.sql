-- Add case_type column to cases table
-- Run this SQL in the Supabase SQL Editor if the column is missing

-- Add case_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'cases'
        AND column_name = 'case_type'
    ) THEN
        ALTER TABLE public.cases ADD COLUMN case_type TEXT;
        RAISE NOTICE 'case_type column added successfully';
    ELSE
        RAISE NOTICE 'case_type column already exists';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cases'
  AND column_name = 'case_type';
