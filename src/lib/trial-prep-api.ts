import { supabase } from "@/integrations/supabase/client";

// Trial Prep Checklist types
export interface TrialPrepChecklist {
  id: string;
  case_id: string;
  user_id: string;
  trial_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WitnessPrep {
  id: string;
  checklist_id: string;
  user_id: string;
  witness_name: string;
  witness_type: string;
  contact_info: string | null;
  prep_status: string;
  prep_date: string | null;
  testimony_summary: string | null;
  anticipated_cross: string | null;
  prep_notes: string | null;
  order_of_appearance: number | null;
  subpoena_served: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExhibitItem {
  id: string;
  checklist_id: string;
  user_id: string;
  exhibit_number: string;
  description: string;
  exhibit_type: string;
  foundation_witness: string | null;
  admitted: boolean;
  objection_anticipated: boolean;
  objection_response: string | null;
  document_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface JuryInstruction {
  id: string;
  checklist_id: string;
  user_id: string;
  instruction_number: string | null;
  instruction_type: string;
  instruction_text: string;
  source: string | null;
  status: string;
  opposition_position: string | null;
  argument_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MotionInLimine {
  id: string;
  checklist_id: string;
  user_id: string;
  motion_title: string;
  motion_type: string;
  filed_by: string;
  description: string | null;
  legal_basis: string | null;
  status: string;
  filing_date: string | null;
  hearing_date: string | null;
  ruling_notes: string | null;
  created_at: string;
  updated_at: string;
}

// Checklist CRUD
export async function getOrCreateChecklist(caseId: string): Promise<TrialPrepChecklist | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Try to get existing checklist
  const { data: existing } = await supabase
    .from('trial_prep_checklists')
    .select('*')
    .eq('case_id', caseId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) return existing as TrialPrepChecklist;

  // Create new checklist
  const { data: created, error } = await supabase
    .from('trial_prep_checklists')
    .insert({ case_id: caseId, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error('Error creating checklist:', error);
    return null;
  }

  return created as TrialPrepChecklist;
}

export async function updateChecklist(id: string, updates: Partial<TrialPrepChecklist>): Promise<boolean> {
  const { error } = await supabase
    .from('trial_prep_checklists')
    .update(updates)
    .eq('id', id);

  return !error;
}

// Witness Prep CRUD
export async function getWitnesses(checklistId: string): Promise<WitnessPrep[]> {
  const { data, error } = await supabase
    .from('witness_prep')
    .select('*')
    .eq('checklist_id', checklistId)
    .order('order_of_appearance', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Error fetching witnesses:', error);
    return [];
  }

  return data as WitnessPrep[];
}

export async function createWitness(checklistId: string, witness: Partial<WitnessPrep>): Promise<WitnessPrep | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const insertData = {
    witness_name: witness.witness_name || "",
    witness_type: witness.witness_type || "fact",
    contact_info: witness.contact_info,
    prep_status: witness.prep_status || "not_started",
    prep_date: witness.prep_date,
    testimony_summary: witness.testimony_summary,
    anticipated_cross: witness.anticipated_cross,
    prep_notes: witness.prep_notes,
    order_of_appearance: witness.order_of_appearance,
    subpoena_served: witness.subpoena_served || false,
    checklist_id: checklistId,
    user_id: user.id,
  };

  const { data, error } = await supabase
    .from('witness_prep')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating witness:', error);
    return null;
  }

  return data as WitnessPrep;
}

export async function updateWitness(id: string, updates: Partial<WitnessPrep>): Promise<boolean> {
  const { error } = await supabase
    .from('witness_prep')
    .update(updates)
    .eq('id', id);

  return !error;
}

export async function deleteWitness(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('witness_prep')
    .delete()
    .eq('id', id);

  return !error;
}

// Exhibit List CRUD
export async function getExhibits(checklistId: string): Promise<ExhibitItem[]> {
  const { data, error } = await supabase
    .from('exhibit_list')
    .select('*')
    .eq('checklist_id', checklistId)
    .order('exhibit_number', { ascending: true });

  if (error) {
    console.error('Error fetching exhibits:', error);
    return [];
  }

  return data as ExhibitItem[];
}

export async function createExhibit(checklistId: string, exhibit: Partial<ExhibitItem>): Promise<ExhibitItem | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const insertData = {
    exhibit_number: exhibit.exhibit_number || "",
    description: exhibit.description || "",
    exhibit_type: exhibit.exhibit_type || "document",
    foundation_witness: exhibit.foundation_witness,
    admitted: exhibit.admitted || false,
    objection_anticipated: exhibit.objection_anticipated || false,
    objection_response: exhibit.objection_response,
    document_id: exhibit.document_id,
    status: exhibit.status || "pending",
    checklist_id: checklistId,
    user_id: user.id,
  };

  const { data, error } = await supabase
    .from('exhibit_list')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating exhibit:', error);
    return null;
  }

  return data as ExhibitItem;
}

export async function updateExhibit(id: string, updates: Partial<ExhibitItem>): Promise<boolean> {
  const { error } = await supabase
    .from('exhibit_list')
    .update(updates)
    .eq('id', id);

  return !error;
}

export async function deleteExhibit(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('exhibit_list')
    .delete()
    .eq('id', id);

  return !error;
}

// Jury Instructions CRUD
export async function getJuryInstructions(checklistId: string): Promise<JuryInstruction[]> {
  const { data, error } = await supabase
    .from('jury_instructions')
    .select('*')
    .eq('checklist_id', checklistId)
    .order('instruction_number', { ascending: true });

  if (error) {
    console.error('Error fetching jury instructions:', error);
    return [];
  }

  return data as JuryInstruction[];
}

export async function createJuryInstruction(checklistId: string, instruction: Partial<JuryInstruction>): Promise<JuryInstruction | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const insertData = {
    instruction_number: instruction.instruction_number,
    instruction_type: instruction.instruction_type || "standard",
    instruction_text: instruction.instruction_text || "",
    source: instruction.source,
    status: instruction.status || "proposed",
    opposition_position: instruction.opposition_position,
    argument_notes: instruction.argument_notes,
    checklist_id: checklistId,
    user_id: user.id,
  };

  const { data, error } = await supabase
    .from('jury_instructions')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating jury instruction:', error);
    return null;
  }

  return data as JuryInstruction;
}

export async function updateJuryInstruction(id: string, updates: Partial<JuryInstruction>): Promise<boolean> {
  const { error } = await supabase
    .from('jury_instructions')
    .update(updates)
    .eq('id', id);

  return !error;
}

export async function deleteJuryInstruction(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('jury_instructions')
    .delete()
    .eq('id', id);

  return !error;
}

// Motions in Limine CRUD
export async function getMotionsInLimine(checklistId: string): Promise<MotionInLimine[]> {
  const { data, error } = await supabase
    .from('motions_in_limine')
    .select('*')
    .eq('checklist_id', checklistId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching motions:', error);
    return [];
  }

  return data as MotionInLimine[];
}

export async function createMotionInLimine(checklistId: string, motion: Partial<MotionInLimine>): Promise<MotionInLimine | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const insertData = {
    motion_title: motion.motion_title || "",
    motion_type: motion.motion_type || "exclude",
    filed_by: motion.filed_by || "us",
    description: motion.description,
    legal_basis: motion.legal_basis,
    status: motion.status || "pending",
    filing_date: motion.filing_date,
    hearing_date: motion.hearing_date,
    ruling_notes: motion.ruling_notes,
    checklist_id: checklistId,
    user_id: user.id,
  };

  const { data, error } = await supabase
    .from('motions_in_limine')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating motion:', error);
    return null;
  }

  return data as MotionInLimine;
}

export async function updateMotionInLimine(id: string, updates: Partial<MotionInLimine>): Promise<boolean> {
  const { error } = await supabase
    .from('motions_in_limine')
    .update(updates)
    .eq('id', id);

  return !error;
}

export async function deleteMotionInLimine(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('motions_in_limine')
    .delete()
    .eq('id', id);

  return !error;
}
