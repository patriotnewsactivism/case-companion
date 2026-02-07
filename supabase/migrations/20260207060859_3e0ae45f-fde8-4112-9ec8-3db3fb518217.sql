-- Create trial_prep_checklists table
CREATE TABLE public.trial_prep_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  trial_date DATE,
  status TEXT DEFAULT 'in_progress',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create witness_prep table
CREATE TABLE public.witness_prep (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.trial_prep_checklists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  witness_name TEXT NOT NULL,
  witness_type TEXT DEFAULT 'fact', -- fact, expert, character
  contact_info TEXT,
  prep_status TEXT DEFAULT 'not_started', -- not_started, scheduled, in_progress, completed
  prep_date DATE,
  testimony_summary TEXT,
  anticipated_cross TEXT,
  prep_notes TEXT,
  order_of_appearance INTEGER,
  subpoena_served BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exhibit_list table
CREATE TABLE public.exhibit_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.trial_prep_checklists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  exhibit_number TEXT NOT NULL,
  description TEXT NOT NULL,
  exhibit_type TEXT DEFAULT 'document', -- document, photo, video, audio, physical
  foundation_witness TEXT,
  admitted BOOLEAN DEFAULT false,
  objection_anticipated BOOLEAN DEFAULT false,
  objection_response TEXT,
  document_id UUID REFERENCES public.documents(id),
  status TEXT DEFAULT 'pending', -- pending, marked, admitted, excluded
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create jury_instructions table
CREATE TABLE public.jury_instructions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.trial_prep_checklists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  instruction_number TEXT,
  instruction_type TEXT DEFAULT 'standard', -- standard, special, contested
  instruction_text TEXT NOT NULL,
  source TEXT,
  status TEXT DEFAULT 'proposed', -- proposed, agreed, contested, given, refused
  opposition_position TEXT,
  argument_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create motions_in_limine table
CREATE TABLE public.motions_in_limine (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.trial_prep_checklists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  motion_title TEXT NOT NULL,
  motion_type TEXT DEFAULT 'exclude', -- exclude, admit, limit
  filed_by TEXT DEFAULT 'us', -- us, opposing
  description TEXT,
  legal_basis TEXT,
  status TEXT DEFAULT 'pending', -- pending, filed, briefed, argued, granted, denied, reserved
  filing_date DATE,
  hearing_date DATE,
  ruling_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.trial_prep_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.witness_prep ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibit_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jury_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motions_in_limine ENABLE ROW LEVEL SECURITY;

-- RLS policies for trial_prep_checklists
CREATE POLICY "Users can view their own checklists" ON public.trial_prep_checklists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own checklists" ON public.trial_prep_checklists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own checklists" ON public.trial_prep_checklists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own checklists" ON public.trial_prep_checklists FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for witness_prep
CREATE POLICY "Users can view their own witness prep" ON public.witness_prep FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own witness prep" ON public.witness_prep FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own witness prep" ON public.witness_prep FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own witness prep" ON public.witness_prep FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for exhibit_list
CREATE POLICY "Users can view their own exhibits" ON public.exhibit_list FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own exhibits" ON public.exhibit_list FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own exhibits" ON public.exhibit_list FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own exhibits" ON public.exhibit_list FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for jury_instructions
CREATE POLICY "Users can view their own jury instructions" ON public.jury_instructions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own jury instructions" ON public.jury_instructions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own jury instructions" ON public.jury_instructions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own jury instructions" ON public.jury_instructions FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for motions_in_limine
CREATE POLICY "Users can view their own motions" ON public.motions_in_limine FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own motions" ON public.motions_in_limine FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own motions" ON public.motions_in_limine FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own motions" ON public.motions_in_limine FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_trial_prep_checklists_updated_at BEFORE UPDATE ON public.trial_prep_checklists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_witness_prep_updated_at BEFORE UPDATE ON public.witness_prep FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exhibit_list_updated_at BEFORE UPDATE ON public.exhibit_list FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_jury_instructions_updated_at BEFORE UPDATE ON public.jury_instructions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_motions_in_limine_updated_at BEFORE UPDATE ON public.motions_in_limine FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();