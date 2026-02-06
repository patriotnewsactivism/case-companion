import { supabase } from "@/integrations/supabase/client";

// ==================== TIME ENTRIES ====================
export interface TimeEntry {
  id: string;
  case_id: string;
  user_id: string;
  description: string;
  duration_minutes: number;
  hourly_rate: number;
  billable: boolean;
  entry_date: string;
  start_time: string | null;
  end_time: string | null;
  status: 'unbilled' | 'billed' | 'paid' | 'written_off';
  invoice_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTimeEntryInput {
  case_id: string;
  description: string;
  duration_minutes: number;
  hourly_rate?: number;
  billable?: boolean;
  entry_date?: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
}

export async function getTimeEntries(caseId?: string): Promise<TimeEntry[]> {
  let query = supabase.from("time_entries").select("*").order("entry_date", { ascending: false });
  if (caseId) query = query.eq("case_id", caseId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as TimeEntry[]) || [];
}

export async function createTimeEntry(input: CreateTimeEntryInput): Promise<TimeEntry> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("time_entries")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TimeEntry;
}

export async function updateTimeEntry(id: string, updates: Partial<CreateTimeEntryInput>): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from("time_entries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TimeEntry;
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (error) throw error;
}

// ==================== COURT DATES ====================
export interface CourtDate {
  id: string;
  case_id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_type: 'hearing' | 'trial' | 'motion' | 'deposition' | 'filing_deadline' | 'discovery_deadline' | 'mediation' | 'conference' | 'other';
  location: string | null;
  courtroom: string | null;
  judge_name: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  reminder_days: number;
  reminder_sent: boolean;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled' | 'continued';
  outcome: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCourtDateInput {
  case_id: string;
  title: string;
  description?: string;
  event_type: CourtDate['event_type'];
  location?: string;
  courtroom?: string;
  judge_name?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
  reminder_days?: number;
  notes?: string;
}

export async function getCourtDates(caseId?: string): Promise<CourtDate[]> {
  let query = supabase.from("court_dates").select("*").order("event_date", { ascending: true });
  if (caseId) query = query.eq("case_id", caseId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as CourtDate[]) || [];
}

export async function getUpcomingCourtDates(days: number = 30): Promise<CourtDate[]> {
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from("court_dates")
    .select("*")
    .gte("event_date", today)
    .lte("event_date", futureDate)
    .eq("status", "scheduled")
    .order("event_date", { ascending: true });

  if (error) throw error;
  return (data as unknown as CourtDate[]) || [];
}

export async function createCourtDate(input: CreateCourtDateInput): Promise<CourtDate> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("court_dates")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CourtDate;
}

export async function updateCourtDate(id: string, updates: Partial<CreateCourtDateInput> & { status?: CourtDate['status']; outcome?: string }): Promise<CourtDate> {
  const { data, error } = await supabase
    .from("court_dates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CourtDate;
}

export async function deleteCourtDate(id: string): Promise<void> {
  const { error } = await supabase.from("court_dates").delete().eq("id", id);
  if (error) throw error;
}

// ==================== DEPOSITIONS ====================
export interface Deposition {
  id: string;
  case_id: string;
  user_id: string;
  deponent_name: string;
  deponent_type: 'party' | 'witness' | 'expert' | 'corporate_representative' | 'other' | null;
  deponent_contact: string | null;
  deponent_email: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_estimate_hours: number | null;
  location: string | null;
  location_type: 'in_person' | 'video' | 'telephonic' | null;
  court_reporter: string | null;
  videographer: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';
  transcript_url: string | null;
  video_url: string | null;
  summary: string | null;
  key_testimony: string[] | null;
  objections_notes: string | null;
  follow_up_items: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDepositionInput {
  case_id: string;
  deponent_name: string;
  deponent_type?: Deposition['deponent_type'];
  deponent_contact?: string;
  deponent_email?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  duration_estimate_hours?: number;
  location?: string;
  location_type?: Deposition['location_type'];
  court_reporter?: string;
  videographer?: string;
}

export async function getDepositions(caseId?: string): Promise<Deposition[]> {
  let query = supabase.from("depositions").select("*").order("scheduled_date", { ascending: true });
  if (caseId) query = query.eq("case_id", caseId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as Deposition[]) || [];
}

export async function createDeposition(input: CreateDepositionInput): Promise<Deposition> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("depositions")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Deposition;
}

export async function updateDeposition(id: string, updates: Partial<CreateDepositionInput> & { status?: Deposition['status']; summary?: string; key_testimony?: string[]; objections_notes?: string; follow_up_items?: string[] }): Promise<Deposition> {
  const { data, error } = await supabase
    .from("depositions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Deposition;
}

export async function deleteDeposition(id: string): Promise<void> {
  const { error } = await supabase.from("depositions").delete().eq("id", id);
  if (error) throw error;
}

// ==================== CLIENT COMMUNICATIONS ====================
export interface ClientCommunication {
  id: string;
  case_id: string;
  user_id: string;
  client_id: string | null;
  communication_type: 'email' | 'phone' | 'meeting' | 'letter' | 'portal_message' | 'text' | null;
  direction: 'incoming' | 'outgoing' | null;
  subject: string | null;
  content: string;
  attachments: string[] | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  follow_up_completed: boolean;
  billable: boolean;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCommunicationInput {
  case_id: string;
  content: string;
  communication_type?: ClientCommunication['communication_type'];
  direction?: ClientCommunication['direction'];
  subject?: string;
  attachments?: string[];
  follow_up_required?: boolean;
  follow_up_date?: string;
  billable?: boolean;
  duration_minutes?: number;
}

export async function getCommunications(caseId?: string): Promise<ClientCommunication[]> {
  let query = supabase.from("client_communications").select("*").order("created_at", { ascending: false });
  if (caseId) query = query.eq("case_id", caseId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as ClientCommunication[]) || [];
}

export async function createCommunication(input: CreateCommunicationInput): Promise<ClientCommunication> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("client_communications")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ClientCommunication;
}

export async function updateCommunication(id: string, updates: Partial<CreateCommunicationInput> & { follow_up_completed?: boolean }): Promise<ClientCommunication> {
  const { data, error } = await supabase
    .from("client_communications")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ClientCommunication;
}

export async function deleteCommunication(id: string): Promise<void> {
  const { error } = await supabase.from("client_communications").delete().eq("id", id);
  if (error) throw error;
}

// ==================== RESEARCH NOTES ====================
export interface ResearchNote {
  id: string;
  case_id: string | null;
  user_id: string;
  title: string;
  research_topic: string | null;
  jurisdiction: string | null;
  case_citations: string[] | null;
  statute_references: string[] | null;
  content: string;
  ai_summary: string | null;
  key_findings: string[] | null;
  applicable_to_case: boolean;
  source_urls: string[] | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CreateResearchNoteInput {
  title: string;
  content: string;
  case_id?: string;
  research_topic?: string;
  jurisdiction?: string;
  case_citations?: string[];
  statute_references?: string[];
  source_urls?: string[];
  tags?: string[];
  applicable_to_case?: boolean;
}

export async function getResearchNotes(caseId?: string): Promise<ResearchNote[]> {
  let query = supabase.from("research_notes").select("*").order("created_at", { ascending: false });
  if (caseId) query = query.eq("case_id", caseId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as ResearchNote[]) || [];
}

export async function createResearchNote(input: CreateResearchNoteInput): Promise<ResearchNote> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("research_notes")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ResearchNote;
}

export async function updateResearchNote(id: string, updates: Partial<CreateResearchNoteInput> & { ai_summary?: string; key_findings?: string[] }): Promise<ResearchNote> {
  const { data, error } = await supabase
    .from("research_notes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ResearchNote;
}

export async function deleteResearchNote(id: string): Promise<void> {
  const { error } = await supabase.from("research_notes").delete().eq("id", id);
  if (error) throw error;
}

// ==================== INVOICES ====================
export interface Invoice {
  id: string;
  case_id: string;
  user_id: string;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
  notes: string | null;
  payment_terms: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceInput {
  case_id: string;
  invoice_number: string;
  client_name: string;
  client_email?: string;
  client_address?: string;
  issue_date?: string;
  due_date?: string;
  subtotal?: number;
  tax_rate?: number;
  notes?: string;
  payment_terms?: string;
}

export async function getInvoices(caseId?: string): Promise<Invoice[]> {
  let query = supabase.from("invoices").select("*").order("issue_date", { ascending: false });
  if (caseId) query = query.eq("case_id", caseId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as Invoice[]) || [];
}

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const taxAmount = ((input.subtotal || 0) * (input.tax_rate || 0)) / 100;
  const totalAmount = (input.subtotal || 0) + taxAmount;

  const { data, error } = await supabase
    .from("invoices")
    .insert({ 
      ...input, 
      user_id: user.id,
      tax_amount: taxAmount,
      total_amount: totalAmount
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Invoice;
}

export async function updateInvoice(id: string, updates: Partial<CreateInvoiceInput> & { status?: Invoice['status']; amount_paid?: number }): Promise<Invoice> {
  const updateData: Record<string, unknown> = { ...updates };
  
  if (updates.subtotal !== undefined || updates.tax_rate !== undefined) {
    const { data: existing } = await supabase.from("invoices").select("subtotal, tax_rate").eq("id", id).single();
    const subtotal = updates.subtotal ?? (existing?.subtotal as number) ?? 0;
    const taxRate = updates.tax_rate ?? (existing?.tax_rate as number) ?? 0;
    const taxAmount = (subtotal * taxRate) / 100;
    updateData.tax_amount = taxAmount;
    updateData.total_amount = subtotal + taxAmount;
  }

  const { data, error } = await supabase
    .from("invoices")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Invoice;
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
}

// ==================== BILLING SUMMARY ====================
export interface BillingSummary {
  totalHours: number;
  billableHours: number;
  unbilledAmount: number;
  billedAmount: number;
  paidAmount: number;
  outstandingAmount: number;
}

export async function getBillingSummary(caseId?: string): Promise<BillingSummary> {
  let query = supabase.from("time_entries").select("duration_minutes, hourly_rate, billable, status");
  if (caseId) query = query.eq("case_id", caseId);
  const { data: entries, error: entriesError } = await query;
  if (entriesError) throw entriesError;

  let invoiceQuery = supabase.from("invoices").select("total_amount, amount_paid, status");
  if (caseId) invoiceQuery = invoiceQuery.eq("case_id", caseId);
  const { data: invoices, error: invoicesError } = await invoiceQuery;
  if (invoicesError) throw invoicesError;

  const timeEntries = entries || [];
  const allInvoices = invoices || [];

  const totalMinutes = timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  const billableMinutes = timeEntries.filter(e => e.billable).reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  const unbilledAmount = timeEntries
    .filter(e => e.status === 'unbilled')
    .reduce((sum, e) => sum + ((e.duration_minutes || 0) / 60) * (e.hourly_rate || 0), 0);

  const billedAmount = allInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
  const paidAmount = allInvoices.reduce((sum, i) => sum + (i.amount_paid || 0), 0);

  return {
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    billableHours: Math.round((billableMinutes / 60) * 10) / 10,
    unbilledAmount: Math.round(unbilledAmount * 100) / 100,
    billedAmount: Math.round(billedAmount * 100) / 100,
    paidAmount: Math.round(paidAmount * 100) / 100,
    outstandingAmount: Math.round((billedAmount - paidAmount) * 100) / 100,
  };
}
