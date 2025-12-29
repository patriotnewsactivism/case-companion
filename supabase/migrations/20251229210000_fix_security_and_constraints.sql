-- Comprehensive Database Security and Constraint Fixes
-- This migration addresses all critical database issues identified in the security audit

-- ============================================================================
-- 1. ADD MISSING DELETE POLICIES
-- ============================================================================

-- Add DELETE policy for import_jobs table
-- Users should be able to delete their own import job records
CREATE POLICY IF NOT EXISTS "Users can delete their own import jobs"
  ON public.import_jobs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add DELETE policy for profiles table
-- Users should be able to delete their own profile (GDPR compliance)
CREATE POLICY IF NOT EXISTS "Users can delete their own profile"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 2. ADD NOT NULL CONSTRAINTS TO IMPORT_JOBS
-- ============================================================================

-- These fields are required for import jobs to function correctly
-- Adding NOT NULL constraints ensures data integrity

-- First, update any existing NULL values with default placeholders (shouldn't be any, but safety first)
UPDATE public.import_jobs
SET source_folder_id = 'unknown'
WHERE source_folder_id IS NULL;

UPDATE public.import_jobs
SET source_folder_name = 'Unknown Folder'
WHERE source_folder_name IS NULL;

UPDATE public.import_jobs
SET source_folder_path = '/'
WHERE source_folder_path IS NULL;

-- Now add NOT NULL constraints
ALTER TABLE public.import_jobs
  ALTER COLUMN source_folder_id SET NOT NULL,
  ALTER COLUMN source_folder_name SET NOT NULL,
  ALTER COLUMN source_folder_path SET NOT NULL;

-- ============================================================================
-- 3. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON POLICY "Users can delete their own import jobs" ON public.import_jobs
  IS 'Allows users to delete their own import job records. Added for data cleanup and user control.';

COMMENT ON POLICY "Users can delete their own profile" ON public.profiles
  IS 'Allows users to delete their own profile. Required for GDPR compliance and user data control.';

COMMENT ON COLUMN public.import_jobs.source_folder_id
  IS 'Google Drive folder ID. Required field (NOT NULL) for tracking import source.';

COMMENT ON COLUMN public.import_jobs.source_folder_name
  IS 'Human-readable folder name. Required field (NOT NULL) for display purposes.';

COMMENT ON COLUMN public.import_jobs.source_folder_path
  IS 'Full path to folder in Google Drive. Required field (NOT NULL) for tracking folder location.';
