-- Analytics System Migration
-- Tracks case analytics and usage events

-- Create case analytics table
CREATE TABLE IF NOT EXISTS public.case_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE UNIQUE NOT NULL,
  documents_count INTEGER NOT NULL DEFAULT 0,
  documents_analyzed INTEGER NOT NULL DEFAULT 0,
  total_pages INTEGER NOT NULL DEFAULT 0,
  total_words INTEGER NOT NULL DEFAULT 0,
  audio_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
  video_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
  timeline_events INTEGER NOT NULL DEFAULT 0,
  discovery_requests INTEGER NOT NULL DEFAULT 0,
  evidence_analyses INTEGER NOT NULL DEFAULT 0,
  mock_jury_sessions INTEGER NOT NULL DEFAULT 0,
  trial_prep_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
  estimated_time_saved_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
  win_probability DECIMAL(5, 2),
  predicted_outcome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create usage events table
CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  resource_id UUID,
  resource_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.case_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Case analytics policies
DROP POLICY IF EXISTS "Users can view their case analytics" ON public.case_analytics;
CREATE POLICY "Users can view their case analytics"
  ON public.case_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = case_analytics.case_id 
      AND cases.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert case analytics" ON public.case_analytics;
CREATE POLICY "Users can insert case analytics"
  ON public.case_analytics FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = case_analytics.case_id 
      AND cases.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update case analytics" ON public.case_analytics;
CREATE POLICY "Users can update case analytics"
  ON public.case_analytics FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = case_analytics.case_id 
      AND cases.user_id = auth.uid()
    )
  );

-- Usage events policies
DROP POLICY IF EXISTS "Users can view their usage events" ON public.usage_events;
CREATE POLICY "Users can view their usage events"
  ON public.usage_events FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert usage events" ON public.usage_events;
CREATE POLICY "Users can insert usage events"
  ON public.usage_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_case_analytics_case_id ON public.case_analytics(case_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON public.usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON public.usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_category ON public.usage_events(event_category);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON public.usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_resource ON public.usage_events(resource_type, resource_id);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_case_analytics_updated_at ON public.case_analytics;
CREATE TRIGGER update_case_analytics_updated_at
  BEFORE UPDATE ON public.case_analytics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update case analytics
CREATE OR REPLACE FUNCTION public.update_case_analytics(p_case_id UUID)
RETURNS void AS $$
DECLARE
  v_documents_count INTEGER;
  v_documents_analyzed INTEGER;
  v_timeline_events INTEGER;
  v_mock_jury_sessions INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_documents_count FROM public.documents WHERE case_id = p_case_id;
  SELECT COUNT(*) INTO v_documents_analyzed FROM public.documents WHERE case_id = p_case_id AND ai_analyzed = true;
  SELECT COUNT(*) INTO v_timeline_events FROM public.timeline_events WHERE case_id = p_case_id;
  SELECT COUNT(*) INTO v_mock_jury_sessions FROM public.mock_jury_sessions WHERE case_id = p_case_id;
  
  INSERT INTO public.case_analytics (case_id, documents_count, documents_analyzed, timeline_events, mock_jury_sessions)
  VALUES (p_case_id, v_documents_count, v_documents_analyzed, v_timeline_events, v_mock_jury_sessions)
  ON CONFLICT (case_id) DO UPDATE SET
    documents_count = EXCLUDED.documents_count,
    documents_analyzed = EXCLUDED.documents_analyzed,
    timeline_events = EXCLUDED.timeline_events,
    mock_jury_sessions = EXCLUDED.mock_jury_sessions,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
