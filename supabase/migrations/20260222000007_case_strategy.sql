-- Case Strategy System Migration
-- Stores strategic analysis for cases

-- Create analysis type enum
DO $$ BEGIN
  CREATE TYPE public.analysis_type AS ENUM ('swot', 'outcome_prediction', 'timeline', 'settlement');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create case strategies table
CREATE TABLE IF NOT EXISTS public.case_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  analysis_type public.analysis_type NOT NULL,
  strengths TEXT[] DEFAULT '{}'::text[],
  weaknesses TEXT[] DEFAULT '{}'::text[],
  opportunities TEXT[] DEFAULT '{}'::text[],
  threats TEXT[] DEFAULT '{}'::text[],
  win_probability DECIMAL(5, 2) CHECK (win_probability >= 0 AND win_probability <= 100),
  predicted_outcome TEXT,
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  settlement_range JSONB DEFAULT '{}'::jsonb,
  key_factors JSONB DEFAULT '[]'::jsonb,
  risk_assessment JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.case_strategies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their case strategies" ON public.case_strategies;
CREATE POLICY "Users can view their case strategies"
  ON public.case_strategies FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create case strategies" ON public.case_strategies;
CREATE POLICY "Users can create case strategies"
  ON public.case_strategies FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their case strategies" ON public.case_strategies;
CREATE POLICY "Users can update their case strategies"
  ON public.case_strategies FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their case strategies" ON public.case_strategies;
CREATE POLICY "Users can delete their case strategies"
  ON public.case_strategies FOR DELETE
  USING (user_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_case_strategies_case_id ON public.case_strategies(case_id);
CREATE INDEX IF NOT EXISTS idx_case_strategies_user_id ON public.case_strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_case_strategies_analysis_type ON public.case_strategies(analysis_type);
CREATE INDEX IF NOT EXISTS idx_case_strategies_created_at ON public.case_strategies(created_at DESC);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_case_strategies_updated_at ON public.case_strategies;
CREATE TRIGGER update_case_strategies_updated_at
  BEFORE UPDATE ON public.case_strategies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get latest strategy by type for a case
CREATE OR REPLACE FUNCTION public.get_latest_strategy(
  p_case_id UUID,
  p_analysis_type public.analysis_type
)
RETURNS TABLE (
  id UUID,
  strengths TEXT[],
  weaknesses TEXT[],
  opportunities TEXT[],
  threats TEXT[],
  win_probability DECIMAL(5, 2),
  predicted_outcome TEXT,
  recommended_actions JSONB,
  settlement_range JSONB,
  key_factors JSONB,
  risk_assessment JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.strengths,
    cs.weaknesses,
    cs.opportunities,
    cs.threats,
    cs.win_probability,
    cs.predicted_outcome,
    cs.recommended_actions,
    cs.settlement_range,
    cs.key_factors,
    cs.risk_assessment,
    cs.created_at
  FROM public.case_strategies cs
  WHERE cs.case_id = p_case_id
  AND cs.analysis_type = p_analysis_type
  AND cs.user_id = auth.uid()
  ORDER BY cs.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
