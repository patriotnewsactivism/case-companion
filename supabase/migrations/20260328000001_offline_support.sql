-- Migration: Offline Support
-- Adds client_version column to core tables for optimistic concurrency control
-- and offline sync conflict detection.

-- Add client_version to cases
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS client_version INTEGER DEFAULT 1;

-- Add client_version to documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS client_version INTEGER DEFAULT 1;

-- Add client_version to timeline_events
ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS client_version INTEGER DEFAULT 1;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
