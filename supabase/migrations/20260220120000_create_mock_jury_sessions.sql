-- Create mock_jury_sessions table for storing jury simulation sessions
CREATE TABLE IF NOT EXISTS mock_jury_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  opening_statement TEXT NOT NULL,
  closing_argument TEXT NOT NULL,
  jurors JSONB NOT NULL DEFAULT '[]',
  deliberation JSONB NOT NULL DEFAULT '[]',
  verdict JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE mock_jury_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own sessions
CREATE POLICY "Users can view own mock jury sessions" ON mock_jury_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own sessions
CREATE POLICY "Users can insert own mock jury sessions" ON mock_jury_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own sessions
CREATE POLICY "Users can delete own mock jury sessions" ON mock_jury_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_mock_jury_sessions_user_id ON mock_jury_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mock_jury_sessions_case_id ON mock_jury_sessions(case_id);
