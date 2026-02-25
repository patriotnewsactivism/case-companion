-- Calendar Sync System Migration
-- Integrates with external calendar providers

-- Create calendar provider enum
DO $$ BEGIN
  CREATE TYPE public.calendar_provider AS ENUM ('google', 'outlook', 'apple');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create sync status enum
DO $$ BEGIN
  CREATE TYPE public.sync_status AS ENUM ('pending', 'synced', 'failed', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create calendar integrations table
CREATE TABLE IF NOT EXISTS public.calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider public.calendar_provider NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  calendar_id TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create synced calendar events table
CREATE TABLE IF NOT EXISTS public.synced_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_date_id UUID,
  integration_id UUID REFERENCES public.calendar_integrations(id) ON DELETE CASCADE NOT NULL,
  external_event_id TEXT NOT NULL,
  provider public.calendar_provider NOT NULL,
  last_synced TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sync_status public.sync_status NOT NULL DEFAULT 'pending',
  sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_integration_event UNIQUE (integration_id, external_event_id)
);

DO $$
BEGIN
  IF to_regclass('public.court_dates') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'synced_calendar_events_court_date_id_fkey'
    )
  THEN
    ALTER TABLE public.synced_calendar_events
      ADD CONSTRAINT synced_calendar_events_court_date_id_fkey
      FOREIGN KEY (court_date_id) REFERENCES public.court_dates(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Enable RLS
ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synced_calendar_events ENABLE ROW LEVEL SECURITY;

-- Calendar integrations policies
DROP POLICY IF EXISTS "Users can view their calendar integrations" ON public.calendar_integrations;
CREATE POLICY "Users can view their calendar integrations"
  ON public.calendar_integrations FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create calendar integrations" ON public.calendar_integrations;
CREATE POLICY "Users can create calendar integrations"
  ON public.calendar_integrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their calendar integrations" ON public.calendar_integrations;
CREATE POLICY "Users can update their calendar integrations"
  ON public.calendar_integrations FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their calendar integrations" ON public.calendar_integrations;
CREATE POLICY "Users can delete their calendar integrations"
  ON public.calendar_integrations FOR DELETE
  USING (user_id = auth.uid());

-- Synced calendar events policies
DROP POLICY IF EXISTS "Users can view their synced events" ON public.synced_calendar_events;
CREATE POLICY "Users can view their synced events"
  ON public.synced_calendar_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_integrations 
      WHERE calendar_integrations.id = synced_calendar_events.integration_id 
      AND calendar_integrations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create synced events" ON public.synced_calendar_events;
CREATE POLICY "Users can create synced events"
  ON public.synced_calendar_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calendar_integrations 
      WHERE calendar_integrations.id = synced_calendar_events.integration_id 
      AND calendar_integrations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their synced events" ON public.synced_calendar_events;
CREATE POLICY "Users can update their synced events"
  ON public.synced_calendar_events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_integrations 
      WHERE calendar_integrations.id = synced_calendar_events.integration_id 
      AND calendar_integrations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their synced events" ON public.synced_calendar_events;
CREATE POLICY "Users can delete their synced events"
  ON public.synced_calendar_events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_integrations 
      WHERE calendar_integrations.id = synced_calendar_events.integration_id 
      AND calendar_integrations.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_user_id ON public.calendar_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_provider ON public.calendar_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_synced_calendar_events_integration_id ON public.synced_calendar_events(integration_id);
CREATE INDEX IF NOT EXISTS idx_synced_calendar_events_court_date_id ON public.synced_calendar_events(court_date_id);
CREATE INDEX IF NOT EXISTS idx_synced_calendar_events_status ON public.synced_calendar_events(sync_status);
CREATE INDEX IF NOT EXISTS idx_synced_calendar_events_last_synced ON public.synced_calendar_events(last_synced);

-- Create updated_at triggers
DROP TRIGGER IF EXISTS update_calendar_integrations_updated_at ON public.calendar_integrations;
CREATE TRIGGER update_calendar_integrations_updated_at
  BEFORE UPDATE ON public.calendar_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get integrations needing sync
CREATE OR REPLACE FUNCTION public.get_integrations_needing_sync()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  provider public.calendar_provider,
  calendar_id TEXT,
  refresh_token TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id,
    ci.user_id,
    ci.provider,
    ci.calendar_id,
    ci.refresh_token
  FROM public.calendar_integrations ci
  WHERE ci.sync_enabled = true
  AND (
    ci.last_sync_at IS NULL 
    OR ci.last_sync_at < now() - interval '15 minutes'
  )
  AND (
    ci.token_expires_at IS NULL 
    OR ci.token_expires_at > now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
