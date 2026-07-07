-- Realtime Presence System Migration
-- Enables real-time collaboration and presence tracking

-- Enable realtime for existing tables
DO $$
DECLARE
  tbl text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RETURN;
  END IF;

  FOREACH tbl IN ARRAY ARRAY[
    'cases',
    'documents',
    'timeline_events',
    'discovery_requests',
    'ocr_queue'
  ]
  LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_rel pr
        JOIN pg_publication p ON p.oid = pr.prpubid
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE p.pubname = 'supabase_realtime'
          AND n.nspname = 'public'
          AND c.relname = tbl
      )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping publication updates due to insufficient privileges';
END;
$$;

-- Create case presence table for real-time collaboration
CREATE TABLE IF NOT EXISTS public.case_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT,
  user_avatar_url TEXT,
  cursor_position JSONB DEFAULT '{}'::jsonb,
  current_section TEXT,
  last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_case_user UNIQUE (case_id, user_id)
);

-- Enable realtime for case_presence
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND to_regclass('public.case_presence') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_publication p ON p.oid = pr.prpubid
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE p.pubname = 'supabase_realtime'
        AND n.nspname = 'public'
        AND c.relname = 'case_presence'
    )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.case_presence;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping case_presence realtime publication due to insufficient privileges';
END;
$$;

-- Enable RLS
ALTER TABLE public.case_presence ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view presence in their cases" ON public.case_presence;
CREATE POLICY "Users can view presence in their cases"
  ON public.case_presence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = case_presence.case_id 
      AND cases.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own presence" ON public.case_presence;
CREATE POLICY "Users can insert their own presence"
  ON public.case_presence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own presence" ON public.case_presence;
CREATE POLICY "Users can update their own presence"
  ON public.case_presence FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own presence" ON public.case_presence;
CREATE POLICY "Users can delete their own presence"
  ON public.case_presence FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_case_presence_case_id ON public.case_presence(case_id);
CREATE INDEX IF NOT EXISTS idx_case_presence_user_id ON public.case_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_case_presence_last_active ON public.case_presence(last_active);

-- Function to clean up stale presence records (older than 5 minutes)
CREATE OR REPLACE FUNCTION public.cleanup_stale_presence()
RETURNS void AS $$
BEGIN
  DELETE FROM public.case_presence 
  WHERE last_active < now() - interval '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
