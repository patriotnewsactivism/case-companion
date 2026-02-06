-- =============================================
-- PREMIUM ATTORNEY FEATURES DATABASE SCHEMA
-- =============================================

-- 1. Billable Hours / Time Entries Table
CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  hourly_rate DECIMAL(10,2) DEFAULT 0,
  billable BOOLEAN DEFAULT true,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'unbilled' CHECK (status IN ('unbilled', 'billed', 'paid', 'written_off')),
  invoice_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Court Dates / Calendar Events Table
CREATE TABLE public.court_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('hearing', 'trial', 'motion', 'deposition', 'filing_deadline', 'discovery_deadline', 'mediation', 'conference', 'other')),
  location TEXT,
  courtroom TEXT,
  judge_name TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  all_day BOOLEAN DEFAULT false,
  reminder_days INTEGER DEFAULT 7,
  reminder_sent BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'continued')),
  outcome TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Depositions Table
CREATE TABLE public.depositions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  deponent_name TEXT NOT NULL,
  deponent_type TEXT CHECK (deponent_type IN ('party', 'witness', 'expert', 'corporate_representative', 'other')),
  deponent_contact TEXT,
  deponent_email TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  duration_estimate_hours DECIMAL(4,2),
  location TEXT,
  location_type TEXT CHECK (location_type IN ('in_person', 'video', 'telephonic')),
  court_reporter TEXT,
  videographer TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed')),
  transcript_url TEXT,
  video_url TEXT,
  summary TEXT,
  key_testimony TEXT[],
  objections_notes TEXT,
  follow_up_items TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Client Portal / Client Communications
CREATE TABLE public.client_communications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  client_id UUID,
  communication_type TEXT CHECK (communication_type IN ('email', 'phone', 'meeting', 'letter', 'portal_message', 'text')),
  direction TEXT CHECK (direction IN ('incoming', 'outgoing')),
  subject TEXT,
  content TEXT NOT NULL,
  attachments TEXT[],
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_date DATE,
  follow_up_completed BOOLEAN DEFAULT false,
  billable BOOLEAN DEFAULT false,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Legal Research Notes
CREATE TABLE public.research_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  research_topic TEXT,
  jurisdiction TEXT,
  case_citations TEXT[],
  statute_references TEXT[],
  content TEXT NOT NULL,
  ai_summary TEXT,
  key_findings TEXT[],
  applicable_to_case BOOLEAN DEFAULT false,
  source_urls TEXT[],
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Invoices Table (for billable hours)
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_address TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled')),
  notes TEXT,
  payment_terms TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for time_entries
CREATE POLICY "Users can view their own time entries" ON public.time_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own time entries" ON public.time_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own time entries" ON public.time_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own time entries" ON public.time_entries FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for court_dates
CREATE POLICY "Users can view their own court dates" ON public.court_dates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own court dates" ON public.court_dates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own court dates" ON public.court_dates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own court dates" ON public.court_dates FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for depositions
CREATE POLICY "Users can view their own depositions" ON public.depositions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own depositions" ON public.depositions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own depositions" ON public.depositions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own depositions" ON public.depositions FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for client_communications
CREATE POLICY "Users can view their own communications" ON public.client_communications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own communications" ON public.client_communications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own communications" ON public.client_communications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own communications" ON public.client_communications FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for research_notes
CREATE POLICY "Users can view their own research notes" ON public.research_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own research notes" ON public.research_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own research notes" ON public.research_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own research notes" ON public.research_notes FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for invoices
CREATE POLICY "Users can view their own invoices" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own invoices" ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own invoices" ON public.invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own invoices" ON public.invoices FOR DELETE USING (auth.uid() = user_id);

-- Add update triggers for updated_at columns
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_court_dates_updated_at BEFORE UPDATE ON public.court_dates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_depositions_updated_at BEFORE UPDATE ON public.depositions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_communications_updated_at BEFORE UPDATE ON public.client_communications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_research_notes_updated_at BEFORE UPDATE ON public.research_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_time_entries_case_id ON public.time_entries(case_id);
CREATE INDEX idx_time_entries_user_id ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_entry_date ON public.time_entries(entry_date);
CREATE INDEX idx_court_dates_case_id ON public.court_dates(case_id);
CREATE INDEX idx_court_dates_event_date ON public.court_dates(event_date);
CREATE INDEX idx_depositions_case_id ON public.depositions(case_id);
CREATE INDEX idx_depositions_scheduled_date ON public.depositions(scheduled_date);
CREATE INDEX idx_client_communications_case_id ON public.client_communications(case_id);
CREATE INDEX idx_research_notes_case_id ON public.research_notes(case_id);
CREATE INDEX idx_invoices_case_id ON public.invoices(case_id);