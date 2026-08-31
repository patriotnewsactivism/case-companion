-- Standardized Supabase Schema for Case Companion / Courtroom & Jury Simulators

-- 1. Cases Table
CREATE TABLE IF NOT EXISTS public.cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    case_type TEXT NOT NULL DEFAULT 'civil',
    client_name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    representation TEXT NOT NULL DEFAULT 'plaintiff',
    case_theory TEXT,
    key_issues TEXT[],
    winning_factors TEXT[],
    next_deadline TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Documents Table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    bates_number TEXT,
    summary TEXT,
    key_facts TEXT[],
    favorable_findings TEXT[],
    adverse_findings TEXT[],
    action_items TEXT[],
    ai_analyzed BOOLEAN DEFAULT false,
    ocr_text TEXT,
    ocr_page_count INT DEFAULT 0,
    ocr_processed_at TIMESTAMPTZ,
    transcription_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Simulation Sessions Table
CREATE TABLE IF NOT EXISTS public.simulation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scenario_id TEXT NOT NULL,
    simulation_mode TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress, completed, abandoned
    score NUMERIC(5,2),
    ai_feedback JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Simulation Transcripts Table
CREATE TABLE IF NOT EXISTS public.simulation_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.simulation_sessions(id) ON DELETE CASCADE,
    speaker TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    objection_raised BOOLEAN DEFAULT false,
    objection_ruling TEXT,
    score_delta NUMERIC(4,2) DEFAULT 0,
    timestamp_offset_seconds NUMERIC(8,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Jury Deliberation Sessions Table
CREATE TABLE IF NOT EXISTS public.jury_deliberations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    panel_size INT NOT NULL DEFAULT 6,
    panel_profiles JSONB NOT NULL DEFAULT '[]'::jsonb,
    round_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    final_verdict TEXT, -- plaintiff, defendant, hung_jury
    consensus_round INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Trial Prep Checklists Table
CREATE TABLE IF NOT EXISTS public.trial_prep_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- witness, exhibit, motion, jury_instruction, logistics
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed
    assigned_to TEXT,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents(case_id);
CREATE INDEX IF NOT EXISTS idx_simulation_sessions_case_id ON public.simulation_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_simulation_sessions_user_id ON public.simulation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_simulation_transcripts_session_id ON public.simulation_transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_jury_deliberations_case_id ON public.jury_deliberations(case_id);
CREATE INDEX IF NOT EXISTS idx_trial_prep_items_case_id ON public.trial_prep_items(case_id);

-- Enable Row Level Security
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jury_deliberations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_prep_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
    -- cases
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cases' AND policyname = 'Users can manage their own cases') THEN
        CREATE POLICY "Users can manage their own cases" ON public.cases
            FOR ALL USING (auth.uid() = user_id);
    END IF;

    -- documents
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'Users can manage their own documents') THEN
        CREATE POLICY "Users can manage their own documents" ON public.documents
            FOR ALL USING (auth.uid() = user_id);
    END IF;

    -- simulation_sessions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'simulation_sessions' AND policyname = 'Users can manage their own simulations') THEN
        CREATE POLICY "Users can manage their own simulations" ON public.simulation_sessions
            FOR ALL USING (auth.uid() = user_id);
    END IF;

    -- simulation_transcripts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'simulation_transcripts' AND policyname = 'Users can view session transcripts') THEN
        CREATE POLICY "Users can view session transcripts" ON public.simulation_transcripts
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.simulation_sessions s
                    WHERE s.id = simulation_transcripts.session_id AND s.user_id = auth.uid()
                )
            );
    END IF;

    -- jury_deliberations
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jury_deliberations' AND policyname = 'Users can manage jury deliberations') THEN
        CREATE POLICY "Users can manage jury deliberations" ON public.jury_deliberations
            FOR ALL USING (auth.uid() = user_id);
    END IF;

    -- trial_prep_items
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trial_prep_items' AND policyname = 'Users can manage trial prep items') THEN
        CREATE POLICY "Users can manage trial prep items" ON public.trial_prep_items
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;
