-- Add missing columns to cases table
-- This migration adds columns that the frontend expects but are missing from the database

-- First, create the representation_type enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.representation_type AS ENUM ('plaintiff', 'defendant', 'executor', 'petitioner', 'respondent', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add user_id column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE public.cases ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add case_type column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE public.cases ADD COLUMN case_type TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add client_name column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE public.cases ADD COLUMN client_name TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add status column if it doesn't exist (use text to avoid enum conflicts)
DO $$ BEGIN
    ALTER TABLE public.cases ADD COLUMN status TEXT DEFAULT 'active';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add representation column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE public.cases ADD COLUMN representation TEXT DEFAULT 'plaintiff';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add case_theory column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE public.cases ADD COLUMN case_theory TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add key_issues column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE public.cases ADD COLUMN key_issues TEXT[];
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add winning_factors column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE public.cases ADD COLUMN winning_factors TEXT[];
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add next_deadline column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE public.cases ADD COLUMN next_deadline TIMESTAMP WITH TIME ZONE;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add notes column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE public.cases ADD COLUMN notes TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Create index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases(user_id);

-- Enable Row Level Security on cases table
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate them
DROP POLICY IF EXISTS "Users can view their own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can insert their own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can update their own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can delete their own cases" ON public.cases;

-- Create RLS policies for cases
CREATE POLICY "Users can view their own cases"
  ON public.cases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cases"
  ON public.cases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cases"
  ON public.cases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cases"
  ON public.cases FOR DELETE
  USING (auth.uid() = user_id);
