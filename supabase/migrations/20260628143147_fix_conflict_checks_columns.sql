-- Fix conflict_checks table: restore missing columns from V1 schema
-- that were lost in the V2 migration recreation

-- Add status column (required by resolveConflict and ConflictCheck UI)
ALTER TABLE public.conflict_checks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'clear';

-- Add resolution_notes column (required by resolveConflict)
ALTER TABLE public.conflict_checks
  ADD COLUMN IF NOT EXISTS resolution_notes text;

-- Add organization_id for team-level conflict tracking
ALTER TABLE public.conflict_checks
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Add resolved_by for tracking who resolved a conflict
ALTER TABLE public.conflict_checks
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
