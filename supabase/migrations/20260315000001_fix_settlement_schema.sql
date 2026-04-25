-- Fix settlement_analyses schema to support JSONB fields used by the API
ALTER TABLE public.settlement_analyses
  ADD COLUMN IF NOT EXISTS economic_damages JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS non_economic_damages JSONB DEFAULT '{}'::jsonb;
