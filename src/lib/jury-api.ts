import { supabase } from "@/integrations/supabase/client";

export interface Juror {
  id: string;
  name: string;
  age: number;
  occupation: string;
  education: string;
  background: string;
  biases: string[];
  leaningScore: number;
  avatar: string;
}

export interface DeliberationStatement {
  jurorId: string;
  statement: string;
  timestamp: number;
}

export interface JuryVerdict {
  verdict: 'guilty' | 'not_guilty' | 'hung';
  confidence: number;
  voteTally: { guilty: number; notGuilty: number };
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
}

export interface MockJurySession {
  id: string;
  case_id: string;
  user_id: string;
  opening_statement: string;
  closing_argument: string;
  jurors: Juror[];
  deliberation: DeliberationStatement[];
  verdict: JuryVerdict | null;
  created_at: string;
}

export interface StartDeliberationInput {
  caseId: string;
  openingStatement: string;
  closingArgument: string;
}

export async function generateJuryPool(): Promise<Juror[]> {
  const { data, error } = await supabase.functions.invoke('mock-jury', {
    body: { action: 'generatePool' },
  });

  if (error) throw error;
  return data.jurors;
}

export async function startDeliberation(input: StartDeliberationInput): Promise<{ sessionId: string; deliberation: DeliberationStatement[]; verdict: JuryVerdict }> {
  const { data, error } = await supabase.functions.invoke('mock-jury', {
    body: {
      action: 'startDeliberation',
      caseId: input.caseId,
      openingStatement: input.openingStatement,
      closingArgument: input.closingArgument,
    },
  });

  if (error) throw error;
  return data;
}

export async function getJurySessions(caseId?: string): Promise<MockJurySession[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let query = supabase
    .from('mock_jury_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (caseId) {
    query = query.eq('case_id', caseId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data as unknown as MockJurySession[]) || [];
}

export async function getJurySession(id: string): Promise<MockJurySession | null> {
  const { data, error } = await supabase
    .from('mock_jury_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as MockJurySession | null;
}

export async function deleteJurySession(id: string): Promise<void> {
  const { error } = await supabase
    .from('mock_jury_sessions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
