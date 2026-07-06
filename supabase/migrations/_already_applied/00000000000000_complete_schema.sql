-- Complete Schema Migration for CaseBuddy
-- This file contains all necessary schema definitions
-- Run this in Supabase SQL Editor if tables are missing

-- =================================================================
-- STEP 1: Create necessary enums and types
-- =================================================================

-- Create case status enum (if not exists)
DO $$ BEGIN
  CREATE TYPE public.case_status AS ENUM ('active', 'discovery', 'pending', 'review', 'closed', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create representation type enum (if not exists)
DO $$ BEGIN
  CREATE TYPE public.representation_type AS ENUM ('plaintiff', 'defendant', 'executor', 'petitioner', 'respondent', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =================================================================
-- STEP 2: Create core tables
-- =================================================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  firm_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cases table
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  case_type TEXT NOT NULL,
  client_name TEXT NOT NULL,
  status case_status NOT NULL DEFAULT 'active',
  representation representation_type NOT NULL DEFAULT 'plaintiff',
  case_theory TEXT,
  key_issues TEXT[],
  winning_factors TEXT[],
  next_deadline TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT,
  file_size INTEGER,
  bates_number TEXT,
  summary TEXT,
  key_facts TEXT[],
  favorable_findings TEXT[],
  adverse_findings TEXT[],
  action_items TEXT[],
  ai_analyzed BOOLEAN DEFAULT false,
  ocr_text TEXT,
  transcription TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create timeline events table
CREATE TABLE IF NOT EXISTS public.timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  event_type TEXT,
  linked_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  importance TEXT DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create import jobs table
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_files INTEGER DEFAULT 0,
  processed_files INTEGER DEFAULT 0,
  failed_files INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create video rooms table
CREATE TABLE IF NOT EXISTS public.video_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  room_name TEXT NOT NULL UNIQUE,
  room_url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  max_participants INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- =================================================================
-- STEP 3: Enable Row Level Security
-- =================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_rooms ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- STEP 4: Create RLS Policies
-- =================================================================

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Cases policies
DROP POLICY IF EXISTS "Users can view their own cases" ON public.cases;
CREATE POLICY "Users can view their own cases"
  ON public.cases FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own cases" ON public.cases;
CREATE POLICY "Users can insert their own cases"
  ON public.cases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own cases" ON public.cases;
CREATE POLICY "Users can update their own cases"
  ON public.cases FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own cases" ON public.cases;
CREATE POLICY "Users can delete their own cases"
  ON public.cases FOR DELETE
  USING (auth.uid() = user_id);

-- Documents policies
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
CREATE POLICY "Users can view their own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
CREATE POLICY "Users can insert their own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
CREATE POLICY "Users can update their own documents"
  ON public.documents FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
CREATE POLICY "Users can delete their own documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id);

-- Timeline events policies
DROP POLICY IF EXISTS "Users can view their own timeline events" ON public.timeline_events;
CREATE POLICY "Users can view their own timeline events"
  ON public.timeline_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own timeline events" ON public.timeline_events;
CREATE POLICY "Users can insert their own timeline events"
  ON public.timeline_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own timeline events" ON public.timeline_events;
CREATE POLICY "Users can update their own timeline events"
  ON public.timeline_events FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own timeline events" ON public.timeline_events;
CREATE POLICY "Users can delete their own timeline events"
  ON public.timeline_events FOR DELETE
  USING (auth.uid() = user_id);

-- Import jobs policies
DROP POLICY IF EXISTS "Users can view their own import jobs" ON public.import_jobs;
CREATE POLICY "Users can view their own import jobs"
  ON public.import_jobs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own import jobs" ON public.import_jobs;
CREATE POLICY "Users can insert their own import jobs"
  ON public.import_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own import jobs" ON public.import_jobs;
CREATE POLICY "Users can update their own import jobs"
  ON public.import_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Video rooms policies
DROP POLICY IF EXISTS "Users can view their own video rooms" ON public.video_rooms;
CREATE POLICY "Users can view their own video rooms"
  ON public.video_rooms FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own video rooms" ON public.video_rooms;
CREATE POLICY "Users can insert their own video rooms"
  ON public.video_rooms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own video rooms" ON public.video_rooms;
CREATE POLICY "Users can update their own video rooms"
  ON public.video_rooms FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own video rooms" ON public.video_rooms;
CREATE POLICY "Users can delete their own video rooms"
  ON public.video_rooms FOR DELETE
  USING (auth.uid() = user_id);

-- =================================================================
-- STEP 5: Create helper functions
-- =================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Handle new user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =================================================================
-- STEP 6: Create triggers
-- =================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_cases_updated_at ON public.cases;
DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;
DROP TRIGGER IF EXISTS update_timeline_events_updated_at ON public.timeline_events;
DROP TRIGGER IF EXISTS update_import_jobs_updated_at ON public.import_jobs;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_timeline_events_updated_at
  BEFORE UPDATE ON public.timeline_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_import_jobs_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =================================================================
-- STEP 7: Create indexes
-- =================================================================

-- Cases indexes
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_updated_at ON public.cases(updated_at DESC);

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_bates_number ON public.documents(bates_number);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

-- Timeline events indexes
CREATE INDEX IF NOT EXISTS idx_timeline_events_case_id ON public.timeline_events(case_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_event_date ON public.timeline_events(event_date);
CREATE INDEX IF NOT EXISTS idx_timeline_events_user_id ON public.timeline_events(user_id);

-- Import jobs indexes
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON public.import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_case_id ON public.import_jobs(case_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs(status);

-- Video rooms indexes
CREATE INDEX IF NOT EXISTS idx_video_rooms_user_id ON public.video_rooms(user_id);
CREATE INDEX IF NOT EXISTS idx_video_rooms_case_id ON public.video_rooms(case_id);
CREATE INDEX IF NOT EXISTS idx_video_rooms_room_name ON public.video_rooms(room_name);

-- =================================================================
-- STEP 8: Create storage bucket and policies
-- =================================================================

-- Create storage bucket for case documents (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-documents', 'case-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
CREATE POLICY "Users can upload their own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
CREATE POLICY "Users can view their own documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
CREATE POLICY "Users can update their own documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
CREATE POLICY "Users can delete their own documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =================================================================
-- STEP 9: Refresh schema cache
-- =================================================================

-- Reset PostgREST schema cache
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

-- =================================================================
-- Migration Complete!
-- =================================================================
