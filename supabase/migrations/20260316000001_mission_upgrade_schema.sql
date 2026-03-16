-- ═══════════════════════════════════════════════════════════════
-- CASEBUDDY ELITE UPGRADE — Mission 1-4 Schema
-- ═══════════════════════════════════════════════════════════════

-- ─── Mission 1A: case_context table ────────────────────────────
CREATE TABLE IF NOT EXISTS public.case_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE UNIQUE NOT NULL,
  case_type TEXT NOT NULL DEFAULT 'other',
  jurisdiction TEXT,
  court_name TEXT,
  judge_name TEXT,
  opposing_counsel TEXT,
  filing_date DATE,
  key_facts JSONB DEFAULT '[]'::jsonb,
  legal_theories TEXT[] DEFAULT '{}',
  defendants JSONB DEFAULT '[]'::jsonb,
  plaintiffs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.case_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their case context"
  ON public.case_context
  USING (
    EXISTS (SELECT 1 FROM public.cases WHERE cases.id = case_context.case_id AND cases.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.cases WHERE cases.id = case_context.case_id AND cases.user_id = auth.uid())
  );

-- ─── Mission 1B: timeline_events enhancement ────────────────────
ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS event_category TEXT,
  ADD COLUMN IF NOT EXISTS source_document_id UUID,
  ADD COLUMN IF NOT EXISTS source_document_name TEXT,
  ADD COLUMN IF NOT EXISTS source_page_reference TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence FLOAT,
  ADD COLUMN IF NOT EXISTS legal_significance TEXT,
  ADD COLUMN IF NOT EXISTS deadline_triggered_by TEXT,
  ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gaps_analysis JSONB DEFAULT '[]'::jsonb;

-- ─── Mission 2A: motion_templates table ─────────────────────────
CREATE TABLE IF NOT EXISTS public.motion_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motion_type TEXT NOT NULL,
  motion_category TEXT NOT NULL,
  case_types_applicable TEXT[] DEFAULT '{}',
  description TEXT,
  trigger_conditions TEXT[] DEFAULT '{}',
  section_structure JSONB DEFAULT '[]'::jsonb,
  sample_arguments JSONB DEFAULT '[]'::jsonb,
  relevant_rules TEXT[] DEFAULT '{}',
  bluebook_citations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Motion templates are read-only for all authenticated users (seeded data)
ALTER TABLE public.motion_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read motion templates"
  ON public.motion_templates FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─── Mission 2B: motion_suggestions table ───────────────────────
CREATE TABLE IF NOT EXISTS public.motion_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  motion_type TEXT NOT NULL,
  motion_category TEXT,
  urgency TEXT NOT NULL DEFAULT 'MEDIUM',
  why_applicable TEXT,
  key_argument TEXT,
  authorizing_rule TEXT,
  deadline_warning TEXT,
  estimated_strength FLOAT DEFAULT 0.5,
  generate_ready BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'suggested',
  generated_content JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.motion_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their motion suggestions"
  ON public.motion_suggestions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Mission 3: generated_motions table ─────────────────────────
CREATE TABLE IF NOT EXISTS public.generated_motions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  motion_type TEXT NOT NULL,
  title TEXT,
  caption JSONB,
  sections JSONB DEFAULT '[]'::jsonb,
  verification_flags TEXT[] DEFAULT '{}',
  custom_instructions TEXT,
  status TEXT DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  docx_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.generated_motions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their generated motions"
  ON public.generated_motions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Mission 4: voice_transcripts table ─────────────────────────
CREATE TABLE IF NOT EXISTS public.voice_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.trial_simulation_sessions(id) ON DELETE CASCADE NOT NULL,
  speaker TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp_ms INTEGER,
  is_interim BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.voice_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their voice transcripts"
  ON public.voice_transcripts
  USING (
    EXISTS (
      SELECT 1 FROM public.trial_simulation_sessions
      WHERE trial_simulation_sessions.id = voice_transcripts.session_id
        AND trial_simulation_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trial_simulation_sessions
      WHERE trial_simulation_sessions.id = voice_transcripts.session_id
        AND trial_simulation_sessions.user_id = auth.uid()
    )
  );

-- ─── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_case_context_case_id ON public.case_context(case_id);
CREATE INDEX IF NOT EXISTS idx_motion_suggestions_case_id ON public.motion_suggestions(case_id);
CREATE INDEX IF NOT EXISTS idx_motion_suggestions_urgency ON public.motion_suggestions(urgency);
CREATE INDEX IF NOT EXISTS idx_generated_motions_case_id ON public.generated_motions(case_id);
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_session_id ON public.voice_transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_category ON public.timeline_events(event_category);
CREATE INDEX IF NOT EXISTS idx_timeline_events_ai_generated ON public.timeline_events(is_ai_generated);

-- ─── Seed motion_templates ─────────────────────────────────────
INSERT INTO public.motion_templates (motion_type, motion_category, case_types_applicable, description, trigger_conditions, relevant_rules) VALUES
('Motion to Dismiss (12(b)(6))', 'dispositive', ARRAY['civil_rights_1983','federal_civil','civil_personal_injury'], 'Motion to dismiss for failure to state a claim upon which relief can be granted', ARRAY['complaint filed','facts insufficient to state claim','legal theory defective'], ARRAY['FRCP 12(b)(6)','Twombly/Iqbal pleading standard']),
('Motion for Summary Judgment', 'dispositive', ARRAY['civil_rights_1983','federal_civil','civil_personal_injury','family'], 'Motion for judgment as matter of law when no genuine dispute of material fact', ARRAY['discovery complete','undisputed facts favor movant','no triable issue'], ARRAY['FRCP 56','Anderson v. Liberty Lobby']),
('Motion to Strike Fraudulent Affidavit', 'evidentiary', ARRAY['civil_rights_1983','federal_civil','state_criminal'], 'Motion to strike affidavit containing material misrepresentations or fraud on the court', ARRAY['opposing affidavit contradicted by documentary evidence','perjury indicators','fraud on the court'], ARRAY['FRCP 12(f)','Court inherent authority','28 USC 1927']),
('Motion in Limine (Exclude Prior Bad Acts)', 'evidentiary', ARRAY['civil_rights_1983','federal_civil','dwi_criminal','state_criminal'], 'Motion to exclude prejudicial evidence before trial', ARRAY['trial approaching','prejudicial evidence anticipated','FRE 404(b) issue'], ARRAY['FRE 403','FRE 404','FRE 404(b)']),
('Motion for Preliminary Injunction / TRO', 'emergency', ARRAY['civil_rights_1983','federal_civil','family'], 'Emergency motion for temporary restraining order or preliminary injunction', ARRAY['irreparable harm imminent','likelihood of success on merits','balance of harms favors plaintiff'], ARRAY['FRCP 65','Winter v. NRDC','eBay Inc. v. MercExchange']),
('Motion to Compel Discovery', 'discovery', ARRAY['civil_rights_1983','federal_civil','civil_personal_injury','family'], 'Motion to compel production of documents or answers to interrogatories', ARRAY['discovery deadline approaching','responses overdue or deficient','objections improper'], ARRAY['FRCP 37','FRCP 26','Local Rules']),
('Motion for Sanctions (Rule 11)', 'procedural', ARRAY['civil_rights_1983','federal_civil','civil_personal_injury'], 'Motion for sanctions for filing frivolous pleadings or improper conduct', ARRAY['opposing party filed baseless pleading','bad faith conduct','frivolous arguments'], ARRAY['FRCP 11','28 USC 1927','Court inherent authority']),
('Motion to Reconsider / Alter Judgment', 'procedural', ARRAY['civil_rights_1983','federal_civil','state_criminal','dwi_criminal'], 'Motion to reconsider an order or alter or amend a final judgment', ARRAY['adverse ruling','new evidence discovered','clear error of law'], ARRAY['FRCP 59(e)','FRCP 60(b)','Local Rules']),
('Motion for Leave to Amend', 'procedural', ARRAY['civil_rights_1983','federal_civil','civil_personal_injury'], 'Motion seeking leave to file an amended complaint or answer', ARRAY['new facts discovered','original complaint deficient','adding parties necessary'], ARRAY['FRCP 15','Foman v. Davis','Leave shall be freely given']),
('Motion to Suppress (Criminal)', 'evidentiary', ARRAY['dwi_criminal','state_criminal'], 'Motion to suppress evidence obtained in violation of Fourth Amendment', ARRAY['unlawful search or seizure','Miranda violation','warrantless search'], ARRAY['FRCP Criminal 12(b)(3)','Fourth Amendment','Mapp v. Ohio']),
('Motion for Acquittal (Rule 29)', 'dispositive', ARRAY['dwi_criminal','state_criminal'], 'Motion for judgment of acquittal when evidence is insufficient to sustain conviction', ARRAY['prosecution rested','evidence insufficient as matter of law','no rational jury could convict'], ARRAY['FRCrimP 29','Jackson v. Virginia']),
('First Amendment / Anti-SLAPP Motion', 'dispositive', ARRAY['civil_rights_1983','federal_civil'], 'Motion to dismiss strategic lawsuit against public participation', ARRAY['plaintiff engaged in protected speech or petition activity','lawsuit targets protected conduct'], ARRAY['First Amendment','Anti-SLAPP statutes','Noerr-Pennington doctrine']),
('Section 1983 Civil Rights Brief Supplement', 'procedural', ARRAY['civil_rights_1983'], 'Supplemental brief establishing § 1983 constitutional violation elements', ARRAY['civil rights case','constitutional violation alleged','color of state law issue'], ARRAY['42 USC 1983','Monroe v. Pape','Monell v. Dept of Social Services']),
('Motion to Strike (FRCP 12(f))', 'procedural', ARRAY['civil_rights_1983','federal_civil','civil_personal_injury'], 'Motion to strike redundant, impertinent, or scandalous matter from pleading', ARRAY['pleading contains scandalous material','impertinent allegations','redundant matter'], ARRAY['FRCP 12(f)']),
('Habeas Corpus (28 USC 2255)', 'appellate', ARRAY['dwi_criminal','state_criminal'], 'Motion to vacate sentence under 28 USC 2255 for federal prisoners', ARRAY['post-conviction','constitutional error at trial','ineffective assistance of counsel'], ARRAY['28 USC 2255','Strickland v. Washington','AEDPA']),
('Motion for Extension of Time', 'procedural', ARRAY['civil_rights_1983','federal_civil','civil_personal_injury','dwi_criminal','state_criminal','family'], 'Motion to extend deadline for filing', ARRAY['deadline approaching','good cause exists','excusable neglect'], ARRAY['FRCP 6(b)','Local Rules']),
('Motion for CM/ECF Access', 'procedural', ARRAY['civil_rights_1983','federal_civil'], 'Motion for pro se litigant CM/ECF filing access', ARRAY['pro se litigant','need electronic filing access','frequent filings anticipated'], ARRAY['Local ECF Rules','Standing Orders']),
('Opposition to Motion to Dismiss', 'dispositive', ARRAY['civil_rights_1983','federal_civil','civil_personal_injury'], 'Response in opposition to defendant motion to dismiss', ARRAY['motion to dismiss filed','must respond within deadline'], ARRAY['FRCP 12(b)(6)','Local Rules for response timing']),
('Response to Summary Judgment', 'dispositive', ARRAY['civil_rights_1983','federal_civil','civil_personal_injury'], 'Opposition to motion for summary judgment with disputed facts', ARRAY['summary judgment motion filed','genuine disputes of material fact exist'], ARRAY['FRCP 56','Local Rules']),
('Emergency Motion (Generic)', 'emergency', ARRAY['civil_rights_1983','federal_civil','civil_personal_injury','dwi_criminal','state_criminal','family'], 'Generic emergency motion for urgent relief', ARRAY['emergency exists','irreparable harm without immediate relief'], ARRAY['FRCP 65','Local Emergency Rules'])
ON CONFLICT DO NOTHING;
