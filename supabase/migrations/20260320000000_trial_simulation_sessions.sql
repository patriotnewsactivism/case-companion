-- Trial Simulation Sessions and Analytics Tables

-- Table for storing trial simulation sessions
CREATE TABLE IF NOT EXISTS trial_simulation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  mode TEXT NOT NULL,
  scenario TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  transcript JSONB DEFAULT '[]',
  exhibits_shown JSONB DEFAULT '[]',
  objections_made JSONB DEFAULT '[]',
  performance_metrics JSONB,
  ai_coaching JSONB DEFAULT '[]',
  witness_profile JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table for storing session analytics
CREATE TABLE IF NOT EXISTS trial_session_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID REFERENCES trial_simulation_sessions(id) ON DELETE CASCADE,
  total_questions INTEGER DEFAULT 0,
  successful_objections INTEGER DEFAULT 0,
  missed_objections INTEGER DEFAULT 0,
  leading_questions_used INTEGER DEFAULT 0,
  open_questions_used INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  credibility_score INTEGER,
  improvement_areas TEXT[],
  strengths TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add personality fields to witness_prep table
DO $$
BEGIN
  IF to_regclass('public.witness_prep') IS NOT NULL THEN
    ALTER TABLE public.witness_prep ADD COLUMN IF NOT EXISTS personality TEXT DEFAULT 'cooperative';
    ALTER TABLE public.witness_prep ADD COLUMN IF NOT EXISTS simulation_notes TEXT;
  END IF;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trial_sessions_case_id ON trial_simulation_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_user_id ON trial_simulation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_mode ON trial_simulation_sessions(mode);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_started_at ON trial_simulation_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_analytics_session_id ON trial_session_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_trial_analytics_user_id ON trial_session_analytics(user_id);

-- Enable RLS
ALTER TABLE trial_simulation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_session_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trial_simulation_sessions
CREATE POLICY "Users can view their own trial sessions"
  ON trial_simulation_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trial sessions"
  ON trial_simulation_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trial sessions"
  ON trial_simulation_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trial sessions"
  ON trial_simulation_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for trial_session_analytics
CREATE POLICY "Users can view their own session analytics"
  ON trial_session_analytics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own session analytics"
  ON trial_session_analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own session analytics"
  ON trial_session_analytics FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own session analytics"
  ON trial_session_analytics FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_trial_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS trial_session_updated_at ON trial_simulation_sessions;
CREATE TRIGGER trial_session_updated_at
  BEFORE UPDATE ON trial_simulation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_trial_session_updated_at();

-- Add comments
COMMENT ON TABLE trial_simulation_sessions IS 'Stores trial practice sessions with full transcripts and metrics';
COMMENT ON TABLE trial_session_analytics IS 'Aggregated performance metrics for trial simulation sessions';
COMMENT ON COLUMN trial_simulation_sessions.transcript IS 'JSON array of conversation messages with role, content, timestamp';
COMMENT ON COLUMN trial_simulation_sessions.exhibits_shown IS 'JSON array of exhibits referenced during session';
COMMENT ON COLUMN trial_simulation_sessions.objections_made IS 'JSON array of objections with timestamps and rulings';
COMMENT ON COLUMN trial_simulation_sessions.performance_metrics IS 'JSON object with real-time performance data';
COMMENT ON COLUMN trial_simulation_sessions.ai_coaching IS 'JSON array of coaching tips provided during session';
COMMENT ON COLUMN trial_simulation_sessions.witness_profile IS 'JSON object describing the AI witness personality';
