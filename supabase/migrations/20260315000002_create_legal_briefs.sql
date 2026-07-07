-- Create legal_briefs table for drafting motions, briefs, and court filings
CREATE TABLE IF NOT EXISTS public.legal_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'motion',
  status TEXT NOT NULL DEFAULT 'draft',
  content TEXT DEFAULT '',
  court TEXT,
  filed_date DATE,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their briefs"
  ON public.legal_briefs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS legal_briefs_case_id_idx ON public.legal_briefs(case_id);
CREATE INDEX IF NOT EXISTS legal_briefs_user_id_idx ON public.legal_briefs(user_id);
