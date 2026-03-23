-- ═══════════════════════════════════════════════════════════════
-- CASEBUDDY ELITE UPGRADE — Schema fixes and enhancements
-- ═══════════════════════════════════════════════════════════════

-- ─── Fix: Add is_dismissed column to motion_suggestions ──────
ALTER TABLE public.motion_suggestions
  ADD COLUMN IF NOT EXISTS is_dismissed BOOLEAN DEFAULT false;

-- ─── Fix: Add unique constraints for upsert operations ───────

-- Timeline events: allow upsert on case_id + title + event_date
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timeline_events_case_title_date_unique'
  ) THEN
    ALTER TABLE public.timeline_events
      ADD CONSTRAINT timeline_events_case_title_date_unique
      UNIQUE (case_id, title, event_date);
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Unique constraint on timeline_events already exists or cannot be created: %', SQLERRM;
END $$;

-- Motion suggestions: allow upsert on case_id + motion_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'motion_suggestions_case_type_unique'
  ) THEN
    ALTER TABLE public.motion_suggestions
      ADD CONSTRAINT motion_suggestions_case_type_unique
      UNIQUE (case_id, motion_type);
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Unique constraint on motion_suggestions already exists or cannot be created: %', SQLERRM;
END $$;

-- ─── Enhancement: Add trial_sessions table for Mission 4 ─────
CREATE TABLE IF NOT EXISTS public.trial_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  session_name TEXT,
  simulation_mode TEXT NOT NULL,
  simulation_phase TEXT,
  characters_config JSONB,
  session_transcript JSONB DEFAULT '[]'::jsonb,
  session_score JSONB,
  coaching_notes TEXT[] DEFAULT '{}',
  duration_seconds INTEGER,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.trial_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users own their trial sessions"
    ON public.trial_sessions
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Policy already exists';
END $$;

CREATE INDEX IF NOT EXISTS idx_trial_sessions_case_id ON public.trial_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_user_id ON public.trial_sessions(user_id);

-- ─── Enhancement: Add more motion templates ─────────────────
INSERT INTO public.motion_templates (motion_type, motion_category, case_types_applicable, description, trigger_conditions, relevant_rules) VALUES
('Motion to Dismiss (12(b)(1))', 'dispositive', ARRAY['civil_rights_1983','federal_civil'], 'Motion to dismiss for lack of subject matter jurisdiction', ARRAY['jurisdictional defect','standing issue','mootness'], ARRAY['FRCP 12(b)(1)','Art. III standing requirements']),
('Motion to Dismiss (12(b)(2))', 'dispositive', ARRAY['civil_rights_1983','federal_civil'], 'Motion to dismiss for lack of personal jurisdiction', ARRAY['defendant not domiciled in forum','insufficient contacts','no general or specific jurisdiction'], ARRAY['FRCP 12(b)(2)','Int''l Shoe minimum contacts']),
('Motion for Mistrial', 'procedural', ARRAY['dwi_criminal','state_criminal','civil_rights_1983'], 'Motion for mistrial based on prejudicial error or jury misconduct', ARRAY['prejudicial error occurred','jury exposed to inadmissible evidence','prosecutorial misconduct'], ARRAY['FRCrimP 26.3','Due Process Clause']),
('Bivens Action Complaint Supplement', 'procedural', ARRAY['civil_rights_1983','federal_civil'], 'Supplemental brief for Bivens constitutional tort claims against federal officers', ARRAY['federal officer violated constitutional rights','no alternative remedy available'], ARRAY['Bivens v. Six Unknown Named Agents','Ziglar v. Abbasi']),
('Habeas Corpus (28 USC 2254)', 'appellate', ARRAY['state_criminal','dwi_criminal'], 'Petition for writ of habeas corpus for state prisoners in federal court', ARRAY['state remedies exhausted','constitutional violation at trial','ineffective assistance'], ARRAY['28 USC 2254','AEDPA','Williams v. Taylor']),
('Motion to Strike (Pleading)', 'procedural', ARRAY['civil_rights_1983','federal_civil'], 'Motion to strike insufficient defense or counterclaim from pleading', ARRAY['defense legally insufficient','scandalous matter in pleading'], ARRAY['FRCP 12(f)'])
ON CONFLICT DO NOTHING;

-- ─── Enhancement: Add case_context additional fields ─────────
ALTER TABLE public.case_context
  ADD COLUMN IF NOT EXISTS case_number TEXT,
  ADD COLUMN IF NOT EXISTS plaintiff_name TEXT,
  ADD COLUMN IF NOT EXISTS defendant_name TEXT,
  ADD COLUMN IF NOT EXISTS defense_theory TEXT;

-- ─── Indexes for performance ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_motion_suggestions_is_dismissed ON public.motion_suggestions(is_dismissed);
CREATE INDEX IF NOT EXISTS idx_generated_motions_status ON public.generated_motions(status);
CREATE INDEX IF NOT EXISTS idx_timeline_events_event_date ON public.timeline_events(event_date);
